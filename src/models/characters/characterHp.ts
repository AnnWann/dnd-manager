import type { Die, DieSides } from "../dice/Die"
import type { HP } from "../sheet/HP"
import type { CharacterTemplate } from "./CharacterTemplate"
import { applyBonuses, getCharacterBonuses } from "./characterStats"

export function withHp<K extends keyof HP>(
  character: CharacterTemplate,
  key: K,
  value: HP[K],
): CharacterTemplate {
  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...character.get("sheet").HP,
        [key]: value,
      },
    },
  })
}

export function getEffectiveMaxHp(
  character: CharacterTemplate,
): number {
  return applyBonuses(
    character.get("sheet").HP.max,
    getCharacterBonuses(character, "maxHp"),
  )
}

export function getEffectiveTemporaryHp(
  character: CharacterTemplate,
): number {
  const bonuses = getCharacterBonuses(character, "temporaryHp")

  if (bonuses.length === 0) {
    return character.get("sheet").HP.temporary
  }

  return applyBonuses(0, bonuses)
}

export function setCurrentHp(
  character: CharacterTemplate,
  value: number,
): CharacterTemplate {
  return withHp(
    character,
    "current",
    clamp(value, 0, getEffectiveMaxHp(character)),
  )
}

export function setTemporaryHp(
  character: CharacterTemplate,
  value: number,
): CharacterTemplate {
  return withHp(character, "temporary", Math.max(0, value))
}

export function setMaxHp(
  character: CharacterTemplate,
  value: number,
): CharacterTemplate {
  const nextMax = Math.max(1, value)
  const currentHp = Math.min(character.get("sheet").HP.current, nextMax)

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...character.get("sheet").HP,
        max: nextMax,
        current: currentHp,
      },
    },
  })
}

export function takeDamage(
  character: CharacterTemplate,
  damage: number,
): CharacterTemplate {
  const amount = Math.max(0, damage)
  const hp = character.get("sheet").HP

  let remainingDamage = amount
  let temporary = hp.temporary
  let current = hp.current

  if (temporary > 0) {
    const absorbed = Math.min(temporary, remainingDamage)
    temporary -= absorbed
    remainingDamage -= absorbed
  }

  current = Math.max(0, current - remainingDamage)

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...hp,
        current,
        temporary,
      },
    },
  })
}

export function heal(
  character: CharacterTemplate,
  amount: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP

  return withHp(
    character,
    "current",
    Math.min(
      getEffectiveMaxHp(character),
      hp.current + Math.max(0, amount),
    ),
  )
}

export function addTemporaryHp(
  character: CharacterTemplate,
  amount: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP

  return withHp(
    character,
    "temporary",
    Math.max(hp.temporary, Math.max(0, amount)),
  )
}

export function addDice(
  character: CharacterTemplate,
  die: Die,
): CharacterTemplate {
  const currentHitDice = character.get("sheet").HP.hitDice
  const existing = currentHitDice[die.sides]

  return withHp(character, "hitDice", {
    ...currentHitDice,
    [die.sides]: {
      max: {
        quantity: (existing?.max.quantity ?? 0) + die.quantity,
        sides: die.sides,
      },
      current: {
        quantity: (existing?.current.quantity ?? 0) + die.quantity,
        sides: die.sides,
      },
    },
  })
}

export function spendHitDie(
  character: CharacterTemplate,
  side: DieSides,
): CharacterTemplate {
  const hitDice = character.get("sheet").HP.hitDice
  const currentDie = hitDice[side]

  if (!currentDie || currentDie.current.quantity <= 0) return character

  return withHp(character, "hitDice", {
    ...hitDice,
    [side]: {
      ...currentDie,
      current: {
        ...currentDie.current,
        quantity: currentDie.current.quantity - 1,
      },
    },
  })
}

export function restoreHitDie(
  character: CharacterTemplate,
  side: DieSides,
): CharacterTemplate {
  const hitDice = character.get("sheet").HP.hitDice
  const currentDie = hitDice[side]

  if (!currentDie) return character

  return withHp(character, "hitDice", {
    ...hitDice,
    [side]: {
      ...currentDie,
      current: {
        ...currentDie.current,
        quantity: Math.min(
          currentDie.max.quantity,
          currentDie.current.quantity + 1,
        ),
      },
    },
  })
}

export function restoreAllHitDice(
  character: CharacterTemplate,
): CharacterTemplate {
  const hitDice = character.get("sheet").HP.hitDice

  return withHp(
    character,
    "hitDice",
    Object.fromEntries(
      Object.entries(hitDice).map(([side, die]) => [
        side,
        die
          ? {
              ...die,
              current: {
                ...die.current,
                quantity: die.max.quantity,
              },
            }
          : die,
      ]),
    ) as HP["hitDice"],
  )
}

export function addDeathSaveSuccess(
  character: CharacterTemplate,
): CharacterTemplate {
  const deathSaves = character.get("deathSaves") ?? {
    successes: 0,
    failures: 0,
  }

  return character.with("deathSaves", {
    ...deathSaves,
    successes: clamp(deathSaves.successes + 1, 0, 3),
  })
}

export function addDeathSaveFailure(
  character: CharacterTemplate,
): CharacterTemplate {
  const deathSaves = character.get("deathSaves") ?? {
    successes: 0,
    failures: 0,
  }

  return character.with("deathSaves", {
    ...deathSaves,
    failures: clamp(deathSaves.failures + 1, 0, 3),
  })
}

export function resetDeathSaves(
  character: CharacterTemplate,
): CharacterTemplate {
  return character.with("deathSaves", {
    successes: 0,
    failures: 0,
  })
}

export function longRestHp(
  character: CharacterTemplate,
): CharacterTemplate {
  return restoreAllHitDice(
    character.withPatch({
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      sheet: {
        ...character.get("sheet"),
        HP: {
          ...character.get("sheet").HP,
          current: getEffectiveMaxHp(character),
          temporary: 0,
        },
      },
    }),
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
