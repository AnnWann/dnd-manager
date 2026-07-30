from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Ability model and execution semantics.
# ---------------------------------------------------------------------------
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    "  effectDuration?: AbilityEffectDuration\n  trigger?: Trigger",
    "  effectDuration?: AbilityEffectDuration\n  /** Texto livre exibido na condição criada por efeitos duradouros. */\n  effectDurationText?: string\n  trigger?: Trigger",
    "ability duration text",
)
write(path, text)

write(
    "src/models/abilities/abilityActivation.ts",
    '''import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
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
  const usage = ability.usage

  return {
    ...ability,
    effectDuration: duration,
    benefitsActive: duration === "lasting",
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
  const previousEffectiveMaxHp = character.getEffectiveMaxHp()
  const previousCurrentHp = character.get("sheet").HP.current
  const nextAbility = activateAbilityBenefits(character, ability)
  let next = replaceAbilityAtSource(character, nextAbility, source)

  const maxHpBonuses = resolveBonuses(character, ability.bonuses?.maxHp ?? [])
  if (maxHpBonuses.length > 0) {
    if (duration === "instant") {
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
    const grantedTemporaryHp = Math.max(0, applyBonuses(0, temporaryHpBonuses))
    if (grantedTemporaryHp > 0) {
      next = next.addTemporaryHp(grantedTemporaryHp)
    }
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

  const effectiveMaxHp = next.getEffectiveMaxHp()
  if (next.get("sheet").HP.current > effectiveMaxHp) {
    next = next.setCurrentHp(effectiveMaxHp)
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
  const normalized = {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "feature" ? ability.effectDuration : duration,
    effectDurationText:
      duration === "lasting" ? ability.effectDurationText?.trim() || undefined : undefined,
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
      duration === "lasting" && normalized.benefitsActive === true,
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
  return {
    id: getAbilityConditionId(ability.id, source),
    name: ability.name || "Efeito de habilidade",
    description: ability.description?.trim() ?? "",
    behavior: "Os benefícios desta habilidade permanecem ativos enquanto esta condição existir.",
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
''',
)


# Temporary HP from abilities is a one-time grant, not a continuously computed value.
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    '''export function getAbilityBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getActiveAbilities(character)''',
    '''export function getAbilityBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  if (key === "temporaryHp") return []

  return getActiveAbilities(character)''',
    "one-time temporary hp",
)
write(path, text)


# Character/race/equipment activation paths now execute the whole effect.
path = "src/models/characters/characterAbilities.ts"
text = read(path)
text = text.replace("  activateAbilityBenefits,\n  deactivateAbilityBenefits,", "  endAbilityEffect,\n  useAbilityEffect,")
old_use = '''export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId
        ? activateAbilityBenefits(character, ability)
        : ability,
    ),
  )
}'''
new_use = '''export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  return ability
    ? useAbilityEffect(character, ability, { type: "character" })
    : character
}'''
text = replace_once(text, old_use, new_use, "character ability use")
old_end = '''export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId
        ? deactivateAbilityBenefits(ability)
        : ability,
    ),
  )
}'''
new_end = '''export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  return ability
    ? endAbilityEffect(character, ability, { type: "character" })
    : character
}'''
text = replace_once(text, old_end, new_end, "character ability end")
write(path, text)

path = "src/models/characters/characterEquipment.ts"
text = read(path)
text = text.replace("  activateAbilityBenefits,\n  deactivateAbilityBenefits,", "  endAbilityEffect,\n  useAbilityEffect,")
old_use = '''export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) =>
      ability.id === abilityId
        ? activateAbilityBenefits(character, ability)
        : ability,
    ),
  }))
}'''
new_use = '''export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  const ability = getEquipmentAbilities(character).find(
    (current) =>
      current.sourceItemId === itemId &&
      current.originalAbilityId === abilityId,
  )
  if (!ability) return character

  const { source, sourceItemId, sourceItemName, originalAbilityId, ...projected } = ability
  return useAbilityEffect(
    character,
    { ...projected, id: originalAbilityId },
    {
      type: "equipment",
      itemId,
      sourceLabel: `Equipamento: ${sourceItemName}`,
    },
  )
}'''
text = replace_once(text, old_use, new_use, "equipment ability use")
old_end = '''export function deactivateEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) =>
      ability.id === abilityId
        ? deactivateAbilityBenefits(ability)
        : ability,
    ),
  }))
}'''
new_end = '''export function deactivateEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  const ability = getEquipmentAbilities(character).find(
    (current) =>
      current.sourceItemId === itemId &&
      current.originalAbilityId === abilityId,
  )
  if (!ability) return character

  const { source, sourceItemId, sourceItemName, originalAbilityId, ...projected } = ability
  return endAbilityEffect(
    character,
    { ...projected, id: originalAbilityId },
    {
      type: "equipment",
      itemId,
      sourceLabel: `Equipamento: ${sourceItemName}`,
    },
  )
}'''
text = replace_once(text, old_end, new_end, "equipment ability end")
write(path, text)


