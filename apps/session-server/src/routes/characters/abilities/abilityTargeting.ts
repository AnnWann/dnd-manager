import { applyHitPointDamage } from "../../../../../../packages/game-core/src/hitPoints"
import type { AbilityTargeting } from "../../../../../web/src/models/abilities/Ability"
import type { OnUseHpEffect } from "../../../../../web/src/models/bonuses/Bonus"
import { normalizeDamageAffinities, resolveDamage, type DamageAffinity } from "../../../../../web/src/models/combat/Damage"
import type { CompendiumCreature } from "../../../../../web/src/models/creatures/CompendiumCreature"
import { normalizeInitiativeSession, updateInitiativeEntry, synchronizeSharedCombatantState, type InitiativeSession } from "../../../../../web/src/models/initiative/Initiative"
import { defaultCompanionState, type CompanionState } from "../../../../../web/src/shared/session-runtime/companionRuntime"
import type { SessionHpState } from "../../session/protocol"
import type { SessionInitiativeState } from "../../initiative/initiativeProtocol"

export type MutableHpTargets = {
  hp: Record<string, SessionHpState>
  companions: Record<string, CompanionState>
  initiative: SessionInitiativeState | undefined
  creatures: CompendiumCreature[]
  affinities: Record<string, DamageAffinity[]>
  changedCharacters: Set<string>
  changedCompanions: Set<string>
  initiativeChanged: boolean
}

/** Configured targets are mandatory. Legacy/unconfigured abilities never mutate third parties. */
export function validateAbilityTargets(
  targeting: AbilityTargeting | undefined,
  submitted: string[] | undefined,
  casterId: string,
): string[] | null {
  const mode = targeting?.mode ?? "none"
  const refs = submitted ?? []
  if (mode === "none") return refs.length ? null : []
  if (mode === "self") {
    const self = `character:${casterId}`
    return refs.length === 0 || (refs.length === 1 && refs[0] === self) ? [self] : null
  }
  const max = Math.max(1, Math.min(20, targeting?.maxTargets ?? 1))
  if (refs.length < 1 || refs.length > max || new Set(refs).size !== refs.length) return null
  return refs.every(ref => /^(character|initiative|companion):[^:]{1,200}$/.test(ref)) ? refs : null
}

/** Avoid double application when a character/companion appears in several target pickers or initiative turns. */
export function areSelectedTargetsDistinct(
  refs: string[],
  initiative: SessionInitiativeState | undefined,
  creatures: CompendiumCreature[],
): boolean {
  const combat = initiative?.initialized
    ? normalizeInitiativeSession(initiative.session as Partial<InitiativeSession>) : undefined
  const controlled = new Set(creatures.filter(creature => creature.ownerUserId).map(creature => creature.id))
  const resolved = refs.map(ref => {
    if (!ref.startsWith("initiative:")) return ref
    const entry = combat?.entries.find(entry => entry.id === ref.slice("initiative:".length))
    if (!entry) return ref
    if (entry.sourceType === "character" && entry.sourceId) return "character:" + entry.sourceId
    if (entry.sourceId?.startsWith("compendium:")) {
      const id = entry.sourceId.slice("compendium:".length)
      if (controlled.has(id)) return "companion:" + id
    }
    if (entry.combatantId) return "combatant:" + entry.combatantId
    return ref
  })
  return new Set(resolved).size === resolved.length
}

function applyDamageOrHealing(
  current: number, temporary: number, max: number,
  effect: OnUseHpEffect | { kind: "damage" | "heal" | "temporary"; damageType?: import("../../../../../web/src/models/combat/Damage").DamageType; ignoreResistance?: boolean; magical?: boolean; bypassTemporaryHp?: boolean },
  amount: number, affinities?: DamageAffinity[],
) {
  const positive = Math.max(0, Math.trunc(amount))
  if (effect.kind === "heal") return { current: Math.min(max, current + positive), temporary }
  if (effect.kind === "temporary") return { current, temporary: Math.max(temporary, positive) }
  const damage = effect.ignoreResistance
    ? positive
    : resolveDamage(positive, effect.damageType, affinities, { magical: effect.magical }).applied
  if (effect.bypassTemporaryHp) return { current: Math.max(0, current - damage), temporary }
  const applied = applyHitPointDamage({ current, temporary }, damage)
  return { current: applied.current, temporary: applied.temporary }
}

