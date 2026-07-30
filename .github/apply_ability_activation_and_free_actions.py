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


# Ability effect duration model.
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    "  actionKind?: AbilityActionKind\n  trigger?: Trigger",
    "  actionKind?: AbilityActionKind\n  effectDuration?: AbilityEffectDuration\n  trigger?: Trigger",
    "ability effect duration field",
)
text = replace_once(
    text,
    "export type AbilityActionKind = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'free'",
    "export type AbilityActionKind = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'free'\n\nexport type AbilityEffectDuration = 'instant' | 'lasting'",
    "ability effect duration type",
)
write(path, text)


# Central activation semantics.
write(
    "src/models/abilities/abilityActivation.ts",
    '''import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type {
  Ability,
  AbilityEffectDuration,
  Usage,
} from "./Ability"

export function getAbilityEffectDuration(
  ability: Ability,
): AbilityEffectDuration {
  if ((ability.kind ?? "active") !== "active") return "lasting"
  return ability.effectDuration ?? "instant"
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

export function activateAbilityBenefits(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!abilityRequiresActivation(ability)) return ability
  if (!canActivateAbility(character, ability)) return ability

  const usage = ability.usage
  return {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "active"
        ? getAbilityEffectDuration(ability)
        : ability.effectDuration,
    benefitsActive: true,
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
  const normalized = {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "active"
        ? getAbilityEffectDuration(ability)
        : ability.effectDuration,
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
    benefitsActive: normalized.benefitsActive === true,
  }
}
''',
)


# Ability editor: select Instantânea or Duradoura.
path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    "  AbilityCategory,\n  AbilityKind,",
    "  AbilityCategory,\n  AbilityEffectDuration,\n  AbilityKind,",
    "ability duration import",
)
text = replace_once(
    text,
    '    actionKind: "action",\n    trigger: "always",',
    '    actionKind: "action",\n    effectDuration: "instant",\n    trigger: "always",',
    "default instant ability",
)
trigger_label = '''          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>'''
duration_and_trigger = '''          {draft.kind === "active" ? (
            <label className="grid max-w-sm gap-1">
              <span className="text-xs font-medium text-textH">
                Duração do efeito
              </span>
              <Select
                value={draft.effectDuration ?? "instant"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    effectDuration: event.target.value as AbilityEffectDuration,
                    benefitsActive: false,
                  })
                }
              >
                <option value="instant">Instantânea</option>
                <option value="lasting">Duradoura</option>
              </Select>
              <span className="text-[10px] text-textMuted">
                Instantânea permanece ativa somente durante a resolução daquele uso.
              </span>
            </label>
          ) : null}

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>'''
text = replace_once(text, trigger_label, duration_and_trigger, "ability duration selector")
old_help = '''          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "active"
                ? "Habilidades ativas só aplicam seus bônus, proficiências e magias depois de Usar, mesmo sem contador de usos."
                : `${draft.kind === "feature" ? "Esta característica" : "Esta passiva"} possui um gatilho. Seus bônus, proficiências e magias só ficam ativos depois de Acionar.`
              : draft.kind === "feature"
                ? "Esta característica não possui condição e concede seus benefícios permanentemente. Ela não aparece na seção de ações."
                : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>'''
new_help = '''          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "active"
                ? draft.effectDuration === "lasting"
                  ? "Esta habilidade é duradoura. Seus benefícios entram em vigor ao Usar e permanecem até Encerrar efeito."
                  : "Esta habilidade é instantânea. Seus benefícios entram em vigor ao Usar e permanecem apenas enquanto o uso estiver em resolução; depois selecione Concluir uso."
                : `${draft.kind === "feature" ? "Esta característica" : "Esta passiva"} possui um gatilho. Seus bônus, proficiências e magias só ficam ativos depois de Acionar.`
              : draft.kind === "feature"
                ? "Esta característica não possui condição e concede seus benefícios permanentemente. Ela não aparece na seção de ações."
                : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>'''
text = replace_once(text, old_help, new_help, "ability duration explanation")
write(path, text)


