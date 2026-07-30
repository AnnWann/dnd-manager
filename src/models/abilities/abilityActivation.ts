import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { Bonus } from "../bonuses/Bonus"
import type { CharacterCondition } from "../characters/CharacterCondition"
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../characters/characterConditionStorage"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type {
  Ability,
  AbilityEffectDuration,
  Usage,
} from "./Ability"

export type AbilityEffectSource =
  | { type: "character"; sourceLabel?: string }
  | { type: "race"; sourceLabel?: string }
  | { type: "equipment"; itemId: string; sourceLabel?: string }

export function getAbilityEffectDuration(
  ability: Ability,
): AbilityEffectDuration {
  if (ability.effectDuration) return ability.effectDuration
  return (ability.kind ?? "active") === "active" ? "instant" : "lasting"
}

export function abilityRequiresActivation(ability: Ability): boolean {
  if ((ability.kind ?? "active") === "active") return true

  const trigger = (ability.trigger ?? "always")
    .trim()
    .toLocaleLowerCase("pt-BR")

  return trigger !== "" && trigger !== "always" && trigger !== "sempre"
}

export function isAbilityBenefitsActive(ability: Ability): boolean {
  if (!abilityRequiresActivation(ability)) return true
  return ability.benefitsActive === true
}

export function getAbilityUsageMax(
  character: CharacterTemplate,
  usage: Usage,
): number {
  const formula = usage.maxFormula?.trim()
  const resolved = formula
    ? evaluateCharacterSheetFormula(formula, character)
    : undefined
  const fallback = Number.isFinite(usage.max) ? usage.max : 0
  const value = resolved ?? fallback

  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
}

export function getAbilityRemainingUses(
  character: CharacterTemplate,
  usage: Usage,
): number {
  return Math.max(0, getAbilityUsageMax(character, usage) - usage.used)
}

export function canActivateAbility(
  character: CharacterTemplate,
  ability: Ability,
): boolean {
  if (abilityRequiresActivation(ability) && isAbilityBenefitsActive(ability)) {
    return false
  }

  const usage = ability.usage
  if (!usage || usage.reset === "spellSlot") return true
  return usage.used < getAbilityUsageMax(character, usage)
}

/**
 * Atualiza somente o registro da habilidade. Efeitos instantâneos terminam no
 * mesmo clique; efeitos duradouros permanecem ativos até serem encerrados.
 */
export function activateAbilityBenefits(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!abilityRequiresActivation(ability)) return ability
  if (!canActivateAbility(character, ability)) return ability

  const duration = getAbilityEffectDuration(ability)
  const persists = ability.effectPersistence === "permanent"
  const usage = ability.usage

  return {
    ...ability,
    effectDuration: duration,
    effectPersistence: ability.effectPersistence ?? "untilEnd",
    benefitsActive: duration === "lasting" || persists,
    modifiersActive: undefined,
    usage:
      usage && usage.reset !== "spellSlot"
        ? {
            ...usage,
            used: Math.min(
              getAbilityUsageMax(character, usage),
              usage.used + 1,
            ),
          }
        : usage,
  }
}

export function deactivateAbilityBenefits(ability: Ability): Ability {
  if (!abilityRequiresActivation(ability)) return ability
  if (ability.effectPersistence === "permanent") return ability

  return {
    ...ability,
    benefitsActive: false,
    modifiersActive: undefined,
  }
}

/** Executa uso, efeitos de PV e registro da condição duradoura. */
export function useAbilityEffect(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
): CharacterTemplate {
  if (!abilityRequiresActivation(ability)) return character
  if (!canActivateAbility(character, ability)) return character

  const duration = getAbilityEffectDuration(ability)
  const persists = ability.effectPersistence === "permanent"
  const previousEffectiveMaxHp = character.getEffectiveMaxHp()
  const previousCurrentHp = character.get("sheet").HP.current
  const nextAbility = activateAbilityBenefits(character, ability)
  let next = replaceAbilityAtSource(character, nextAbility, source)

  const maxHpBonuses = resolveBonuses(character, ability.bonuses?.maxHp ?? [])
  if (maxHpBonuses.length > 0) {
    if (duration === "instant" && !persists) {
      const currentBaseMax = next.get("sheet").HP.max
      const nextBaseMax = Math.max(1, applyBonuses(currentBaseMax, maxHpBonuses))
      const gained = Math.max(0, nextBaseMax - currentBaseMax)
      next = next.setMaxHp(nextBaseMax)
      if (gained > 0) next = next.setCurrentHp(previousCurrentHp + gained)
    } else {
      const nextEffectiveMaxHp = next.getEffectiveMaxHp()
      const gained = Math.max(0, nextEffectiveMaxHp - previousEffectiveMaxHp)
      if (gained > 0) next = next.setCurrentHp(previousCurrentHp + gained)
    }
  }

  const temporaryHpBonuses = resolveBonuses(
    character,
    ability.bonuses?.temporaryHp ?? [],
  )
  if (temporaryHpBonuses.length > 0) {
    const currentTemporaryHp = next.get("sheet").HP.temporary
    const nextTemporaryHp = Math.max(
      0,
      applyBonuses(currentTemporaryHp, temporaryHpBonuses),
    )
    next = next.setTemporaryHp(nextTemporaryHp)
  }

  if (duration === "lasting") {
    next = upsertAbilityCondition(next, ability, source)
  }

  return next
}