export function applyHpToReferences(
  targets: MutableHpTargets, refs: string[],
  effect: OnUseHpEffect | { kind: "damage" | "heal" | "temporary"; damageType?: import("../../../../../web/src/models/combat/Damage").DamageType; ignoreResistance?: boolean; bypassTemporaryHp?: boolean },
  amount: number,
): boolean {
  for (const ref of refs) {
    const colon = ref.indexOf(":")
    const kind = ref.slice(0, colon)
    const id = ref.slice(colon + 1)
    if (kind === "character") {
      if (!targets.hp[id]) return false
    } else if (kind === "companion") {
      if (!targets.creatures.some(creature => creature.id === id && creature.ownerUserId)) return false
    } else if (kind === "initiative") {
      const session = targets.initiative?.session
        ? normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>) : undefined
      if (!session?.entries.some(entry => entry.id === id)) return false
    } else return false
  }
  // Validation above avoids applying a partially successful effect when any target vanished.
  for (const ref of refs) {
    const colon = ref.indexOf(":")
    let kind = ref.slice(0, colon)
    let id = ref.slice(colon + 1)
    if (kind === "initiative" && targets.initiative) {
      const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
      const entry = session.entries.find(item => item.id === id)!
      if (entry.sourceType === "character" && entry.sourceId && targets.hp[entry.sourceId]) {
        kind = "character"; id = entry.sourceId
      } else if (entry.sourceId?.startsWith("compendium:") && targets.creatures.some(creature =>
        creature.id === entry.sourceId!.slice("compendium:".length) && creature.ownerUserId)) {
        kind = "companion"; id = entry.sourceId.slice("compendium:".length)
      }
    }
    if (kind === "character") {
      const prev = targets.hp[id]
      const maximum = Math.max(1, (prev.currentMax ?? prev.max) + (prev.maxHpBonus ?? 0))
      const next = applyDamageOrHealing(prev.current, prev.temporary, maximum, effect, amount, targets.affinities[id])
      targets.hp[id] = { ...prev, ...next, revision: prev.revision + 1 }
      targets.changedCharacters.add(id)
      if (targets.initiative?.initialized) {
        const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
        let nextSession = session
        for (const entry of session.entries.filter(entry => entry.sourceType === "character" && entry.sourceId === id)) {
          nextSession = updateInitiativeEntry(nextSession, entry.id, candidate => ({
            ...candidate, currentHp: next.current, temporaryHp: next.temporary,
          }))
          nextSession = synchronizeSharedCombatantState(nextSession, entry.id)
        }
        if (nextSession !== session) {
          targets.initiative = { ...targets.initiative, session: nextSession as unknown as Record<string, unknown>, revision: targets.initiative.revision + 1 }
          targets.initiativeChanged = true
        }
      }
    } else if (kind === "companion") {
      const creature = targets.creatures.find(entry => entry.id === id)!
      const prev = targets.companions[id] ?? defaultCompanionState(creature)
      const affinities = normalizeDamageAffinities([...(creature.damageAffinities ?? []), ...(prev.conditions ?? []).flatMap(condition => condition.bonuses?.damageAffinities ?? [])]);
      const nextHp = applyDamageOrHealing(prev.currentHp, prev.temporaryHp, prev.maxHp, effect, amount, affinities)
      const next = { ...prev, currentHp: nextHp.current, temporaryHp: nextHp.temporary, revision: prev.revision + 1 }
      targets.companions[id] = next
      targets.changedCompanions.add(id)
      if (targets.initiative?.initialized) {
        const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
        let nextSession = session
        for (const entry of session.entries.filter(entry => entry.sourceId === `compendium:${id}`)) {
          nextSession = updateInitiativeEntry(nextSession, entry.id, candidate => ({
            ...candidate, currentHp: next.currentHp, temporaryHp: next.temporaryHp,
          }))
          nextSession = synchronizeSharedCombatantState(nextSession, entry.id)
        }
        if (nextSession !== session) {
          targets.initiative = { ...targets.initiative, session: nextSession as unknown as Record<string, unknown>, revision: targets.initiative.revision + 1 }
          targets.initiativeChanged = true
        }
      }
    } else if (kind === "initiative" && targets.initiative) {
      const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
      const entry = session.entries.find(entry => entry.id === id)!
      const creatureId = entry.sourceId?.startsWith("compendium:") ? entry.sourceId.slice("compendium:".length) : undefined
      const creature = targets.creatures.find(item => item.id === creatureId)
      const prevCurrent = entry.currentHp ?? entry.maxHp ?? 0
      const affinities = normalizeDamageAffinities([...(creature?.damageAffinities ?? []), ...(entry.conditions ?? []).flatMap(condition => condition.bonuses?.damageAffinities ?? [])]);
      const next = applyDamageOrHealing(prevCurrent, entry.temporaryHp ?? 0, entry.maxHp ?? prevCurrent, effect, amount, affinities)
      let updated = updateInitiativeEntry(session, id, old => ({ ...old, currentHp: next.current, temporaryHp: next.temporary }))
      updated = synchronizeSharedCombatantState(updated, id)
      targets.initiative = { ...targets.initiative, session: updated as unknown as Record<string, unknown>, revision: targets.initiative.revision + 1 }
      targets.initiativeChanged = true
    }
  }
  return true
}
