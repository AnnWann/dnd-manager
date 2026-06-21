import type { Usage } from "../abilities/Ability"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { SpellSource } from "../magic/spells/SpellSource"
import type { SpellGrantCastingMode } from "../magic/spells/SpellGrant"
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
    for (const grant of ability.grantedSpells ?? []) {
      if (!grant.index) continue

      results.push({
        key: `ability:${ability.id}:${grant.index}`,
        index: grant.index,
        castingMode: grant.castingMode ?? "source",
        source: {
          type: "ability",
          name: ability.name || "Habilidade",
          sourceId: ability.id,
          attribute: grant.attribute ?? "cha",
        },
        usage:
          (grant.castingMode ?? "source") === "source"
            ? ability.usage
            : undefined,
      })
    }
  }

  const race = character.get("sheet").race
  for (const ability of race.naturalAbilities ?? []) {
    for (const grant of ability.grantedSpells ?? []) {
      if (!grant.index) continue

      results.push({
        key: `race:${ability.id}:${grant.index}`,
        index: grant.index,
        castingMode: grant.castingMode ?? "source",
        source: {
          type: "race",
          name: ability.name || race.subrace || race.race,
          sourceId: ability.id,
          attribute: grant.attribute ?? "cha",
        },
        usage:
          (grant.castingMode ?? "source") === "source"
            ? ability.usage
            : undefined,
      })
    }
  }

  for (const item of character.getEquippedItems()) {
    const equipment = item as Equipment

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