# Conditions retain linkage to durable ability effects and ending a condition ends its ability.
path = "src/models/characters/CharacterCondition.ts"
text = read(path)
text = replace_once(
    text,
    '''  createdAt: string

  /** Reserved for the future encounter / initiative system. */''',
    '''  createdAt: string

  /** Vínculo criado automaticamente por habilidades duradouras. */
  sourceAbilityId?: string
  sourceAbilityLocation?: "character" | "race" | "equipment"
  sourceItemId?: string

  /** Reserved for the future encounter / initiative system. */''',
    "condition ability linkage",
)
write(path, text)

path = "src/models/characters/characterConditionStorage.ts"
text = read(path)
old_remove = '''export function removeCharacterCondition(
  character: CharacterTemplate,
  conditionId: string,
): CharacterTemplate {
  return withCharacterConditions(
    character,
    getCharacterConditions(character).filter(
      (condition) => condition.id !== conditionId,
    ),
  )
}'''
new_remove = '''export function removeCharacterCondition(
  character: CharacterTemplate,
  conditionId: string,
): CharacterTemplate {
  const conditions = getCharacterConditions(character)
  const removed = conditions.find((condition) => condition.id === conditionId)
  let next = withCharacterConditions(
    character,
    conditions.filter((condition) => condition.id !== conditionId),
  )

  if (removed?.sourceAbilityId && removed.sourceAbilityLocation) {
    next = deactivateLinkedAbility(next, removed)
  }

  return next
}'''
text = replace_once(text, old_remove, new_remove, "linked condition removal")
text = replace_once(
    text,
    '''    createdAt: readString(raw.createdAt) || new Date().toISOString(),
    sourceCharacterId: optionalString(raw.sourceCharacterId),''',
    '''    createdAt: readString(raw.createdAt) || new Date().toISOString(),
    sourceAbilityId: optionalString(raw.sourceAbilityId),
    sourceAbilityLocation: normalizeAbilityLocation(raw.sourceAbilityLocation),
    sourceItemId: optionalString(raw.sourceItemId),
    sourceCharacterId: optionalString(raw.sourceCharacterId),''',
    "condition linkage normalization",
)
append = '''

function normalizeAbilityLocation(
  value: unknown,
): CharacterCondition["sourceAbilityLocation"] {
  return value === "character" || value === "race" || value === "equipment"
    ? value
    : undefined
}

function deactivateLinkedAbility(
  character: CharacterTemplate,
  condition: CharacterCondition,
): CharacterTemplate {
  const abilityId = condition.sourceAbilityId
  if (!abilityId) return character

  let next = character
  if (condition.sourceAbilityLocation === "character") {
    const ability = (next.get("abilities") ?? []).find(
      (current) => current.id === abilityId,
    )
    if (ability) {
      next = next.updateAbility({
        ...ability,
        benefitsActive: false,
        modifiersActive: undefined,
      })
    }
  }

  if (condition.sourceAbilityLocation === "race") {
    const race = next.get("sheet").race
    next = next.withSheet("race", {
      ...race,
      naturalAbilities: (race.naturalAbilities ?? []).map((ability) =>
        ability.id === abilityId
          ? { ...ability, benefitsActive: false, modifiersActive: undefined }
          : ability,
      ),
    })
  }

  if (condition.sourceAbilityLocation === "equipment" && condition.sourceItemId) {
    const projected = next.getEquipmentAbilities().find(
      (ability) =>
        ability.sourceItemId === condition.sourceItemId &&
        ability.originalAbilityId === abilityId,
    )
    if (projected) {
      const { source, sourceItemId, sourceItemName, originalAbilityId, ...ability } = projected
      next = next.updateEquipmentAbility(condition.sourceItemId, {
        ...ability,
        id: originalAbilityId,
        benefitsActive: false,
        modifiersActive: undefined,
      })
    }
  }

  const effectiveMaxHp = next.getEffectiveMaxHp()
  return next.get("sheet").HP.current > effectiveMaxHp
    ? next.setCurrentHp(effectiveMaxHp)
    : next
}
'''
if "function deactivateLinkedAbility(" not in text:
    text += append
write(path, text)


