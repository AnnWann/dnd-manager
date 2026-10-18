import type { Ability } from "../models/abilities/Ability"
import type { Equipment } from "../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../models/items/item"
import type { Spell } from "../models/magic/spells/Spell"

export function trimSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function trimMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
}

export function trimOptionalSingleLine(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined
  const normalized = trimSingleLine(value)
  return normalized || undefined
}

export function trimOptionalMultiline(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined
  const normalized = trimMultiline(value)
  return normalized || undefined
}

export function normalizeAbilityText(ability: Ability): Ability {
  return {
    ...ability,
    name: trimSingleLine(ability.name),
    description: trimOptionalMultiline(ability.description),
    trigger: trimOptionalSingleLine(ability.trigger),
    grantedSpells: ability.grantedSpells?.map((grant) => ({
      ...grant,
      index: trimSingleLine(grant.index),
    })),
  }
}

export function normalizeItemText<T extends Itemmable>(item: T): T {
  const resourceItem = item as T &
    Partial<Pick<Equipment, "abilities" | "spells">>

  return {
    ...item,
    name: trimSingleLine(item.name),
    desc: trimMultiline(item.desc ?? ""),
    notes: trimMultiline(item.notes ?? ""),
    ...(resourceItem.abilities
      ? {
          abilities: resourceItem.abilities.map(normalizeAbilityText),
        }
      : {}),
    ...(resourceItem.spells
      ? {
          spells: resourceItem.spells.map((spell) => ({
            ...spell,
            index: trimSingleLine(spell.index),
          })),
        }
      : {}),
  } as T
}

export function normalizeSpellText(spell: Spell): Spell {
  return {
    ...spell,
    index: trimSingleLine(spell.index),
    name: trimSingleLine(spell.name),
    displayName: trimOptionalSingleLine(spell.displayName),
    headcanon: trimOptionalMultiline(spell.headcanon),
    description: trimMultiline(spell.description),
    higherLevelText: trimMultiline(spell.higherLevelText),
    school: trimSingleLine(spell.school),
    material: trimOptionalMultiline(spell.material),
    castingTime: {
      ...spell.castingTime,
      reactionWhen: trimOptionalMultiline(
        spell.castingTime.reactionWhen,
      ),
      special: trimOptionalMultiline(spell.castingTime.special),
    },
  }
}
