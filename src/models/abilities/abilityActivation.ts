import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { Bonus } from "../bonuses/Bonus"
import type {
  CharacterCondition,
  CharacterConditionDuration,
  CharacterConditionGrant,
} from "../characters/CharacterCondition"
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../characters/characterConditionStorage"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type {
  Ability,
  AbilityActivationOption,
  AbilityEffectDuration,
  Usage,
} from "./Ability"

export type AbilityEffectSource =
  | { type: "character"; sourceLabel?: string }
  | { type: "race"; sourceLabel?: string }
  | { type: "equipment"; itemId: string; sourceLabel?: string }
  | { type: "condition"; conditionId: string; sourceLabel?: string }

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
 * Resolve o novo formato de mini-habilidade. Opções antigas que continham
 * somente uma condição continuam funcionando e são migradas ao salvar.
 */
export function getActivationOptionAbility(
  option: AbilityActivationOption,
): Ability | undefined {
  if (option.ability) return option.ability
  if (!option.condition) return undefined
  return legacyConditionToEmbeddedAbility(option)
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

/** Executa uso, efeitos de PV, condições e a mini-habilidade escolhida. */
export function useAbilityEffect(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
  activationOptionId?: string,
): CharacterTemplate {
  if (!abilityRequiresActivation(ability)) return character
  if (!canActivateAbility(character, ability)) return character

  const selectedOption = ability.activationOptions?.find(
    (entry) => entry.id === activationOptionId,
  )

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

  if (ability.conditionOnUse) {
    next = upsertGrantedCondition(
      next,
      ability,
      source,
      ability.conditionOnUse,
      "base",
    )
  }

  if (selectedOption?.ability) {
    next = upsertGrantedCondition(
      next,
      ability,
      source,
      optionAbilityGrant(selectedOption, ability),
      `${selectedOption.id}:ability`,
      selectedOption.name,
    )
  } else if (selectedOption?.condition) {
    // Compatibilidade com o primeiro formato das opções.
    next = upsertGrantedCondition(
      next,
      ability,
      source,
      selectedOption.condition,
      selectedOption.id,
      selectedOption.name,
    )
  }

  return next
}

/** Encerra o modificador e remove todas as condições vinculadas ao uso. */
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

  const conditionPrefix = getAbilityConditionId(ability.id, source)
  next = withCharacterConditions(
    next,
    getCharacterConditions(next).filter(
      (condition) =>
        condition.id !== conditionPrefix &&
        !condition.id.startsWith(`${conditionPrefix}:grant:`),
    ),
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
    usage: ability.usage
      ? {
          ...ability.usage,
          sharedResourceId: ability.usage.sharedResourceId?.trim() || undefined,
          sharedResourceName: ability.usage.sharedResourceName?.trim() || undefined,
        }
      : undefined,
    activationOptions: ability.activationOptions
      ?.filter((option) => option.name.trim())
      .map((option) => {
        const embedded = getActivationOptionAbility(option)
        return {
          ...option,
          name: option.name.trim(),
          description:
            embedded?.description?.trim() || option.description?.trim() || undefined,
          duration:
            option.duration ??
            option.condition?.duration ??
            defaultOptionDuration(ability),
          ability: embedded
            ? normalizeAbilityActivation({
                ...embedded,
                id: embedded.id || `activation-option:${option.id}`,
                name: embedded.name.trim() || option.name.trim(),
                activationOptions: undefined,
              })
            : undefined,
          // Novos saves usam a mini-habilidade; o campo antigo só é lido para
          // migrar personagens já existentes.
          condition: undefined,
        }
      }),
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

function optionAbilityGrant(
  option: AbilityActivationOption,
  parent: Ability,
): CharacterConditionGrant {
  const embedded = option.ability!
  return {
    name: option.name || embedded.name || "Opção de habilidade",
    description: option.description || embedded.description,
    behavior:
      "Esta mini-habilidade existe enquanto a opção selecionada permanecer ativa.",
    tags: ["Habilidade", "Opção de habilidade"],
    grantedAbilities: [embedded],
    duration: option.duration ?? defaultOptionDuration(parent),
  }
}

function defaultOptionDuration(ability: Ability): CharacterConditionDuration {
  if (ability.effectPersistence === "permanent") {
    return {
      type: "permanent",
      tickOn: "manual",
      tickOwner: "affected",
      autoRemoveAtZero: false,
    }
  }

  return {
    type: "custom",
    customLabel:
      ability.effectDurationText?.trim() || "Até o efeito ser encerrado",
    tickOn: "manual",
    tickOwner: "affected",
    autoRemoveAtZero: false,
  }
}

function legacyConditionToEmbeddedAbility(
  option: AbilityActivationOption,
): Ability {
  const condition = option.condition!
  return {
    id: `activation-option:${option.id}`,
    name: option.name || condition.name || "Opção",
    description: option.description || condition.description || "",
    kind: "feature",
    category: "general",
    trigger: "always",
    effectPersistence: "untilEnd",
    bonuses: condition.bonuses ?? {},
    grantedSpells: condition.grantedSpells ?? [],
    grantedProficiencies: condition.grantedProficiencies ?? [],
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

  if (source.type === "condition") {
    return withCharacterConditions(
      character,
      getCharacterConditions(character).map((condition) =>
        condition.id === source.conditionId
          ? {
              ...condition,
              grantedAbilities: (condition.grantedAbilities ?? []).map((current) =>
                current.id === ability.id ? ability : current,
              ),
            }
          : condition,
      ),
    )
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

function upsertGrantedCondition(
  character: CharacterTemplate,
  ability: Ability,
  source: AbilityEffectSource,
  grant: CharacterConditionGrant,
  suffix: string,
  optionName?: string,
): CharacterTemplate {
  const condition = createGrantedCondition(
    ability,
    source,
    grant,
    suffix,
    optionName,
  )
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

function createGrantedCondition(
  ability: Ability,
  source: AbilityEffectSource,
  grant: CharacterConditionGrant,
  suffix: string,
  optionName?: string,
): CharacterCondition {
  const duration = grant.duration ?? {
    type: "custom" as const,
    customLabel: "Até ser removida",
    tickOn: "manual" as const,
    tickOwner: "affected" as const,
    autoRemoveAtZero: false,
  }

  return {
    id: `${getAbilityConditionId(ability.id, source)}:grant:${suffix}`,
    name: grant.name.trim() || optionName || ability.name || "Efeito de habilidade",
    description: grant.description?.trim() ?? "",
    behavior:
      grant.behavior?.trim() ||
      "Os benefícios concedidos por esta condição permanecem enquanto ela existir.",
    source: source.sourceLabel?.trim() || ability.name || "Habilidade",
    notes: grant.notes?.trim() ?? "",
    tags: Array.from(new Set(["Habilidade", ...(grant.tags ?? [])])),
    bonuses: grant.bonuses,
    grantedSpells: grant.grantedSpells,
    grantedProficiencies: grant.grantedProficiencies,
    grantedAbilities: grant.grantedAbilities,
    duration,
    createdAt: new Date().toISOString(),
    sourceAbilityId: ability.id,
    sourceAbilityLocation: source.type,
    sourceItemId: source.type === "equipment" ? source.itemId : undefined,
    sourceAbilityOptionId: suffix === "base" ? undefined : suffix,
  }
}

function getAbilityConditionId(
  abilityId: string,
  source: AbilityEffectSource,
): string {
  const origin =
    source.type === "equipment"
      ? `equipment:${source.itemId}`
      : source.type === "condition"
        ? `condition:${source.conditionId}`
        : source.type
  return `ability-effect:${origin}:${abilityId}`
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
