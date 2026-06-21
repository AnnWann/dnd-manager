import type { Ability, AbilityUsageResetKind, Usage } from "../abilities/Ability"
import type { DieSides } from "../dice/Die"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { Itemmable } from "../items/item"
import type { CharacterTemplate } from "./CharacterTemplate"

export type HitDiceConsumption = Partial<Record<DieSides, number>>

type RestKind = "short" | "long"

export function takeShortRest(
  character: CharacterTemplate,
  healing: number,
  hitDiceConsumption: HitDiceConsumption,
): CharacterTemplate {
  let nextCharacter = resetRestResources(character, "short")

  for (const [side, requestedAmount] of Object.entries(hitDiceConsumption)) {
    const amount = Math.max(0, Math.trunc(requestedAmount ?? 0))

    for (let index = 0; index < amount; index += 1) {
      nextCharacter = nextCharacter.spendHitDie(side as DieSides)
    }
  }

  return nextCharacter.heal(Math.max(0, Math.trunc(healing)))
}

export function takeLongRest(
  character: CharacterTemplate,
): CharacterTemplate {
  return resetRestResources(character.longRestHp(), "long")
}

function resetRestResources(
  character: CharacterTemplate,
  restKind: RestKind,
): CharacterTemplate {
  const race = character.get("sheet").race

  let nextCharacter = character
    .with(
      "abilities",
      resetAbilities(character.get("abilities") ?? [], restKind),
    )
    .withSheet("race", {
      ...race,
      naturalAbilities: resetAbilities(
        race.naturalAbilities ?? [],
        restKind,
      ),
    })
    .with(
      "equipment",
      resetEquipmentResources(character.get("equipment"), restKind),
    )
    .with(
      "inventory",
      character
        .get("inventory")
        .map((item) => resetItemResources(item, restKind)),
    )

  const magic = nextCharacter.get("magic")

  if (!magic) return nextCharacter

  const pactSlots = nextCharacter.getPactSlots()
  const spellSlots = nextCharacter.getSpellSlots()

  nextCharacter = nextCharacter.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      slots:
        restKind === "long"
          ? Object.fromEntries(
              Object.entries(spellSlots).map(([level, slot]) => [
                level,
                slot
                  ? {
                      ...slot,
                      current: slot.max,
                    }
                  : slot,
              ]),
            )
          : magic.spells.slots,
      pactSlots: pactSlots
        ? {
            ...pactSlots,
            current: pactSlots.max,
          }
        : magic.spells.pactSlots,
    },
    metamagic:
      restKind === "long" && magic.metamagic
        ? {
            ...magic.metamagic,
            sorceryPoints: {
              ...magic.metamagic.sorceryPoints,
              current: magic.metamagic.sorceryPoints.max,
            },
          }
        : magic.metamagic,
  })

  return nextCharacter
}

function resetAbilities(
  abilities: Ability[],
  restKind: RestKind,
): Ability[] {
  return abilities.map((ability) => {
    if (!ability.usage || !shouldReset(ability.usage.reset, restKind)) {
      return ability
    }

    return {
      ...ability,
      usage: resetUsage(ability.usage),
    }
  })
}

function resetUsage(usage: Usage): Usage {
  return {
    ...usage,
    used: 0,
    cooldownRemaining: undefined,
  }
}

function shouldReset(
  resetKind: AbilityUsageResetKind,
  restKind: RestKind,
): boolean {
  if (resetKind === "turn") return true
  if (resetKind === "shortRest") return true

  return restKind === "long" && resetKind === "longRest"
}

function resetEquipmentResources(
  equipment: CharacterEquipment,
  restKind: RestKind,
): CharacterEquipment {
  return {
    ...equipment,
    armor: resetOptionalItem(equipment.armor, restKind),
    boots: resetOptionalItem(equipment.boots, restKind),
    helmet: resetOptionalItem(equipment.helmet, restKind),
    gloves: resetOptionalItem(equipment.gloves, restKind),
    cape: resetOptionalItem(equipment.cape, restKind),
    rings: equipment.rings.map((item) =>
      resetItemResources(item, restKind),
    ),
    weapons: equipment.weapons.map((item) =>
      resetItemResources(item, restKind),
    ),
    pockets: equipment.pockets.map((item) =>
      resetItemResources(item, restKind),
    ),
  }
}

function resetOptionalItem<T extends Itemmable | undefined>(
  item: T,
  restKind: RestKind,
): T {
  if (!item) return item
  return resetItemResources(item, restKind) as T
}

function resetItemResources<T extends Itemmable>(
  item: T,
  restKind: RestKind,
): T {
  const resourceItem = item as T &
    Partial<Pick<Equipment, "abilities" | "spells">>

  const abilities = resourceItem.abilities
    ? resetAbilities(resourceItem.abilities, restKind)
    : undefined

  const spells = resourceItem.spells?.map((spell) => ({
    ...spell,
    usage: shouldReset(spell.usage.reset, restKind)
      ? resetUsage(spell.usage)
      : spell.usage,
  }))

  if (!abilities && !spells) return item

  return {
    ...item,
    ...(abilities ? { abilities } : {}),
    ...(spells ? { spells } : {}),
  } as T
}
