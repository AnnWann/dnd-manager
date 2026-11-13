import { setManualSkillProficiency } from "../../models/characters/characterProficiencies"
import { updateEquippedItem } from "../../models/characters/characterEquippedItemMovement"
import type { Itemmable } from "../../models/items/item"
import {
  advanceInitiativeTurn, endInitiativeCombat, removeInitiativeEntry, rewindInitiativeTurn,
  sortInitiativeEntries, startInitiativeCombat, synchronizeSharedCombatantState, updateInitiativeEntry,
} from "../../models/initiative/Initiative"
import type { SessionInitiativeOperation, SessionInitiativeState } from "./initiativeSessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import { mutateState } from "../../../../session-server/src/routes/characters/sheet/characterState"
import { restoreAbilityUse } from "../../models/abilities/abilityActivation"
import { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import { restoreChannelDivinity, spendChannelDivinity } from "../../models/characters/characterChannelDivinity"
import { spendGrantedSpellAbilityUse } from "../../models/characters/characterGrantedSpells"
import { restoreKi, spendKi } from "../../models/characters/characterKi"
import { restoreSorceryPointDerived, spendSorceryPointDerived } from "../../models/characters/characterSorceryPoints"
import { restoreCustomSpellSlot, spendCustomSpellSlot } from "../../models/characters/customClassConfig"
import type { MagicCircleLevel } from "../../models/magic/spells/spellDefinitions"
import { adjustCustomResource, resetCustomResource, setCustomResourceState } from "../../lib/customSystems/CustomSystemState"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { SessionAbilityOperation, SessionAbilityState } from "./abilitySessionProtocol"
import type { SessionCustomSystemOperation } from "./customSystemSessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionAuthoritativeOperation, SessionHpState } from "./sessionProtocol"

type AbilityCounterOperation = Extract<SessionAbilityOperation, {
  type: "character.ability.usage.spend" | "character.ability.restore"
}>
type ResourceOperation = Extract<SessionCustomSystemOperation, {
  type: "character.customSystem.resource.adjust" | "character.customSystem.resource.set" | "character.customSystem.resource.reset"
}>
type CharacterOperation = SessionMagicOperation | AbilityCounterOperation | ResourceOperation
  | Extract<SessionEquipmentOperation, { type: "character.equipment.item.update" }>

export type OptimisticSessionMutation = {
  id: string
  operation: { domain: "sheet"; value: SessionAuthoritativeOperation }
    | { domain: "character"; value: CharacterOperation }
    | { domain: "initiative"; value: SessionInitiativeOperation }
}

export function canProjectSheetOperation(operation: { type: string }): operation is SessionAuthoritativeOperation {
  return /^character\.(attribute|skill|savingThrow|stat)\./.test(operation.type)
    || operation.type.startsWith("character.hitDice.")
    || (operation.type.startsWith("character.hp.") && operation.type !== "character.hp.damage")
}

export function canProjectMagicOperation(operation: SessionMagicOperation): boolean {
  return /^character\.(spellSlot|pactSlot|customSpellSlot|sorceryPoint|ki|channelDivinity)\./.test(operation.type)
    || operation.type === "character.spell.prepare"
}

export function canProjectAbilityOperation(operation: SessionAbilityOperation): operation is AbilityCounterOperation {
  return (operation.type === "character.ability.usage.spend" || operation.type === "character.ability.restore")
    && operation.source.type !== "condition"
}

export function canProjectResourceOperation(operation: SessionAbilityOperation): operation is ResourceOperation {
  return operation.type === "character.customSystem.resource.adjust" || operation.type === "character.customSystem.resource.set"
    || operation.type === "character.customSystem.resource.reset"
}

export function canProjectInitiativeOperation(operation: SessionInitiativeOperation): boolean {
  return initiativeProjections.has(operation.type)
}

const initiativeProjections = new Set([
  "initiative.entry.update", "initiative.entry.remove", "initiative.viewMode.set", "initiative.settings.update",
  "initiative.sort", "initiative.combat.start", "initiative.combat.end", "initiative.turn.next", "initiative.turn.previous",
])

export function projectSessionMutations(
  hp: Record<string, SessionHpState>,
  abilities: Record<string, SessionAbilityState>,
  initiative: SessionInitiativeState | null,
  pending: OptimisticSessionMutation[],
  definitions: CustomSystemDefinition[],
  actor: "master" | "owner",
) {
  if (!pending.length) return { hp, abilities, initiative }
  const projectedHp = { ...hp }
  const projectedAbilities = { ...abilities }
  let projectedInitiative = initiative
  for (const { operation } of pending) {
    const id = operation.value.characterId
    try {
      if (operation.domain === "initiative") {
        if (projectedInitiative?.initialized) {
          projectedInitiative = { ...projectedInitiative, session: projectInitiative(projectedInitiative.session, operation.value) }
        }
        continue
      }
      if (operation.domain === "sheet") {
        const previous = projectedHp[id]
        if (previous) projectedHp[id] = mutateState(previous, operation.value)
        if (operation.value.type === "character.skill.set" && projectedAbilities[id]?.initialized) {
          const stored = projectedAbilities[id]
          const character = CharacterTemplate.fromJSON(stored.character)
          projectedAbilities[id] = { ...stored, character: setManualSkillProficiency(
            character, operation.value.skill, operation.value.proficiency,
          ).toJSON() }
        }
        continue
      }
      const previous = projectedAbilities[id]
      if (!previous?.initialized) continue
      const character = CharacterTemplate.fromJSON(previous.character)
      const next = projectCharacter(character, operation.value, definitions, actor)
      if (next !== character) projectedAbilities[id] = { ...previous, character: next.toJSON() }
    } catch {
      // An unavailable projection leaves the confirmed state visible. The server
      // still validates the actual request and reports its result.
    }
  }
  return { hp: projectedHp, abilities: projectedAbilities, initiative: projectedInitiative }
}

function projectCharacter(
  character: CharacterTemplate,
  operation: CharacterOperation,
  definitions: CustomSystemDefinition[],
  actor: "master" | "owner",
): CharacterTemplate {
  switch (operation.type) {
    case "character.spellSlot.spend": return character.spendSpellSlot(operation.level as MagicCircleLevel)
    case "character.spellSlot.restore": return character.restoreSpellSlot(operation.level as MagicCircleLevel)
    case "character.pactSlot.spend": return character.spendPactSlot()
    case "character.pactSlot.restore": return character.restorePactSlot()
    case "character.customSpellSlot.spend": return spendCustomSpellSlot(character, operation.poolId, operation.level)
    case "character.customSpellSlot.restore": return restoreCustomSpellSlot(character, operation.poolId, operation.level)
    case "character.sorceryPoint.spend": return spendSorceryPointDerived(character)
    case "character.sorceryPoint.restore": return restoreSorceryPointDerived(character)
    case "character.ki.spend": return spendKi(character)
    case "character.ki.restore": return restoreKi(character)
    case "character.channelDivinity.spend": return spendChannelDivinity(character)
    case "character.channelDivinity.restore": return restoreChannelDivinity(character)
    case "character.spell.prepare": return character.setSpellPrepared(operation.spellIndex, operation.prepared)
    case "character.ability.usage.spend": return spendGrantedSpellAbilityUse(character, operation.source)
    case "character.ability.restore": {
      const source = operation.source
      if (source.type === "equipment") return character.restoreEquipmentAbility(source.itemId, source.abilityId)
      if (source.type === "character") return character.restoreAbility(source.abilityId)
      if (source.type !== "race") return character
      const race = character.get("sheet").race
      return character.withSheet("race", { ...race, naturalAbilities: (race.naturalAbilities ?? []).map(
        ability => ability.id === source.abilityId ? restoreAbilityUse(ability) : ability,
      ) })
    }
    case "character.equipment.item.update":
      return updateEquippedItem(character, operation.reference, operation.item as Itemmable)
    case "character.customSystem.resource.reset":
    case "character.customSystem.resource.adjust":
    case "character.customSystem.resource.set": {
      const definition = definitions.find(entry => entry.id === operation.systemId)
      if (!definition) return character
      return character.withSheet("customSystems", (character.get("sheet").customSystems ?? []).map(state => {
        if (state.systemId !== operation.systemId) return state
        if (operation.type === "character.customSystem.resource.reset") return resetCustomResource(definition, state, operation.resourceId, actor)
        return operation.type === "character.customSystem.resource.adjust"
          ? adjustCustomResource(definition, state, operation.resourceId, operation.amount, actor)
          : setCustomResourceState(definition, state, operation.resourceId, operation.state, actor)
      }))
    }
    default: return character
  }
}

function projectInitiative(session: SessionInitiativeState["session"], operation: SessionInitiativeOperation) {
  switch (operation.type) {
    case "initiative.entry.update":
      return synchronizeSharedCombatantState(updateInitiativeEntry(session, operation.entryId, entry => ({
        ...entry, ...operation.patch,
      })), operation.entryId)
    case "initiative.entry.remove": return removeInitiativeEntry(session, operation.entryId)
    case "initiative.viewMode.set": return { ...session, viewMode: operation.viewMode }
    case "initiative.settings.update": return { ...session, ...operation.patch }
    case "initiative.sort": return sortInitiativeEntries(session)
    case "initiative.combat.start": return startInitiativeCombat(session)
    case "initiative.combat.end": return endInitiativeCombat(session)
    case "initiative.turn.next": return advanceInitiativeTurn(session)
    case "initiative.turn.previous": return rewindInitiativeTurn(session)
    default: return session
  }
}
