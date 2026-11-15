import type { SessionActionRollResult, SessionDiceRollResult, SessionRollAdjustmentRequest, SessionResolvedDamageRoll } from "../../../../../packages/session-protocol/src/diceRoll"
import { applyCriticalDamageRule, type CriticalDamageSettings } from "../../../../../packages/game-core/src/criticalDamage"
import { broadcastVisibilityFiltered } from "./visibilityDelivery"
import type { SessionConnection } from "./protocol"

type RollMessage =
  | { type: "session.action.result"; result: SessionActionRollResult }
  | { type: "session.dice.result"; result: SessionDiceRollResult }
export type StoredRoll = { message: RollMessage; original: RollMessage; variants: Record<string, unknown> }
const KEY = "adjustable-rolls"
const LIMIT = 100
const rollKey = (id: string) => "adjustable-roll:" + id

/** Store authoritative results before publishing; callers never submit dice or totals. */
export async function broadcastRollResult(storage: DurableObjectStorage, sockets: WebSocket[], message: RollMessage): Promise<void> {
  await storage.transaction(async transaction => {
    const ids = await transaction.get<string[]>(KEY) ?? []
    if (!ids.includes(message.result.id)) {
      const original = structuredClone(message)
      const allDamages = [...damages(original), ...(original.type === "session.action.result" ? original.result.instances?.flatMap(instance => instance.damages ?? []) ?? [] : [])]
      for (const damage of allDamages) {
        if (!damage.critical || damage.normalDamage || !damage.groups.length) continue
        const groups = damage.groups.map(group => ({ ...group, quantity: Math.floor(group.quantity / 2), rolls: group.rolls.slice(0, Math.floor(group.quantity / 2)) }))
        damage.normalDamage = { groups, modifier: damage.modifier, total: Math.max(0, groups.flatMap(group => group.rolls).reduce((a,b) => a+b,0) + damage.modifier) }
      }
      const next = [...ids, message.result.id]
      await transaction.put(rollKey(message.result.id), { message, original, variants: {} })
      for (const id of next.slice(0, Math.max(0, next.length - LIMIT))) await transaction.delete(rollKey(id))
      await transaction.put(KEY, next.slice(-LIMIT))
    }
  })
  broadcastVisibilityFiltered(sockets, message)
}

export function parseRollAdjustment(value: unknown): SessionRollAdjustmentRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const r = value as Record<string, unknown>
  if (typeof r.rollId !== "string" || !r.rollId.trim() || r.rollId.length > 200) return null
  if (!["dice", "attack", "primary", "damage"].includes(String(r.target))) return null
  for (const field of ["instanceIndex", "damageIndex"]) {
    if (r[field] !== undefined && (!Number.isInteger(r[field]) || Number(r[field]) < 0 || Number(r[field]) > 100)) return null
  }
  if (r.target === "damage") {
    if (typeof r.critical !== "boolean" || r.mode !== undefined) return null
  } else if (!["normal", "advantage", "disadvantage"].includes(String(r.mode)) || r.critical !== undefined || r.damageIndex !== undefined) return null
  return { rollId: r.rollId, target: r.target, mode: r.mode, critical: r.critical,
    instanceIndex: r.instanceIndex, damageIndex: r.damageIndex } as SessionRollAdjustmentRequest
}

function randomDie(sides: number): number {
  const buffer = new Uint32Array(1), limit = 0x100000000 - (0x100000000 % sides)
  do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
  return buffer[0] % sides + 1
}

function damages(message: RollMessage, instanceIndex?: number): SessionResolvedDamageRoll[] {
  if (message.type === "session.dice.result") {
    if (instanceIndex !== undefined) throw new Error("Ataque não encontrado.")
    if (message.result.kind !== "damage") return message.result.damages ?? []
    message.result.critical ??= false
    return [message.result as SessionResolvedDamageRoll, ...(message.result.damages ?? [])]
  }
  if (instanceIndex !== undefined) {
    const instance = message.result.instances?.[instanceIndex]
    if (!instance) throw new Error("Ataque não encontrado.")
    return instance.damages ?? []
  }
  return [...(message.result.damage ? [message.result.damage] : []), ...(message.result.damages ?? [])]
}