# Detailed ability card states and controls.
path = "src/features/characters/abilities/abilityCard.tsx"
text = read(path)
text = replace_once(
    text,
    "  abilityRequiresActivation,\n  isAbilityBenefitsActive,",
    "  abilityRequiresActivation,\n  getAbilityEffectDuration,\n  isAbilityBenefitsActive,",
    "detailed duration import",
)
text = replace_once(
    text,
    '''  const benefitsActive = isAbilityBenefitsActive(ability)
  const canTrigger =
    requiresActivation &&
    Boolean(onUse) &&
    ((ability.kind ?? "active") === "active" || !benefitsActive)''',
    '''  const benefitsActive = isAbilityBenefitsActive(ability)
  const isInstant =
    (ability.kind ?? "active") === "active" &&
    getAbilityEffectDuration(ability) === "instant"
  const canTrigger =
    requiresActivation &&
    Boolean(onUse) &&
    !benefitsActive''',
    "detailed instant state",
)
old_status = '''            {benefitsActive
              ? requiresActivation
                ? "Benefícios ativos"
                : "Sempre ativa"
              : "Aguardando acionamento"}'''
new_status = '''            {benefitsActive
              ? requiresActivation
                ? isInstant
                  ? "Uso instantâneo em resolução"
                  : "Benefícios ativos"
                : "Sempre ativa"
              : (ability.kind ?? "active") === "active"
                ? "Aguardando uso"
                : "Aguardando acionamento"}'''
text = replace_once(text, old_status, new_status, "detailed status label")
text = replace_once(
    text,
    '''          <Button size="sm" variant="ghost" onClick={onDeactivate}>
            Encerrar efeito
          </Button>''',
    '''          <Button size="sm" variant="ghost" onClick={onDeactivate}>
            {isInstant ? "Concluir uso" : "Encerrar efeito"}
          </Button>''',
    "detailed conclude button",
)
write(path, text)


# Compact card states and controls.
path = "src/features/characters/abilities/compactAbilityCard.tsx"
text = read(path)
text = replace_once(
    text,
    "  abilityRequiresActivation,\n  isAbilityBenefitsActive,",
    "  abilityRequiresActivation,\n  getAbilityEffectDuration,\n  isAbilityBenefitsActive,",
    "compact duration import",
)
text = replace_once(
    text,
    '''  const benefitsActive = isAbilityBenefitsActive(ability)
  const canUse =
    requiresActivation &&
    Boolean(onUse) &&
    ((ability.kind ?? "active") === "active" || !benefitsActive)''',
    '''  const benefitsActive = isAbilityBenefitsActive(ability)
  const isInstant =
    (ability.kind ?? "active") === "active" &&
    getAbilityEffectDuration(ability) === "instant"
  const canUse =
    requiresActivation &&
    Boolean(onUse) &&
    !benefitsActive''',
    "compact instant state",
)
text = replace_once(
    text,
    '''              <Button className="min-w-0 flex-1 sm:flex-none" size="sm" variant="ghost" onClick={onDeactivate}>
                Encerrar
              </Button>''',
    '''              <Button className="min-w-0 flex-1 sm:flex-none" size="sm" variant="ghost" onClick={onDeactivate}>
                {isInstant ? "Concluir" : "Encerrar"}
              </Button>''',
    "compact conclude button",
)
write(path, text)


# Wire duration controls into the abilities tab; this also fixes the previously missing deactivation action.
path = "src/features/characters/abilities/characterAbilities.tsx"
text = read(path)
text = replace_once(
    text,
    '<option value="all">Ativas e passivas</option>',
    '<option value="all">Ativas, passivas e características</option>',
    "ability filter label",
)
text = replace_once(
    text,
    '''                      sourceLabel={sourceLabel}
                      onEdit={editAbility}''',
    '''                      sourceLabel={sourceLabel}
                      usageMax={usageMax}
                      onEdit={editAbility}''',
    "compact usage max prop",
)
text = replace_once(
    text,
    '''                      onUse={() => useAbility(ability.id)}
                      onRestore={() => restoreAbility(ability.id)}''',
    '''                      onUse={() => useAbility(ability.id)}
                      onDeactivate={() => deactivateAbility(ability.id)}
                      onRestore={() => restoreAbility(ability.id)}''',
    "compact deactivate prop",
)
text = replace_once(
    text,
    '''                    sourceLabel={sourceLabel}
                    onEdit={editAbility}''',
    '''                    sourceLabel={sourceLabel}
                    usageMax={usageMax}
                    onEdit={editAbility}''',
    "detailed usage max prop",
)
text = replace_once(
    text,
    '''                    onUse={() => useAbility(ability.id)}
                    onRestore={() => restoreAbility(ability.id)}''',
    '''                    onUse={() => useAbility(ability.id)}
                    onDeactivate={() => deactivateAbility(ability.id)}
                    onRestore={() => restoreAbility(ability.id)}''',
    "detailed deactivate prop",
)
write(path, text)


