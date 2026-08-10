import type { Ability, Usage } from "../abilities/Ability"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { SpellSource } from "../magic/spells/SpellSource"
import type { SpellGrantCastingMode } from "../magic/spells/SpellGrant"
import { getCharacterAsis } from "./CharacterAsi"
import type { CharacterTemplate } from "./CharacterTemplate"

export type CharacterGrantedSpell = {
  key: string
  index: string
  castingMode: SpellGrantCastingMode
  source: SpellSource
  usage?: Usage
}

export function getCharacterGrantedSpells(
  character: CharacterTemplate,
): CharacterGrantedSpell[] {
  const results: CharacterGrantedSpell[] = []

  for (const ability of character.get("abilities") ?? []) {
    addAbilitySpellGrants(results, ability, {
      type: ability.category === "feat" ? "feat" : "ability",
      name:
        ability.name ||
        (ability.category === "feat" ? "Talento" : "Habilidade"),
      sourceId: ability.id,
    })
  }

  for (const invocation of character.get("magic")?.invocations ?? []) {
    addAbilitySpellGrants(results, invocation, {
      type: "ability",
      name: invocation.name || "Evocação",
      sourceId: invocation.id,
    })
  }

  for (const asi of getCharacterAsis(character)) {
    if (!asi.ability) continue
    addAbilitySpellGrants(results, asi.ability, {
      type: "feat",
      name: asi.ability.name || "Talento",
      sourceId: asi.ability.id,
    })
  }

  const race = character.get("sheet").race
  for (const ability of race.naturalAbilities ?? []) {
    addAbilitySpellGrants(results, ability, {
      type: "race",
      name: ability.name || race.subrace || race.race,
      sourceId: ability.id,
    })
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
    })
  }
}