# Editor: passive durations, duration text, and corrected explanation.
path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    '''                onChange={(event) =>
                  setDraft({
                    ...draft,
                    kind: event.target.value as AbilityKind,
                  })
                }''',
    '''                onChange={(event) => {
                  const kind = event.target.value as AbilityKind
                  setDraft({
                    ...draft,
                    kind,
                    effectDuration:
                      kind === "feature"
                        ? undefined
                        : kind === "active"
                          ? "instant"
                          : "lasting",
                    effectDurationText: undefined,
                    benefitsActive: false,
                  })
                }}''',
    "ability kind duration defaults",
)
text = replace_once(
    text,
    '''          {draft.kind === "active" ? (
            <label className="grid max-w-sm gap-1">''',
    '''          {draft.kind !== "feature" ? (
            <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1">''',
    "duration selector wrapper",
)
text = replace_once(
    text,
    '''                value={draft.effectDuration ?? "instant"}''',
    '''                value={
                  draft.effectDuration ??
                  (draft.kind === "active" ? "instant" : "lasting")
                }''',
    "passive duration default",
)
text = replace_once(
    text,
    '''              <span className="text-[10px] text-textMuted">
                Instantânea permanece ativa somente durante a resolução daquele uso.
              </span>
            </label>
          ) : null}''',
    '''              <span className="text-[10px] text-textMuted">
                Instantânea executa e termina no mesmo clique. Duradoura permanece como uma condição ativa.
              </span>
            </label>

            {(draft.effectDuration ?? (draft.kind === "active" ? "instant" : "lasting")) === "lasting" ? (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">
                  Duração descrita
                </span>
                <Input
                  value={draft.effectDurationText ?? ""}
                  placeholder="Ex.: 1 minuto, até o próximo descanso, enquanto concentrar"
                  onChange={(event) =>
                    setDraft({ ...draft, effectDurationText: event.target.value })
                  }
                />
                <span className="text-[10px] text-textMuted">
                  Este texto aparecerá na condição criada enquanto o efeito estiver ativo.
                </span>
              </label>
            ) : null}
            </div>
          ) : null}''',
    "duration text field",
)
start = text.index('          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">')
end = text.index('          <BonusesFields', start)
new_help = '''          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "feature"
                ? "Esta característica possui um gatilho e precisa ser acionada para conceder seus benefícios. Ela não aparece na seção de ações."
                : (draft.effectDuration ?? (draft.kind === "active" ? "instant" : "lasting")) === "lasting"
                  ? `${draft.kind === "active" ? "Usar" : "Acionar"} aplica o efeito e cria uma condição duradoura. Encerrar ou remover essa condição encerra os modificadores.`
                  : `${draft.kind === "active" ? "Usar" : "Acionar"} executa o efeito e termina automaticamente. PV, PV temporários e outras alterações gravadas na ficha permanecem.`
              : draft.kind === "feature"
                ? "Esta característica não possui condição e concede seus benefícios permanentemente. Ela não aparece na seção de ações."
                : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>

'''
text = text[:start] + new_help + text[end:]
write(path, text)


# Race ability controls use the central execution path.
for path in [
    "src/features/characters/abilities/characterAbilities.tsx",
    "src/features/characters/race/characterRaceV2.tsx",
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
]:
    text = read(path)
    text = text.replace(
        "  activateAbilityBenefits,\n  deactivateAbilityBenefits,",
        "  endAbilityEffect,\n  useAbilityEffect,",
    )
    write(path, text)

path = "src/features/characters/abilities/characterAbilities.tsx"
text = read(path)
old_fn = '''function updateRaceAbilityState(
  character: CharacterTemplate,
  abilityId: string,
  action: "use" | "restore" | "deactivate",
): CharacterTemplate {
  const race = character.get("sheet").race

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
      if (ability.id !== abilityId) return ability
      if (action === "use") return activateAbilityBenefits(character, ability)
      if (action === "restore") return restoreAbilityUse(ability)
      return deactivateAbilityBenefits(ability)
    }),
  })
}'''
new_fn = '''function updateRaceAbilityState(
  character: CharacterTemplate,
  abilityId: string,
  action: "use" | "restore" | "deactivate",
): CharacterTemplate {
  const race = character.get("sheet").race
  const ability = (race.naturalAbilities ?? []).find(
    (current) => current.id === abilityId,
  )
  if (!ability) return character

  if (action === "use") {
    return useAbilityEffect(character, ability, {
      type: "race",
      sourceLabel: "Raça",
    })
  }
  if (action === "deactivate") {
    return endAbilityEffect(character, ability, {
      type: "race",
      sourceLabel: "Raça",
    })
  }

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((current) =>
      current.id === abilityId ? restoreAbilityUse(current) : current,
    ),
  })
}'''
text = replace_once(text, old_fn, new_fn, "abilities tab race execution")
write(path, text)

path = "src/features/characters/race/characterRaceV2.tsx"
text = read(path)
old_block = '''    updateCharacter(character.get("id"), (current) => {
      const currentRace = current.get("sheet").race
      return current.withSheet("race", {
        ...currentRace,
        naturalAbilities: (currentRace.naturalAbilities ?? []).map((ability) => {
          if (ability.id !== abilityId) return ability
          if (action === "use") return activateAbilityBenefits(current, ability)
          if (action === "restore") return restoreAbilityUse(ability)
          return deactivateAbilityBenefits(ability)
        }),
      })
    })'''