# Minimal sheet action modal understands instant effects.
path = "src/features/characters/characterSheet/minimalCharacterActions.tsx"
text = read(path)
text = replace_once(
    text,
    "  getAbilityUsageMax,\n  isAbilityBenefitsActive,",
    "  getAbilityEffectDuration,\n  getAbilityUsageMax,\n  isAbilityBenefitsActive,",
    "minimal duration import",
)
text = replace_once(
    text,
    '''                  <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>
                    Encerrar efeito
                  </Button>''',
    '''                  <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>
                    {(selected.ability.kind ?? "active") === "active" &&
                    getAbilityEffectDuration(selected.ability) === "instant"
                      ? "Concluir uso"
                      : "Encerrar efeito"}
                  </Button>''',
    "minimal conclude button",
)
text = replace_once(
    text,
    '''                {((selected.ability.kind ?? "active") === "active" || !isAbilityBenefitsActive(selected.ability)) ? (
                  <Button variant="primary" onClick={() => changeAbilityState(selected, "use")}>
                    {(selected.ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
                  </Button>
                ) : null}''',
    '''                {!isAbilityBenefitsActive(selected.ability) ? (
                  <Button variant="primary" onClick={() => changeAbilityState(selected, "use")}>
                    {(selected.ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}
                  </Button>
                ) : null}''',
    "minimal prevent repeated use",
)
write(path, text)


# Instant effects cannot remain stuck across rests.
path = "src/models/characters/characterRest.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Ability, AbilityUsageResetKind, Usage } from "../abilities/Ability"',
    'import type { Ability, AbilityUsageResetKind, Usage } from "../abilities/Ability"\nimport { getAbilityEffectDuration } from "../abilities/abilityActivation"',
    "rest duration import",
)
old_reset = '''  return abilities.map((ability) => {
    if (!ability.usage || !shouldReset(ability.usage.reset, restKind)) {
      return ability
    }

    return {
      ...ability,
      usage: restoreUsage(ability.usage, recoveryFraction),
    }
  })'''
new_reset = '''  return abilities.map((ability) => {
    const clearInstantEffect =
      getAbilityEffectDuration(ability) === "instant" &&
      ability.benefitsActive === true
    const shouldRestoreUsage =
      ability.usage && shouldReset(ability.usage.reset, restKind)

    if (!clearInstantEffect && !shouldRestoreUsage) return ability

    return {
      ...ability,
      benefitsActive: clearInstantEffect ? false : ability.benefitsActive,
      modifiersActive: clearInstantEffect ? undefined : ability.modifiersActive,
      usage: shouldRestoreUsage && ability.usage
        ? restoreUsage(ability.usage, recoveryFraction)
        : ability.usage,
    }
  })'''
text = replace_once(text, old_reset, new_reset, "clear instant effects on rest")
write(path, text)


