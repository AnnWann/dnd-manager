import type { Ability, AbilityUsageResetKind, Usage } from "../abilities/Ability"
import type { DieSides } from "../dice/Die"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { Itemmable } from "../items/item"
import type { HP } from "../sheet/HP"
import { applyCustomSystemRestRecovery } from "../../lib/customSystems"
import type { CharacterTemplate } from "./CharacterTemplate"

type HitDiceConsumption = Partial<Record<DieSides, number>>

export type { HitDiceConsumption }

type RestKind = "short" | "long"

export function takeShortRest(
  character: CharacterTemplate,
  healing: number,
  hitDiceConsumption: HitDiceConsumption,
): CharacterTemplate {
  let nextCharacter = resetRestResources(character, "short", 1)

  for (const [side, requestedAmount] of Object.entries(hitDiceConsumption)) {
    const amount = Math.max(0, Math.trunc(requestedAmount ?? 0))

    for (let index = 0; index < amount; index += 1) {
      nextCharacter = nextCharacter.spendHitDie(side as DieSides)
    }
  }

  nextCharacter = applyCustomSystemRestRecovery(nextCharacter, "short", 1)
  return nextCharacter.heal(Math.max(0, Math.trunc(healing)))
}

export function takeLongRest(
  character: CharacterTemplate,
): CharacterTemplate {
  const rested = resetRestResources(
    recoverLongRestHp(character, 1),
    "long",
    1,
  )
  return applyCustomSystemRestRecovery(rested, "long", 1)
}

export function takePartialLongRest(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentExhaustion = character.get("sheet").stats.exhaustion ?? 0

  const rested = resetRestResources(
    recoverLongRestHp(character, 0.5),
    "long",
    0.5,
  ).withStat(
    "exhaustion",
    Math.min(6, currentExhaustion + 1),
  )

  return applyCustomSystemRestRecovery(rested, "long", 0.5)
}

function recoverLongRestHp(
  character: CharacterTemplate,
  fraction: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const maxHp = character.getEffectiveMaxHp()
  const recoveredHp = recoverMissing(hp.current, maxHp, fraction)

  return character.withPatch({
    deathSaves: {
      successes: 0,
      failures: 0,
    },
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...hp,
        current: recoveredHp,
        temporary: 0,
        hitDice: restoreHitDiceFraction(hp.hitDice, fraction),
      },
    },
  })
}

function restoreHitDiceFraction(
  hitDice: HP["hitDice"],
  fraction: number,
): HP["hitDice"] {
  return Object.fromEntries(
    Object.entries(hitDice).map(([side, die]) => [
      side,
      die
        ? {
            ...die,
            current: {
              ...die.current,
              quantity: recoverMissing(
                die.current.quantity,
                die.max.quantity,
                fraction,
              ),
            },
          }
        : die,
    ]),
  ) as HP["hitDice"]
}

function resetRestResources(
  character: CharacterTemplate,
  restKind: RestKind,
  recoveryFraction: number,
): CharacterTemplate {
  const race = character.get("sheet").race

  let nextCharacter = character
    .with(
      "abilities",
      resetAbilities(
        character.get("abilities") ?? [],
        restKind,
        recoveryFraction,
      ),
    )
    .withSheet("race", {
      ...race,
      naturalAbilities: resetAbilities(
        race.naturalAbilities ?? [],
        restKind,
        recoveryFraction,
      ),
    })
    .with(
      "equipment",
      resetEquipmentResources(
        character.get("equipment"),
        restKind,
        recoveryFraction,
      ),
    )
    .with(
      "inventory",
      character
        .get("inventory")
        .map((item) =>
          resetItemResources(item, restKind, recoveryFraction),
        ),
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
                      current: recoverMissing(
                        slot.current,
                        slot.max,
                        recoveryFraction,
                      ),
                    }
                  : slot,
              ]),
            )
          : magic.spells.slots,
      pactSlots: pactSlots
        ? {
            ...pactSlots,
            current: recoverMissing(
              pactSlots.current,
              pactSlots.max,
              recoveryFraction,
            ),
          }
        : magic.spells.pactSlots,
    },
    metamagic:
      restKind === "long" && magic.metamagic
        ? {
            ...magic.metamagic,
            sorceryPoints: {
              ...magic.metamagic.sorceryPoints,
              current: recoverMissing(
                magic.metamagic.sorceryPoints.current,
                magic.metamagic.sorceryPoints.max,
                recoveryFraction,
              ),
            },
          }
        : magic.metamagic,
  })

  return nextCharacter
}

function resetAbilities(
  abilities: Ability[],
  restKind: RestKind,
  recoveryFraction: number,
): Ability[] {
  return abilities.map((ability) => {
    if (!ability.usage || !shouldReset(ability.usage.reset, restKind)) {
      return ability
    }

    return {
      ...ability,
      usage: restoreUsage(ability.usage, recoveryFraction),
    }
  })
}

function restoreUsage(
  usage: Usage,
  recoveryFraction: number,
): Usage {
  const recoveredUses = Math.ceil(
    Math.max(0, usage.used) * recoveryFraction,
  )

  return {
    ...usage,
    used: Math.max(0, usage.used - recoveredUses),
    cooldownRemaining:
      recoveryFraction >= 1
        ? undefined
        : usage.cooldownRemaining,
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
  recoveryFraction: number,
): CharacterEquipment {
  return {
    ...equipment,
    armor: resetOptionalItem(equipment.armor, restKind, recoveryFraction),
    boots: resetOptionalItem(equipment.boots, restKind, recoveryFraction),
    helmet: resetOptionalItem(equipment.helmet, restKind, recoveryFraction),
    gloves: resetOptionalItem(equipment.gloves, restKind, recoveryFraction),
    cape: resetOptionalItem(equipment.cape, restKind, recoveryFraction),
    rings: equipment.rings.map((item) =>
      resetItemResources(item, restKind, recoveryFraction),
    ),
    weapons: equipment.weapons.map((item) =>
      resetItemResources(item, restKind, recoveryFraction),
    ),
    pockets: equipment.pockets.map((item) =>
      resetItemResources(item, restKind, recoveryFraction),
    ),
  }
}

function resetOptionalItem<T extends Itemmable | undefined>(
  item: T,
  restKind: RestKind,
  recoveryFraction: number,
): T {
  if (!item) return item
  return resetItemResources(item, restKind, recoveryFraction) as T
}

function resetItemResources<T extends Itemmable>(
  item: T,
  restKind: RestKind,
  recoveryFraction: number,
): T {
  const resourceItem = item as T &
    Partial<Pick<Equipment, "abilities" | "spells">>

  const abilities = resourceItem.abilities
    ? resetAbilities(
        resourceItem.abilities,
        restKind,
        recoveryFraction,
      )
    : undefined

  const spells = resourceItem.spells?.map((spell) => ({
    ...spell,
    usage: shouldReset(spell.usage.reset, restKind)
      ? restoreUsage(spell.usage, recoveryFraction)
      : spell.usage,
  }))

  if (!abilities && !spells) return item

  return {
    ...item,
    ...(abilities ? { abilities } : {}),
    ...(spells ? { spells } : {}),
  } as T
}

function recoverMissing(
  current: number,
  maximum: number,
  fraction: number,
): number {
  const missing = Math.max(0, maximum - current)
  const recovered = Math.ceil(missing * Math.max(0, Math.min(1, fraction)))
  return Math.min(maximum, current + recovered)
}