new_block = '''    updateCharacter(character.get("id"), (current) => {
      const currentRace = current.get("sheet").race
      const ability = (currentRace.naturalAbilities ?? []).find(
        (entry) => entry.id === abilityId,
      )
      if (!ability) return current
      if (action === "use") {
        return useAbilityEffect(current, ability, {
          type: "race",
          sourceLabel: "Raça",
        })
      }
      if (action === "deactivate") {
        return endAbilityEffect(current, ability, {
          type: "race",
          sourceLabel: "Raça",
        })
      }
      return current.withSheet("race", {
        ...currentRace,
        naturalAbilities: (currentRace.naturalAbilities ?? []).map((entry) =>
          entry.id === abilityId ? restoreAbilityUse(entry) : entry,
        ),
      })
    })'''
text = replace_once(text, old_block, new_block, "race tab ability execution")
write(path, text)

path = "src/features/characters/characterSheet/minimalCharacterActions.tsx"
text = read(path)
old_race = '''       if (source.type === "race") {
         const race = current.get("sheet").race
         return current.withSheet("race", {
           ...race,
           naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
             if (ability.id !== source.abilityId) return ability
             if (action === "use") {
               return activateAbilityBenefits(current, ability)
             }
             return deactivateAbilityBenefits(ability)
           }),
         })
       }'''
new_race = '''       if (source.type === "race") {
         const ability = (current.get("sheet").race.naturalAbilities ?? []).find(
           (entry) => entry.id === source.abilityId,
         )
         if (!ability) return current
         return action === "use"
           ? useAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
           : endAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
       }'''
text = replace_once(text, old_race, new_race, "minimal race ability execution")
write(path, text)


# Equipment resource list also uses the persisted character methods.
path = "src/features/characters/equipment/equipmentFeaturesList.tsx"
text = read(path)
text = text.replace(
    '''import {
  abilityRequiresActivation,
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"''',
    '''import {
  abilityRequiresActivation,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"''',
)
text = text.replace(
    '  const { activeCharacter, visibleCharacters } = useCharacterContext()',
    '  const { activeCharacter, visibleCharacters, updateCharacter } = useCharacterContext()',
)
old_update = '''  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    onUpdate((current) => ({
      ...current,
      abilities: (current.abilities ?? []).map((ability) => {
        if (ability.id !== abilityId) return ability
        if (action === "deactivate") return deactivateAbilityBenefits(ability)
        if (action === "restore") return restoreAbilityUse(ability)
        return character ? activateAbilityBenefits(character, ability) : ability
      }),
    }))
  }'''
new_update = '''  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    if (!character) return
    updateCharacter(characterId, (current) => {
      if (action === "use") {
        return current.useEquipmentAbility(equipment.id, abilityId)
      }
      if (action === "deactivate") {
        return current.deactivateEquipmentAbility(equipment.id, abilityId)
      }
      return current.restoreEquipmentAbility(equipment.id, abilityId)
    })
  }'''
text = replace_once(text, old_update, new_update, "equipment resource execution")
text = text.replace(
    '''          const canTrigger =
            requiresActivation &&
            ((ability.kind ?? "active") === "active" || !benefitsActive)''',
    '''          const canTrigger = requiresActivation && !benefitsActive''',
)
write(path, text)


# ---------------------------------------------------------------------------
# Custom race model, absolute mobility, and creation flow.
# ---------------------------------------------------------------------------
path = "src/models/races/Race.ts"
text = read(path)
text = replace_once(
    text,
    "export type Race =\n  | 'aarakocra'",
    "export type Race =\n  | 'custom'\n  | 'aarakocra'",
    "custom race type",
)
write(path, text)

path = "src/models/races/CharacterRace.ts"
text = read(path)
text = replace_once(
    text,
    '''export type CharacterRace = {
  race: Race
  subrace: string''',
    '''export type CharacterRace = {
  race: Race
  /** Nome exibido quando a raça é personalizada. */
  customName?: string
  subrace: string''',
    "custom race name",
)
text = replace_once(
    text,
    '''  size?: CreatureSize
  speedBonus?: number''',
    '''  size?: CreatureSize
  /** Mobilidade racial base em metros. */
  mobility?: number
  /** Campo legado mantido para personagens antigos. */
  speedBonus?: number''',
    "race mobility",
)
write(path, text)

path = "src/lib/raceNames.ts"
text = read(path)
text = replace_once(text, "export const RACE_NAMES: Record<Race, string> = {\n", "export const RACE_NAMES: Record<Race, string> = {\n  custom: \"Personalizada\",\n", "custom race label")
write(path, text)

path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '''        race: {
          race: props.sheet?.race?.race ?? "human",
          subrace: props.sheet?.race?.subrace ?? "",''',
    '''        race: {
          race: props.sheet?.race?.race ?? "human",
          customName: props.sheet?.race?.customName,
          subrace: props.sheet?.race?.subrace ?? "",''',
    "custom race hydration",
)
text = replace_once(
    text,
    '''          size: props.sheet?.race?.size ?? "medium",
          speedBonus: props.sheet?.race?.speedBonus ?? 0,''',
    '''          size: props.sheet?.race?.size ?? "medium",
          mobility: props.sheet?.race?.mobility,
          speedBonus: props.sheet?.race?.speedBonus ?? 0,''',
    "race mobility hydration",
)
write(path, text)

