import type { Ability, AbilityActivationOption } from "../../../../../web/src/models/abilities/Ability"
import type { BonusCollection } from "../../../../../web/src/models/bonuses/Bonus"
import type { CharacterConditionGrant, CharacterConditionDuration } from "../../../../../web/src/models/characters/CharacterCondition"
import type { InitiativeCondition, InitiativeConditionDuration, InitiativeSession } from "../../../../../web/src/models/initiative/Initiative"
import { normalizeInitiativeSession, updateInitiativeEntry, synchronizeSharedCombatantState } from "../../../../../web/src/models/initiative/Initiative"
import type { SessionConditionsState, SessionCondition } from "../../session/protocol"
import type { MutableHpTargets } from "./abilityTargeting"

export type TargetEffectGrant = { suffix: string; grant: CharacterConditionGrant }

/** Ignore the instantaneous HP costs when granting an ongoing buff to another recipient. */
export function persistentTargetBonuses(bonuses: BonusCollection | undefined): BonusCollection | undefined {
  if (!bonuses) return undefined
  const { onUseHp: _instant, temporaryHp: _instantTemporaryHp, ...ongoing } = bonuses
  return Object.values(ongoing).some(value => Array.isArray(value) && value.length > 0)
    ? ongoing as BonusCollection : undefined
}

export function abilityTargetGrants(ability: Ability, option?: AbilityActivationOption): TargetEffectGrant[] {
  const grants: TargetEffectGrant[] = []
  const baseBonus = persistentTargetBonuses(ability.bonuses)
  if (baseBonus) grants.push({
    suffix: "base-bonuses",
    grant: { name: ability.name, description: ability.description, bonuses: baseBonus,
      duration: { type: "custom", customLabel: ability.effectDurationText?.trim() || "Até ser removida", tickOn: "manual", tickOwner: "affected" } },
  })
  if (ability.conditionOnUse) grants.push({ suffix: "condition", grant: ability.conditionOnUse })
  if (option) {
    const optionBonus = persistentTargetBonuses(option.bonuses)
    if (optionBonus) grants.push({
      suffix: `option:${option.id}:bonuses`,
      grant: { name: option.name, description: option.description, bonuses: optionBonus,
        duration: option.duration ?? { type: "custom", customLabel: "Até ser removida", tickOn: "manual" } },
    })
    if (option.condition) grants.push({ suffix: `option:${option.id}:condition`, grant: option.condition })
    const abilities = [...(option.abilities ?? []), ...(option.ability ? [option.ability] : [])]
    if (abilities.length) grants.push({
      suffix: `option:${option.id}:abilities`,
      grant: { name: option.name, description: option.description, grantedAbilities: abilities, duration: option.duration },
    })
  }
  return grants
}

function initiativeDuration(duration: CharacterConditionDuration | undefined): InitiativeConditionDuration {
  if (duration?.type === "rounds" && Number.isFinite(duration.remaining ?? duration.total))
    return { type: "rounds", remaining: Math.max(0, Math.trunc(duration.remaining ?? duration.total ?? 0)) }
  if (duration?.type === "turns" && Number.isFinite(duration.remaining ?? duration.total))
    return { type: "turns", remaining: Math.max(0, Math.trunc(duration.remaining ?? duration.total ?? 0)) }
  return { type: "manual" }
}

export function createTargetCondition(
  casterId: string,
  ability: Ability,
  effect: TargetEffectGrant,
  createdAt = new Date().toISOString(),
): SessionCondition {
  const grant = effect.grant
  return {
    id: `targeted:${casterId}:${ability.id}:${effect.suffix}`,
    name: grant.name.trim() || ability.name,
    description: grant.description?.trim() ?? "",
    behavior: grant.behavior?.trim() ?? "Efeito aplicado pela habilidade.",
    source: ability.name,
    notes: grant.notes?.trim() ?? "",
    tags: [...new Set(["Habilidade", ...(grant.tags ?? [])])],
    bonuses: grant.bonuses,
    grantedSpells: grant.grantedSpells,
    grantedProficiencies: grant.grantedProficiencies,
    grantedAbilities: grant.grantedAbilities,
    duration: grant.duration ?? { type: "custom", customLabel: "Até ser removida", tickOn: "manual", tickOwner: "affected", autoRemoveAtZero: false },
    sourceCharacterId: casterId,
    createdAt,
  }
}

