import type {
  SessionDiceRollKind,
  SessionDiceRollMode,
  SessionDiceRollRequest,
  SessionDiceRollResult,
} from "../shared/session-runtime/diceRollProtocol"

export const DICE_ROLL_REQUEST_EVENT = "dndmm:dice-roll-request"
export const DICE_ROLL_RESULT_EVENT = "dndmm:dice-roll-result"

export function requestD20Roll(input: {
  characterId: string
  label: string
  modifier?: number
  kind: Exclude<SessionDiceRollKind, "damage">
  mode?: SessionDiceRollMode
}): void {
  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: input.label,
    kind: input.kind,
    mode: input.mode ?? "normal",
    groups: [{ quantity: 1, sides: 20 }],
    modifier: input.modifier ?? 0,
  })
}

export function requestDamageRoll(input: {
  characterId: string
  label: string
  quantity: number
  sides: number | string
  modifier?: number
}): void {
  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: input.label,
    kind: "damage",
    mode: "normal",
    groups: [{
      quantity: Math.max(1, Math.trunc(input.quantity) || 1),
      sides: normalizeSides(input.sides),
    }],
    modifier: input.modifier ?? 0,
  })
}

export function requestFlatDamageRoll(input: {
  characterId: string
  label: string
  total: number
}): void {
  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: input.label,
    kind: "damage",
    mode: "normal",
    groups: [],
    modifier: input.total,
  })
}

export function publishServerDiceRoll(result: SessionDiceRollResult): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionDiceRollResult>(DICE_ROLL_RESULT_EVENT, { detail: result }),
  )
}

export function rollModeFromEvent(
  event: Pick<MouseEvent, "shiftKey" | "altKey">,
): SessionDiceRollMode {
  if (event.shiftKey) return "advantage"
  if (event.altKey) return "disadvantage"
  return "normal"
}

export function rollModifierHint(): string {
  return "Clique para rolar no servidor. Shift: vantagem. Alt: desvantagem."
}

function publishRequest(request: SessionDiceRollRequest): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionDiceRollRequest>(DICE_ROLL_REQUEST_EVENT, { detail: request }),
  )
}

function normalizeSides(value: number | string): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value.trim().toLowerCase().replace(/^d/, ""))

  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error(`Invalid die sides: ${String(value)}`)
  }

  return parsed
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