path = "src/models/characters/characterStats.ts"
text = read(path)
old_mobility = '''export function getCalculatedMobility(character: CharacterTemplate): number {
  const raceSpeedBonus =
    character.get("sheet").race.speedBonus ?? 0

  const baseSpeed =
    (character.get("sheet").stats.mobility ?? 9) + raceSpeedBonus'''
new_mobility = '''export function getCalculatedMobility(character: CharacterTemplate): number {
  const sheet = character.get("sheet")
  const racialMobility = sheet.race.mobility
  const baseSpeed =
    typeof racialMobility === "number" && Number.isFinite(racialMobility)
      ? racialMobility
      : (sheet.stats.mobility ?? 9) + (sheet.race.speedBonus ?? 0)'''
text = replace_once(text, old_mobility, new_mobility, "absolute race mobility")
write(path, text)

path = "src/features/characters/creation/phbPresets.ts"
text = read(path)
text = replace_once(
    text,
    '''    size: preset.size,
    speedBonus: preset.speedBonus,''',
    '''    size: preset.size,
    mobility: 9 + preset.speedBonus,
    speedBonus: undefined,''',
    "preset absolute mobility",
)
write(path, text)

path = "src/features/characters/race/characterRaceV2.tsx"
text = read(path)
text = replace_once(
    text,
    '''const RACE_OPTIONS: Array<{ value: Race; label: string }> = [
  { value: "aarakocra", label: "Aarakocra" },''',
    '''const RACE_OPTIONS: Array<{ value: Race; label: string }> = [
  { value: "custom", label: "Personalizada" },
  { value: "aarakocra", label: "Aarakocra" },''',
    "custom race editor option",
)
text = replace_once(
    text,
    '''        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 gap-1.5">''',
    '''        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {race.race === "custom" ? (
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-textH">Nome da raça</span>
              <Input
                value={race.customName ?? ""}
                placeholder="Ex.: Povo da Lua"
                onChange={(event) => setRaceField("customName", event.target.value)}
              />
            </label>
          ) : null}

          <label className="grid min-w-0 gap-1.5">''',
    "custom race name editor",
)
text = replace_once(
    text,
    '''              Bônus de deslocamento
            </span>
            <Input
              type="number"
              step="0.5"
              value={race.speedBonus ?? 0}
              onChange={(event) =>
                setRaceField(
                  "speedBonus",
                  Number(event.target.value) || 0,
                )
              }
            />''',
    '''              Mobilidade
            </span>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={race.mobility ?? 9 + (race.speedBonus ?? 0)}
              onChange={(event) =>
                updateRace((currentRace) => ({
                  ...currentRace,
                  mobility: Math.max(0, Number(event.target.value) || 0),
                  speedBonus: undefined,
                }))
              }
            />''',
    "race editor mobility",
)
write(path, text)


# Creation wizard imports shared ability/proficiency editors and supports page mode.
path = "src/features/characters/creation/characterCreationWizardV4.tsx"
text = read(path)
text = replace_once(
    text,
    '''import type { CharacterBackground } from "../../../models/characters/CharacterBackground"''',
    '''import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterBackground } from "../../../models/characters/CharacterBackground"''',
    "wizard ability import",
)
text = replace_once(
    text,
    '''import type { Skill } from "../../../models/sheet/Skills"''',
    '''import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import { AbilityDialog } from "../abilities/abilityDialog"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"''',
    "wizard shared race editors",
)
text = replace_once(
    text,
    '''type EquipmentMode = "equipment" | "gold"''',
    '''type EquipmentMode = "equipment" | "gold"
type CustomRaceBonusPattern = "two-one" | "three-ones"''',
    "custom race bonus pattern type",
)
text = replace_once(
    text,
    '''  createOwner: (ownerName: string) => Player
}''',
    '''  createOwner: (ownerName: string) => Player
  mode?: "modal" | "page"
}''',
    "wizard mode prop",
)
text = replace_once(
    text,
    '''  onCreate,
  createOwner,
}: Props) {''',
    '''  onCreate,
  createOwner,
  mode = "modal",
}: Props) {''',
    "wizard mode argument",
)
text = replace_once(
    text,
    '''  const [racialSkillChoices, setRacialSkillChoices] = useState<Skill[]>([])''',
    '''  const [racialSkillChoices, setRacialSkillChoices] = useState<Skill[]>([])
  const [customRaceBonusPattern, setCustomRaceBonusPattern] =
    useState<CustomRaceBonusPattern>("two-one")''',
    "custom race bonus pattern state",
)
text = replace_once(
    text,
    '''    setRacialSkillChoices([])
    setBackgroundPresetId(firstBackground.id)''',
    '''    setRacialSkillChoices([])
    setCustomRaceBonusPattern("two-one")
    setBackgroundPresetId(firstBackground.id)''',
    "reset custom race pattern",
)
old_custom = '''  function selectCustomRace() {
    const slots: RaceBonusSlot[] = [
      {
        id: "custom-plus-two",
        amount: 2,
        attribute: "str",
        locked: false,
      },
      {
        id: "custom-plus-one",
        amount: 1,
        attribute: "dex",
        locked: false,
      },
    ]

    setRacePresetId("custom")
    setRaceBonusSlots(slots)
    setRacialSkillChoices([])
    setRace((current) =>
      applyRaceBonusSlots(
        {
          ...current,
          naturalAbilities: [...(current.naturalAbilities ?? [])],
          proficiencies: [...(current.proficiencies ?? [])],
        },
        slots,
      ),
    )
  }'''
