import type { Ability, Usage } from "../abilities/Ability"
import { getAbilityUsageMax } from "../abilities/abilityActivation"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { SpellSource } from "../magic/spells/SpellSource"
import type { SpellGrantCastingMode } from "../magic/spells/SpellGrant"
import type { CharacterTemplate } from "./CharacterTemplate"

export type CharacterGrantedSpellUsageSource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }

export type CharacterGrantedSpell = {
  key: string
  index: string
  castingMode: SpellGrantCastingMode
  source: SpellSource
  usage?: Usage
  usageSource?: CharacterGrantedSpellUsageSource
}

export function getCharacterGrantedSpells(
  character: CharacterTemplate,
): CharacterGrantedSpell[] {
  const results: CharacterGrantedSpell[] = []

  for (const ability of character.get("abilities") ?? []) {
    addAbilitySpellGrants(results, ability, {
      type: ability.category === "feat" ? "feat" : "ability",
      name: ability.name || (ability.category === "feat" ? "Talento" : "Habilidade"),
      sourceId: ability.id,
    }, { type: "character", abilityId: ability.id })
  }

  const race = character.get("sheet").race
  for (const ability of race.naturalAbilities ?? []) {
    addAbilitySpellGrants(results, ability, {
      type: "race",
      name: ability.name || race.subrace || race.race,
      sourceId: ability.id,
    }, { type: "race", abilityId: ability.id })
  }

  const shield = character.get("equipment").shield
  const equippedItems = [
    ...character.getEquippedItems(),
    ...(shield ? [shield] : []),
  ]
  const seenEquipment = new Set<string>()

  for (const item of equippedItems) {
    const equipment = item as Equipment
    if (!equipment.id || seenEquipment.has(equipment.id)) continue
    seenEquipment.add(equipment.id)

    for (const grant of equipment.spells ?? []) {
      if (!grant.index) continue

      const castingMode =
        grant.castingMode ??
        (grant.usage.reset === "spellSlot" ? "known" : "source")

      results.push({
        key: `equipment:${equipment.id}:${grant.index}`,
        index: grant.index,
        castingMode,
        source: {
          type: "equipment",
          name: equipment.name || "Equipamento",
          sourceId: equipment.id,
          attribute: grant.attribute ?? "cha",
        },
        usage: castingMode === "source" ? grant.usage : undefined,
      })
    }

    for (const ability of equipment.abilities ?? []) {
      for (const grant of ability.grantedSpells ?? []) {
        if (!grant.index) continue

        const castingMode = grant.castingMode ?? "source"

        results.push({
          key: `equipment-ability:${equipment.id}:${ability.id}:${grant.index}`,
          index: grant.index,
          castingMode,
          source: {
            type: "equipment",
            name: `${equipment.name || "Equipamento"} — ${ability.name || "Habilidade"}`,
            sourceId: `${equipment.id}:${ability.id}`,
            attribute: grant.attribute ?? "cha",
          },
          usage: castingMode === "source" ? ability.usage : undefined,
          usageSource: castingMode === "source" && ability.usage
            ? { type: "equipment", itemId: equipment.id, abilityId: ability.id }
            : undefined,
        })
      }
    }
  }

  return results
}

function addAbilitySpellGrants(
  results: CharacterGrantedSpell[],
  ability: Ability,
  source: Pick<SpellSource, "type" | "name" | "sourceId">,
  usageSource: CharacterGrantedSpellUsageSource,
): void {
  for (const grant of ability.grantedSpells ?? []) {
    if (!grant.index) continue

    const castingMode = grant.castingMode ?? "source"

    results.push({
      key: `${source.type}:${source.sourceId}:${grant.index}`,
      index: grant.index,
      castingMode,
      source: {
        ...source,
        attribute: grant.attribute ?? "cha",
      },
      usage: castingMode === "source" ? ability.usage : undefined,
      usageSource: castingMode === "source" && ability.usage ? usageSource : undefined,
    })
  }
}

export function spendGrantedSpellAbilityUse(
  character: CharacterTemplate,
  source: CharacterGrantedSpellUsageSource,
): CharacterTemplate {
  const spend = (ability: Ability): Ability => {
    if (!ability.usage || ability.usage.reset === "spellSlot") return ability
    const maximum = getAbilityUsageMax(character, ability.usage)
    if (ability.usage.used >= maximum) return ability
    return {
      ...ability,
      usage: {
        ...ability.usage,
        used: Math.min(maximum, ability.usage.used + 1),
      },
    }
  }

  if (source.type === "race") {
    const race = character.get("sheet").race
    return character.withSheet("race", {
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).map((ability) =>
        ability.id === source.abilityId ? spend(ability) : ability,
      ),
    })
  }

  if (source.type === "equipment") {
    const ability = character.getCharacterAbilities().find((entry) =>
      "source" in entry &&
      entry.source === "equipment" &&
      entry.sourceItemId === source.itemId &&
      entry.originalAbilityId === source.abilityId
    )
    if (!ability) return character
    return character.updateEquipmentAbility(source.itemId, spend({ ...ability, id: source.abilityId }))
  }

  const ability = (character.get("abilities") ?? []).find((entry) => entry.id === source.abilityId)
  return ability ? character.updateAbility(spend(ability)) : character
}
