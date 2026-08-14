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

/** Vida máxima atual antes de bônus externos, preservando a máxima real em HP.max. */
export function getCurrentMaxHp(character: CharacterTemplate): number {
  const hp = character.get("sheet").HP
  const currentMax = Number(hp.currentMax)
  return Number.isFinite(currentMax)
    ? Math.max(1, Math.min(hp.max, currentMax))
    : Math.max(1, hp.max)
}

export function getEffectiveMaxHp(
  character: CharacterTemplate,
): number {
  return applyBonuses(
    getCurrentMaxHp(character),
    getCharacterBonuses(character, "maxHp"),
  )
}

export function getEffectiveTemporaryHp(
  character: CharacterTemplate,
): number {
  return applyBonuses(
    character.get("sheet").HP.temporary,
    getCharacterBonuses(character, "temporaryHp"),
  )
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

/** Altera a vida máxima real e mantém a máxima atual sincronizada quando possível. */
export function setMaxHp(
  character: CharacterTemplate,
  value: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const previousRealMax = Math.max(1, hp.max)
  const previousCurrentMax = getCurrentMaxHp(character)
  const hadReduction = previousCurrentMax < previousRealMax
  const nextMax = Math.max(1, value)
  const nextCurrentMax = hadReduction
    ? Math.min(nextMax, previousCurrentMax)
    : nextMax
  const nextEffectiveMax = applyBonuses(
    nextCurrentMax,
    getCharacterBonuses(character, "maxHp"),
  )
  const currentHp = Math.min(hp.current, Math.max(1, nextEffectiveMax))

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...hp,
        max: nextMax,
        currentMax: nextCurrentMax,
        current: currentHp,
      },
    },
  })
}

/**
 * Altera somente a vida máxima atual. É usada por efeitos que reduzem o máximo
 * sem apagar o valor real/base do personagem.
 */
export function setCurrentMaxHp(
  character: CharacterTemplate,
  value: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const nextCurrentMax = clamp(Math.trunc(value), 1, Math.max(1, hp.max))
  const nextEffectiveMax = applyBonuses(
    nextCurrentMax,
    getCharacterBonuses(character, "maxHp"),
  )

  return character.withPatch({
    sheet: {
      ...character.get("sheet"),
      HP: {
        ...hp,
        currentMax: nextCurrentMax,
        current: Math.min(hp.current, Math.max(1, nextEffectiveMax)),
      },
    },
  })
}

export function restoreCurrentMaxHp(
  character: CharacterTemplate,
): CharacterTemplate {
  return setCurrentMaxHp(character, character.get("sheet").HP.max)
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