new_custom = '''  function selectCustomRace() {
    const slots = createCustomRaceBonusSlots("two-one")
    setRacePresetId("custom")
    setCustomRaceBonusPattern("two-one")
    setRaceBonusSlots(slots)
    setRacialSkillChoices([])
    setRace(
      applyRaceBonusSlots(
        {
          race: "custom",
          customName: "Raça personalizada",
          subrace: "",
          naturalAbilities: [],
          attributeBonus: {},
          proficiencies: [],
          size: "medium",
          mobility: 9,
          speedBonus: undefined,
        },
        slots,
      ),
    )
  }

  function changeCustomRaceBonusPattern(pattern: CustomRaceBonusPattern) {
    const slots = createCustomRaceBonusSlots(pattern)
    setCustomRaceBonusPattern(pattern)
    setRaceBonusSlots(slots)
    setRace((current) => applyRaceBonusSlots(current, slots))
  }'''
text = replace_once(text, old_custom, new_custom, "custom race initialization")
text = replace_once(
    text,
    '''               onSelectCustom={selectCustomRace}
               onChange={setRace}''',
    '''               onSelectCustom={selectCustomRace}
               bonusPattern={customRaceBonusPattern}
               onBonusPatternChange={changeCustomRaceBonusPattern}
               onChange={setRace}''',
    "race step bonus pattern props",
)
text = replace_once(
    text,
    '''    <div
      className="fixed inset-0 z-[80] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-creation-title"
        className="grid h-[100dvh] w-full min-w-0 max-w-[100vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border bg-bg-elevated text-text shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:rounded-xl sm:border"
        onMouseDown={(event) => event.stopPropagation()}
      >''',
    '''    <div
      className={
        mode === "page"
          ? "mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-6xl items-start px-2 py-4 sm:px-4"
          : "fixed inset-0 z-[80] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-0 backdrop-blur-sm sm:p-4"
      }
      onMouseDown={mode === "modal" ? onClose : undefined}
    >
      <div
        role={mode === "modal" ? "dialog" : undefined}
        aria-modal={mode === "modal" ? true : undefined}
        aria-labelledby="character-creation-title"
        className={
          mode === "page"
            ? "grid min-h-[calc(100dvh-10rem)] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-bg-elevated text-text shadow-theme-lg"
            : "grid h-[100dvh] w-full min-w-0 max-w-[100vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border bg-bg-elevated text-text shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:rounded-xl sm:border"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >''',
    "wizard page layout",
)
# RaceStep signature and custom editors.
text = replace_once(
    text,
    '''  onSelectCustom,
  onChange,
  onToggleSkill,''',
    '''  onSelectCustom,
  bonusPattern,
  onBonusPatternChange,
  onChange,
  onToggleSkill,''',
    "race step pattern arguments",
)
text = replace_once(
    text,
    '''  onSelectCustom: () => void
  onChange: (race: CharacterRace) => void''',
    '''  onSelectCustom: () => void
  bonusPattern: CustomRaceBonusPattern
  onBonusPatternChange: (pattern: CustomRaceBonusPattern) => void
  onChange: (race: CharacterRace) => void''',
    "race step pattern types",
)
text = replace_once(
    text,
    ''') {
  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Preset racial"''',
    ''') {
  const [creatingAbility, setCreatingAbility] = useState(false)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const custom = selectedPresetId === "custom"

  function saveRacialAbility(ability: Ability) {
    const current = race.naturalAbilities ?? []
    const exists = current.some((entry) => entry.id === ability.id)
    onChange({
      ...race,
      naturalAbilities: exists
        ? current.map((entry) => (entry.id === ability.id ? ability : entry))
        : [...current, ability],
    })
    setCreatingAbility(false)
    setEditingAbility(null)
  }

  return (
    <div className="grid min-w-0 gap-5">
      <StepSection
        title="Preset racial"''',
    "race step local ability editor",
)
text = replace_once(
    text,
    '''        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Sub-raça">''',
    '''        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {custom ? (
            <Field label="Nome da raça">
              <Input
                value={race.customName ?? ""}
                placeholder="Ex.: Povo da Lua"
                onChange={(event) =>
                  onChange({ ...race, race: "custom", customName: event.target.value })
                }
              />
            </Field>
          ) : null}
          <Field label="Sub-raça">''',
    "custom race name in wizard",
)
text = replace_once(
    text,
    '''          <Field label="Ajuste de deslocamento">
            <Input
              type="number"
              step="0.5"
              value={race.speedBonus ?? 0}
              onChange={(event) =>
                onChange({
                  ...race,
                  speedBonus: Number(event.target.value) || 0,
                })
              }
            />
          </Field>''',
    '''          <Field label="Mobilidade">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={race.mobility ?? 9 + (race.speedBonus ?? 0)}
              onChange={(event) =>
                onChange({
                  ...race,
                  mobility: Math.max(0, Number(event.target.value) || 0),
                  speedBonus: undefined,
                })
              }
            />
          </Field>
          {custom ? (
            <Field label="Bônus de atributos">
              <Select
                value={bonusPattern}
                onChange={(event) =>
                  onBonusPatternChange(event.target.value as CustomRaceBonusPattern)
                }
              >
                <option value="two-one">Livre: +2 e +1</option>
                <option value="three-ones">Livre: +1, +1 e +1</option>
              </Select>
            </Field>
          ) : null}''',
    "wizard absolute mobility and bonus pattern",
)
insert_marker = '''        {skillChoiceLimit > 0 ? (
          <div className="mt-4">'''