/** Keep the original first die and reuse extra dice when switching modes. */
export function adjustStoredRoll(
  stored: StoredRoll, request: SessionRollAdjustmentRequest,
  settings?: CriticalDamageSettings, random: (sides: number) => number = randomDie,
): RollMessage {
  const message = stored.message
  const key = JSON.stringify([request.target, request.instanceIndex, request.target === "damage" ? request.damageIndex ?? 0 : null])
  if (request.target === "damage") {
    const damage = damages(message, request.instanceIndex)[request.damageIndex ?? 0]
    const original = damages(stored.original, request.instanceIndex)[request.damageIndex ?? 0]
    if (!damage || !original || damage.damageType === "healing") throw new Error("Dano não encontrado.")
    if (damage.critical === request.critical) return message
    const normal = structuredClone(original.normalDamage ?? {
      groups: original.groups, modifier: original.modifier, total: original.total,
    })
    if (original.critical && !original.normalDamage) throw new Error("Esta rolagem antiga não possui o dano original. Faça uma nova rolagem.")
    if (!request.critical) Object.assign(damage, normal, { critical: false, expression: undefined })
    else if (original.critical) Object.assign(damage, structuredClone(original))
    else {
      let critical = stored.variants[key] as SessionResolvedDamageRoll | undefined
      if (!critical) {
        critical = { ...structuredClone(original), ...normal, critical: true, normalDamage: normal, expression: undefined }
        critical.groups = normal.groups.map(group => ({
          quantity: group.quantity * 2, sides: group.sides,
          rolls: [...group.rolls, ...Array.from({ length: group.quantity }, () => random(group.sides))],
        }))
        critical.total = Math.max(0, critical.groups.flatMap(group => group.rolls).reduce((a,b) => a+b, 0) + critical.modifier)
        applyCriticalDamageRule({ damage: critical }, settings, random)
        stored.variants[key] = structuredClone(critical)
      }
      Object.assign(damage, structuredClone(critical))
    }
    if (message.type === "session.action.result") {
      const r = message.result
      r.critical = [...damages(message), ...(r.instances?.flatMap(instance => instance.damages ?? []) ?? [])].some(damage => damage.critical)
    }
    return message
  }
  const select = (message: RollMessage) => {
    if (request.target === "dice") return message.type === "session.dice.result" && request.instanceIndex === undefined ? message.result : undefined
    if (message.type !== "session.action.result") return undefined
    if (request.target === "primary") return request.instanceIndex === undefined ? message.result.primary : undefined
    return request.instanceIndex === undefined ? message.result.attack : message.result.instances?.[request.instanceIndex]?.attack
  }
  const roll = select(message), original = select(stored.original)
  if (!roll || !original || original.natural === undefined || original.groups.length !== 1 || original.groups[0].sides !== 20) {
    throw new Error("Vantagem só pode ser alterada em uma rolagem de d20.")
  }
  const group = original.groups[0]
  const first = group.rolls[0]
  if (first === undefined) throw new Error("Dado original indisponível.")
  if (request.mode !== "normal" && stored.variants[key] === undefined) stored.variants[key] = group.rolls[1] ?? random(20)
  const rolls = request.mode === "normal" ? [first] : [first, stored.variants[key] as number]
  const natural = request.mode === "advantage" ? Math.max(...rolls) : request.mode === "disadvantage" ? Math.min(...rolls) : first
  roll.groups = [{ quantity: rolls.length, sides: 20, rolls, kept: natural }]
  roll.natural = natural
  roll.mode = request.mode!
  roll.total = natural + roll.modifier
  return message
}

export async function handleRollAdjustment(
  storage: DurableObjectStorage, sockets: WebSocket[], connection: SessionConnection,
  request: SessionRollAdjustmentRequest, settings?: CriticalDamageSettings,
): Promise<void> {
  if (connection.role !== "MASTER") throw new Error("Somente o mestre pode ajustar rolagens.")
  const message = await storage.transaction(async transaction => {
    const stored = await transaction.get<StoredRoll>(rollKey(request.rollId))
    if (!stored) throw new Error("Rolagem indisponível para ajuste. Faça uma nova rolagem.")
    const result = adjustStoredRoll(stored, request, settings)
    await transaction.put(rollKey(request.rollId), stored)
    return result
  })
  broadcastVisibilityFiltered(sockets, message)
}