# Formula values are now calculated lazily, avoiding a speed formula recalculating itself.
path = "src/lib/customSystems/CharacterFormulaVariables.ts"
text = read(path)
start = text.index("export function getCharacterFormulaValues(")
end = text.index("function variable(", start)
replacement = '''export function getCharacterFormulaValues(
  character?: CharacterTemplate,
  requestedPaths?: Iterable<string>,
): CharacterFormulaValues {
  const paths = requestedPaths
    ? Array.from(new Set(requestedPaths))
    : listCharacterFormulaVariables().map((entry) => entry.path)

  if (!character) return createEmptyValues(paths)

  const sheet = character.get('sheet')
  const values: CharacterFormulaValues = {}

  for (const path of paths) {
    if (path === 'character.level') {
      values[path] = (sheet.classes ?? []).reduce(
        (total, entry) => total + Math.max(0, Number(entry.level) || 0),
        0,
      )
      continue
    }
    if (path === 'character.proficiencyBonus') {
      values[path] = character.getProficiencyBonus()
      continue
    }
    if (path === 'character.armorClass') {
      values[path] = character.getEffectiveArmorClass()
      continue
    }
    if (path === 'character.initiative') {
      values[path] = character.getEffectiveInitiative()
      continue
    }
    if (path === 'character.passivePerception') {
      values[path] = character.getEffectivePassivePerception()
      continue
    }
    if (path === 'character.mobility') {
      values[path] = character.getEffectiveMobility()
      continue
    }
    if (path === 'character.hp.current') {
      values[path] = Number(sheet.HP.current) || 0
      continue
    }
    if (path === 'character.hp.maximum') {
      values[path] = character.getEffectiveMaxHp()
      continue
    }
    if (path === 'character.hp.temporary') {
      values[path] = character.getEffectiveTemporaryHp()
      continue
    }
    if (path === 'character.exhaustion') {
      values[path] = Math.max(0, Number(sheet.stats.exhaustion) || 0)
      continue
    }
    if (path === 'character.inspiration') {
      values[path] = Boolean(sheet.stats.inspiration)
      continue
    }

    const attribute = ATTRIBUTES.find(({ id }) =>
      path === `character.attribute.${id}` ||
      path === `character.attributeModifier.${id}` ||
      path === `character.save.${id}`
    )
    if (attribute) {
      if (path === `character.attribute.${attribute.id}`) {
        values[path] = character.getEffectiveAttribute(attribute.id)
      } else if (path === `character.attributeModifier.${attribute.id}`) {
        values[path] = character.getEffectiveAttributeModifier(attribute.id)
      } else {
        values[path] = character.getSavingThrowBonus(attribute.id)
      }
      continue
    }

    const classDefinition = CLASSES.find(({ id }) =>
      path === `character.class.${id}.level` ||
      path === `character.class.${id}.present`
    )
    if (classDefinition) {
      const level = Math.max(
        0,
        Number(character.getClassLevel(classDefinition.id)) || 0,
      )
      values[path] = path.endsWith('.present') ? level > 0 : level
      continue
    }

    const skill = SKILLS.find(({ id }) => path === `character.skill.${id}`)
    if (skill) {
      const modifier = character.getEffectiveAttributeModifier(skill.attribute)
      const proficiency = sheet.skills?.[skill.id] ?? 'none'
      const multiplier =
        proficiency === 'expertise'
          ? 2
          : proficiency === 'proficient'
            ? 1
            : 0
      values[path] = modifier + character.getProficiencyBonus() * multiplier
    }
  }

  return values
}

function createEmptyValues(
  requestedPaths: Iterable<string> = listCharacterFormulaVariables().map(
    (entry) => entry.path,
  ),
): CharacterFormulaValues {
  const definitions = new Map(
    listCharacterFormulaVariables().map((entry) => [entry.path, entry]),
  )

  return Object.fromEntries(
    Array.from(requestedPaths).map((path) => {
      const entry = definitions.get(path)
      return [
        path,
        entry?.valueType === 'boolean'
          ? false
          : entry?.valueType === 'text'
            ? ''
            : 0,
      ]
    }),
  )
}

'''
text = text[:start] + replacement + text[end:]
write(path, text)

path = "src/lib/customSystems/CharacterSheetFormula.ts"
text = read(path)
text = replace_once(
    text,
    '''    const result = evaluateWithValues(formula, getCharacterFormulaValues(character))''',
    '''    const referencedPaths = listCharacterFormulaVariables()
      .map((variable) => variable.path)
      .filter((path) => containsIdentifier(formula, path))
    const result = evaluateWithValues(
      formula,
      getCharacterFormulaValues(character, referencedPaths),
    )''',
    "lazy formula variables",
)
text += '''

function containsIdentifier(expression: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')
  return new RegExp(
    '(^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])',
  ).test(expression)
}
'''
write(path, text)


# Structural assertions.
checks = {
    "src/models/abilities/Ability.ts": ["AbilityEffectDuration", "effectDuration?:"],
    "src/models/abilities/abilityActivation.ts": ["getAbilityEffectDuration", "return ability.effectDuration ?? \"instant\""],
    "src/features/characters/abilities/abilityDialog.tsx": ["Duração do efeito", "Instantânea", "Duradoura"],
    "src/features/characters/abilities/characterAbilities.tsx": ["onDeactivate={() => deactivateAbility(ability.id)}", "usageMax={usageMax}"],
    "src/features/characters/characterSheet/minimalCharacterActions.tsx": ["Concluir uso", "getAbilityEffectDuration"],
    "src/lib/customSystems/CharacterSheetFormula.ts": ["referencedPaths", "containsIdentifier"],
}
for file_path, expected in checks.items():
    current = read(file_path)
    missing = [entry for entry in expected if entry not in current]
    if missing:
        raise SystemExit(f"{file_path} missing {missing}")