custom_sections = '''        {custom ? (
          <div className="mt-5 grid gap-4">
            <section className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-textH">Características raciais</div>
                  <div className="mt-1 text-[11px] text-textMuted">
                    Use o mesmo editor de habilidades da ficha para registrar características, passivas e ações raciais.
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setCreatingAbility(true)}>
                  <Plus className="h-4 w-4" /> Característica
                </Button>
              </div>
              {(race.naturalAbilities ?? []).length ? (
                <div className="mt-3 grid gap-2">
                  {(race.naturalAbilities ?? []).map((ability) => (
                    <div key={ability.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-textH">{ability.name}</div>
                        {ability.description ? <div className="mt-1 line-clamp-2 text-[11px] text-textMuted">{ability.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingAbility(ability)}>Editar</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onChange({
                              ...race,
                              naturalAbilities: (race.naturalAbilities ?? []).filter((entry) => entry.id !== ability.id),
                            })
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
                  Nenhuma característica racial cadastrada.
                </div>
              )}
            </section>

            <GrantedProficienciesEditor
              proficiencies={race.proficiencies ?? []}
              onChange={(proficiencies: Proficiency[]) => onChange({ ...race, proficiencies })}
              title="Proficiências raciais"
              description="Defina perícias, testes de resistência, idiomas, armas, ferramentas e conjuração com mãos ocupadas antes de criar o personagem."
              emptyMessage="Nenhuma proficiência racial cadastrada."
            />
          </div>
        ) : null}

'''
text = replace_once(text, insert_marker, custom_sections + insert_marker, "custom race features and proficiencies")
text = replace_once(
    text,
    '''      </StepSection>
    </div>
  )
}

function BackgroundStep''',
    '''      </StepSection>

      <AbilityDialog
        open={creatingAbility || editingAbility !== null}
        ability={editingAbility}
        onClose={() => {
          setCreatingAbility(false)
          setEditingAbility(null)
        }}
        onSave={saveRacialAbility}
      />
    </div>
  )
}

function BackgroundStep''',
    "custom race ability dialog",
)
# Review custom race name.
text = replace_once(
    text,
    '''        <ReviewLine label="Raça" value={race.race} />''',
    '''        <ReviewLine
          label="Raça"
          value={race.race === "custom" ? race.customName || "Personalizada" : race.race}
        />''',
    "review custom race name",
)
# Custom bonus helper before getRaceBonusSlots.
text = replace_once(
    text,
    '''function getRaceBonusSlots(
  presetId: string,''',
    '''function createCustomRaceBonusSlots(
  pattern: CustomRaceBonusPattern,
): RaceBonusSlot[] {
  return pattern === "three-ones"
    ? [
        { id: "custom-plus-one-a", amount: 1, attribute: "str", locked: false },
        { id: "custom-plus-one-b", amount: 1, attribute: "dex", locked: false },
        { id: "custom-plus-one-c", amount: 1, attribute: "con", locked: false },
      ]
    : [
        { id: "custom-plus-two", amount: 2, attribute: "str", locked: false },
        { id: "custom-plus-one", amount: 1, attribute: "dex", locked: false },
      ]
}

function getRaceBonusSlots(
  presetId: string,''',
    "custom bonus slot helper",
)
write(path, text)