export function asInitiativeCondition(condition: SessionCondition): InitiativeCondition {
  return {
    id: condition.id, name: condition.name, description: condition.description,
    behavior: condition.behavior, source: condition.source, notes: condition.notes,
    tags: condition.tags, bonuses: condition.bonuses as BonusCollection | undefined,
    grantedSpells: condition.grantedSpells as InitiativeCondition["grantedSpells"],
    grantedProficiencies: condition.grantedProficiencies as InitiativeCondition["grantedProficiencies"],
    grantedAbilities: condition.grantedAbilities as InitiativeCondition["grantedAbilities"],
    duration: initiativeDuration(condition.duration),
  }
}

function upsert<T extends { id: string }>(existing: T[], value: T): T[] {
  return [...existing.filter(item => item.id !== value.id), value]
}

export type MutableConditionsTargets = MutableHpTargets & {
  conditions: Record<string, SessionConditionsState>
  changedConditions: Set<string>
}

/** Updates canonical target condition pools and all linked initiative entries. */
export function applyConditionToReferences(
  targets: MutableConditionsTargets,
  refs: string[],
  condition: SessionCondition,
): boolean {
  // Caller has validated all references before mutations.
  for (const ref of refs) {
    const separator = ref.indexOf(":")
    let kind = ref.slice(0, separator)
    let id = ref.slice(separator + 1)
    if (kind === "initiative" && targets.initiative?.initialized) {
      const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
      const entry = session.entries.find(candidate => candidate.id === id)
      if (!entry) return false
      if (entry.sourceType === "character" && entry.sourceId && targets.conditions[entry.sourceId]) {
        kind = "character"; id = entry.sourceId
      } else if (entry.sourceId?.startsWith("compendium:") && targets.creatures.some(creature =>
        creature.id === entry.sourceId!.slice("compendium:".length) && creature.ownerUserId)) {
        kind = "companion"; id = entry.sourceId.slice("compendium:".length)
      }
    }
    const initiativeCondition = asInitiativeCondition(condition)
    if (kind === "character") {
      const current = targets.conditions[id]
      if (!current?.initialized) return false
      targets.conditions[id] = {
        ...current, conditions: upsert(current.conditions, condition), revision: current.revision + 1,
      }
      targets.changedConditions.add(id)
    } else if (kind === "companion") {
      const creature = targets.creatures.find(creature => creature.id === id && creature.ownerUserId)
      if (!creature) return false
      const current = targets.companions[id] ?? {
        creatureId: creature.id, currentHp: creature.maxHp ?? 1, maxHp: creature.maxHp ?? 1,
        temporaryHp: 0, featureUses: {}, spellSlots: {}, spellPerDay: {}, revision: 0,
      }
      targets.companions[id] = { ...current, conditions: upsert(current.conditions ?? [], initiativeCondition), revision: current.revision + 1 }
      targets.changedCompanions.add(id)
    } else if (kind !== "initiative") {
      return false
    }
    if (targets.initiative?.initialized) {
      const session = normalizeInitiativeSession(targets.initiative.session as Partial<InitiativeSession>)
      let updated = session
      for (const entry of session.entries.filter(entry => kind === "character"
        ? entry.sourceType === "character" && entry.sourceId === id
        : kind === "companion" ? entry.sourceId === `compendium:${id}` : entry.id === id)) {
        updated = updateInitiativeEntry(updated, entry.id, candidate => ({
          ...candidate, conditions: upsert(candidate.conditions, initiativeCondition),
        }))
        updated = synchronizeSharedCombatantState(updated, entry.id)
      }
      if (updated !== session) {
        targets.initiative = {
          ...targets.initiative, session: updated as unknown as Record<string, unknown>,
          revision: targets.initiative.revision + 1,
        }
        targets.initiativeChanged = true
      }
    }
  }
  return true
}