/** Encerra o modificador e remove a condição vinculada. */
export function endAbilityEffect(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
): CharacterTemplate {
  let next = replaceAbilityAtSource(
    character,
    deactivateAbilityBenefits(ability),
    source,
  )

  const conditionId = getAbilityConditionId(ability.id, source)
  next = withCharacterConditions(
    next,
    getCharacterConditions(next).filter((condition) => condition.id !== conditionId),
  )

  if (ability.effectPersistence !== "permanent") {
    const effectiveMaxHp = next.getEffectiveMaxHp()
    if (next.get("sheet").HP.current > effectiveMaxHp) {
      next = next.setCurrentHp(effectiveMaxHp)
    }
  }

  return next
}

export function restoreAbilityUse(ability: Ability): Ability {
  if (!ability.usage || ability.usage.reset === "spellSlot") return ability

  return {
    ...ability,
    usage: {
      ...ability.usage,
      used: Math.max(0, ability.usage.used - 1),
    },
  }
}

export function normalizeAbilityActivation(ability: Ability): Ability {
  const duration = getAbilityEffectDuration(ability)
  const persistence = ability.effectPersistence ?? "untilEnd"
  const normalized = {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "feature" ? ability.effectDuration : duration,
    effectDurationText:
      duration === "lasting" ? ability.effectDurationText?.trim() || undefined : undefined,
    effectPersistence: persistence,
    modifiersActive: undefined,
  }

  if (!abilityRequiresActivation(normalized)) {
    return {
      ...normalized,
      benefitsActive: undefined,
    }
  }

  return {
    ...normalized,
    benefitsActive:
      (duration === "lasting" || persistence === "permanent") &&
      normalized.benefitsActive === true,
  }
}

function replaceAbilityAtSource(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
): CharacterTemplate {
  if (source.type === "race") {
    const race = character.get("sheet").race
    return character.withSheet("race", {
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).map((current) =>
        current.id === ability.id ? ability : current,
      ),
    })
  }

  if (source.type === "equipment") {
    return character.updateEquipmentAbility(source.itemId, ability)
  }

  return character.updateAbility(ability)
}

function upsertAbilityCondition(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
): CharacterTemplate {
  const condition = createAbilityCondition(ability, source)
  return withCharacterConditions(character, [
    ...getCharacterConditions(character).filter(
      (current) => current.id !== condition.id,
    ),
    condition,
  ])
}

function createAbilityCondition(
  ability: Ability,
  source: AbilityEffectSource,
): CharacterCondition {
  const persists = ability.effectPersistence === "permanent"

  return {
    id: getAbilityConditionId(ability.id, source),
    name: ability.name || "Efeito de habilidade",
    description: ability.description?.trim() ?? "",
    behavior: persists
      ? "A condição controla a duração narrativa, mas os benefícios permanecem após o seu término."
      : "Os benefícios desta habilidade permanecem ativos enquanto esta condição existir.",
    source: source.sourceLabel?.trim() || ability.name || "Habilidade",
    notes: "",
    tags: ["Habilidade", "Efeito duradouro"],
    duration: {
      type: "custom",
      customLabel:
        ability.effectDurationText?.trim() || "Até o efeito ser encerrado",
      tickOn: "manual",
      tickOwner: "affected",
      autoRemoveAtZero: false,
    },
    createdAt: new Date().toISOString(),
    sourceAbilityId: ability.id,
    sourceAbilityLocation: source.type,
    sourceItemId: source.type === "equipment" ? source.itemId : undefined,
  }
}

function getAbilityConditionId(
  abilityId: string,
  source: AbilityEffectSource,
): string {
  const item = source.type === "equipment" ? `:${source.itemId}` : ""
  return `ability-effect:${source.type}${item}:${abilityId}`
}

function resolveBonuses(
  character: CharacterTemplate,
  bonuses: Bonus[],
): Bonus[] {
  return bonuses.map((bonus) => {
    const formula = bonus.formula?.trim()
    if (!formula) return bonus
    const evaluated = evaluateCharacterSheetFormula(formula, character)
    return evaluated === undefined ? bonus : { ...bonus, value: evaluated }
  })
}

function applyBonuses(baseValue: number, bonuses: Bonus[]): number {
  const flat = bonuses.find((bonus) => bonus.type === "flat")
  if (flat) return flat.value

  return bonuses.reduce((value, bonus) => {
    if (bonus.type === "add") return value + bonus.value
    if (bonus.type === "sub") return value - bonus.value
    return bonus.value
  }, baseValue)
}