# ---------------------------------------------------------------------------
# Dedicated /character/create page and navigation.
# ---------------------------------------------------------------------------
write(
    "src/views/CharacterCreateView.tsx",
    '''import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { CharacterCreationWizard } from "../features/characters/creation/characterCreationWizardV5"
import { ensureCharacterBackgroundFromHistory } from "../features/characters/creation/inferCharacterBackground"
import type { Player } from "../models/player/Player"

export function CharacterCreateView() {
  const {
    activeCharacter,
    importCharacter,
    canAssignOwners,
    knownPlayerKeys: playerKeys,
    getOwner,
    createOwner,
  } = useCharacterContext()
  const { userKey } = useSyncContext()
  const navigate = useNavigate()

  const owners = useMemo(
    () => playerKeys.map((key) => getOwner(key)),
    [getOwner, playerKeys],
  )

  const defaultOwner = useMemo(() => {
    const normalizedUserKey = userKey.trim()
    if (normalizedUserKey) return getOwner(normalizedUserKey)
    return activeCharacter?.get("owner") ?? owners[0] ?? createOwner("Jogador local")
  }, [activeCharacter, createOwner, getOwner, owners, userKey])

  const wizardOwners = useMemo(
    () => uniqueOwners([defaultOwner, ...owners]),
    [defaultOwner, owners],
  )

  return (
    <CharacterCreationWizard
      open
      mode="page"
      defaultOwner={defaultOwner}
      owners={wizardOwners}
      canAssignOwners={canAssignOwners}
      createOwner={createOwner}
      onClose={() => navigate("/character")}
      onCreate={(character) => {
        const prepared = ensureCharacterBackgroundFromHistory(character)
        const imported = importCharacter(prepared.toJSON())
        navigate(`/character/${encodeURIComponent(imported.get("id"))}/profile`, {
          replace: true,
        })
      }}
    />
  )
}

function uniqueOwners(owners: Player[]): Player[] {
  const seen = new Set<string>()
  return owners.filter((owner) => {
    const key = owner.id.trim() || owner.name.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
''',
)

path = "src/Router.tsx"
text = read(path)
text = replace_once(
    text,
    '''import {
  CharacterDetailView,
  CharacterIndexView,
} from "./views/CharacterRouteViews"''',
    '''import {
  CharacterDetailView,
  CharacterIndexView,
} from "./views/CharacterRouteViews"
import { CharacterCreateView } from "./views/CharacterCreateView"''',
    "create page router import",
)
text = replace_once(
    text,
    '''            <Route index element={<CharacterIndexView />} />
            <Route path=":characterId/:tab?" element={<CharacterDetailView />} />''',
    '''            <Route index element={<CharacterIndexView />} />
            <Route path="create" element={<CharacterCreateView />} />
            <Route path=":characterId/:tab?" element={<CharacterDetailView />} />''',
    "create page route",
)
write(path, text)

path = "src/views/CharacterView.tsx"
text = read(path)
text = text.replace('import { CharacterCreationWizard } from "../features/characters/creation/characterCreationWizardV5"\n', '')
text = text.replace('import { ensureCharacterBackgroundFromHistory } from "../features/characters/creation/inferCharacterBackground"\n', '')
text = text.replace('  const [creationOpen, setCreationOpen] = useState(false)\n', '')
start_marker = '  const creationWizard = (\n'
if start_marker in text:
    start = text.index(start_marker)
    end = text.index('\n\n  if (!characterId) {', start)
    text = text[:start] + '  if (!characterId) {' + text[end + len('\n\n  if (!characterId) {'):]
text = text.replace('onClick={() => setCreationOpen(true)}', 'onClick={() => navigate("/character/create")}')
text = text.replace('addCharacter={() => setCreationOpen(true)}', 'addCharacter={() => navigate("/character/create")}')
text = text.replace('          {creationWizard}\n', '')
text = text.replace('        {creationWizard}\n', '')
write(path, text)


# Basic verification before the build.
checks = {
    "src/models/abilities/abilityActivation.ts": [
        "export function useAbilityEffect",
        "duration === \"lasting\"",
        "next.addTemporaryHp",
        "upsertAbilityCondition",
    ],
    "src/models/characters/CharacterCondition.ts": ["sourceAbilityId?: string"],
    "src/features/characters/abilities/abilityDialog.tsx": [
        "Duração descrita",
        "Instantânea executa e termina no mesmo clique",
    ],
    "src/features/characters/creation/characterCreationWizardV4.tsx": [
        "Nome da raça",
        "Livre: +1, +1 e +1",
        "GrantedProficienciesEditor",
        "mode === \"page\"",
    ],
    "src/views/CharacterCreateView.tsx": ["mode=\"page\""],
    "src/Router.tsx": ["CharacterCreateView", "path=\"create\""],
}
for file_path, expected in checks.items():
    current = read(file_path)
    missing = [entry for entry in expected if entry not in current]
    if missing:
        raise SystemExit(f"{file_path} missing {missing}")
