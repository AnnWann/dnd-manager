from pathlib import Path


def replace_once(path: str, old: str, new: str):
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


# The bonus editor created by the first patch is intentionally visible in the
# ability editor. The action sheet below is the second half of the feature:
# resolve the roll before dispatching, show its value immediately, and send the
# same dice values to the authoritative runtime so client and server cannot
# display different rolls.

# BonusRoll: if the client supplied a resolved die value (manual or automatic),
# preserve it instead of rolling again on the authoritative server.
replace_once(
    "src/models/bonuses/BonusRoll.ts",
    '''    const supplied = suppliedRollValues[key]\n    const diceValue = bonus.roll.mode === "automatic"\n      ? rollBonusDice(dice)\n      : supplied''',
    '''    const supplied = suppliedRollValues[key]\n    const diceValue = typeof supplied === "number" && Number.isFinite(supplied)\n      ? supplied\n      : bonus.roll.mode === "automatic"\n        ? rollBonusDice(dice)\n        : supplied''',
)

# Custom-system rolls expose both the die result and the first formula total
# that consumes roll.value (for things such as Second Wind: d10 + CON).
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''export type CustomAbilityRollResolution = {\n  mode: CustomAbilityRollDefinition["mode"]\n  value: number\n  dice?: string\n}''',
    '''export type CustomAbilityRollResolution = {\n  mode: CustomAbilityRollDefinition["mode"]\n  /** Resultado bruto dos dados / valor informado. */\n  value: number\n  dice?: string\n  /** Primeiro total de uma fórmula do efeito que use roll.value. */\n  total?: number\n}''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''    roll: {\n      mode: roll.mode,\n      value: resolved.value,\n      dice: resolved.dice,\n    },\n  }\n}''',
    '''    roll: {\n      mode: roll.mode,\n      value: resolved.value,\n      dice: resolved.dice,\n      total: resolveRollFormulaTotal(\n        getEffectiveCustomAbilityActivation(type, ability).resourceChanges,\n        resolved.value,\n        definition,\n        state,\n        character,\n        type,\n        ability.values,\n      ),\n    },\n  }\n}''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''    roll: {\n      mode: action.roll.mode,\n      value: resolved.value,\n      dice: resolved.dice,\n    },\n  }\n}''',
    '''    roll: {\n      mode: action.roll.mode,\n      value: resolved.value,\n      dice: resolved.dice,\n      total: resolveRollFormulaTotal(\n        action.resourceChanges,\n        resolved.value,\n        definition,\n        state,\n        character,\n      ),\n    },\n  }\n}''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''  if (roll.mode === "manual") {\n    if (typeof suppliedRollValue !== "number" || !Number.isFinite(suppliedRollValue)) {\n      throw new Error(`Informe o resultado da rolagem antes de usar esta ${subject}.`)\n    }\n    return {\n      value: suppliedRollValue,\n      dice: roll.dice?.trim()\n        ? resolveCustomRollDiceExpression(\n            roll.dice,\n            definition,\n            state,\n            character,\n            abilityType,\n            abilityValues,\n          )\n        : undefined,\n    }\n  }''',
    '''  if (typeof suppliedRollValue === "number" && Number.isFinite(suppliedRollValue)) {\n    return {\n      value: suppliedRollValue,\n      dice: roll.dice?.trim()\n        ? resolveCustomRollDiceExpression(\n            roll.dice,\n            definition,\n            state,\n            character,\n            abilityType,\n            abilityValues,\n          )\n        : undefined,\n    }\n  }\n\n  if (roll.mode === "manual") {\n    throw new Error(`Informe o resultado da rolagem antes de usar esta ${subject}.`)\n  }''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''function replaceRollValueForAbility(''',
    '''function resolveRollFormulaTotal(\n  changes: Array<{ formula?: string }> | undefined,\n  rollValue: number,\n  definition: CustomSystemDefinition,\n  state: CharacterCustomSystemState,\n  character: CharacterTemplate,\n  abilityType?: CustomAbilityTypeDefinition,\n  abilityValues?: Record<string, JsonValue>,\n): number {\n  for (const change of changes ?? []) {\n    if (!change.formula?.includes("roll.value")) continue\n    const replaced = replaceRollToken(change.formula, rollValue)\n    if (!replaced) continue\n    const result = evaluateCustomFormula(\n      replaced,\n      definition,\n      state,\n      character,\n      abilityType ? { type: abilityType, values: abilityValues } : undefined,\n    )\n    if (result.ok && typeof result.value === "number" && Number.isFinite(result.value)) {\n      return result.value\n    }\n  }\n  return rollValue\n}\n\nfunction replaceRollValueForAbility(''',
)

# /user action sheet: pre-resolve native ability bonus rolls and custom-system
# rolls, keep the modal open, and show raw dice + formula total immediately.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    'import { activateCustomAbilityWithRoll } from "../../../lib/customSystems/CustomAbilityRoll"',
    'import { activateCustomAbilityWithRoll, activateCustomSystemActionWithRoll } from "../../../lib/customSystems/CustomAbilityRoll"',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''import {\n  activateCustomSystemAction,\n  getEffectiveCustomAbilityActivation,\n} from "../../../lib/customSystems/CustomSystemActions"''',
    '''import {\n  getEffectiveCustomAbilityActivation,\n} from "../../../lib/customSystems/CustomSystemActions"''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport { hasManualBonusRolls, resolveBonusCollectionRolls } from "../../../models/bonuses/BonusRoll"',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''  const [manualRollValue, setManualRollValue] = useState("")''',
    '''  const [manualRollValue, setManualRollValue] = useState("")\n  const [rollFeedback, setRollFeedback] = useState<Array<{\n    label: string\n    dice?: string\n    diceValue: number\n    formulaBonus?: number\n    total: number\n  }>>([])''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''    setError("")\n    setManualRollValue("")''',
    '''    setError("")\n    setManualRollValue("")\n    setRollFeedback([])''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''    optionId?: string,\n    resourceSelection?: AbilityResourceSelection,\n  ) {''',
    '''    optionId?: string,\n    resourceSelection?: AbilityResourceSelection,\n    bonusRollValues?: Record<string, number>,\n  ) {''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''    if (\n      action === "use" &&\n      entry.ability &&\n      (hasAbilityResourceCosts(entry.ability) || entry.ability.resourceUpcast?.enabled)\n    ) {''',
    '''    if (\n      action === "use" &&\n      entry.ability &&\n      (hasAbilityResourceCosts(entry.ability) || entry.ability.resourceUpcast?.enabled)\n    ) {''',
)
# Insert native roll resolution immediately before the session-runtime branch.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''    if (sessionRuntime) {\n      if (sessionRuntime.status !== "connected") {''',
    '''    let resolvedBonusRollValues = bonusRollValues\n    let hasResolvedRolls = false\n    if (action === "use" && entry.ability) {\n      try {\n        const resolved = resolveBonusCollectionRolls(\n          character,\n          entry.ability.bonuses,\n          bonusRollValues,\n        )\n        if (resolved.results.length > 0) {\n          hasResolvedRolls = true\n          resolvedBonusRollValues = Object.fromEntries(\n            resolved.results.map((result) => [result.key, result.diceValue]),\n          )\n          setRollFeedback(resolved.results.map((result) => ({\n            label: result.label,\n            dice: result.dice,\n            diceValue: result.diceValue,\n            formulaBonus: result.formulaBonus,\n            total: result.total,\n          })))\n        }\n      } catch (caught) {\n        setError(caught instanceof Error ? caught.message : "Não foi possível resolver a rolagem da habilidade.")\n        return\n      }\n    }\n\n    if (sessionRuntime) {\n      if (sessionRuntime.status !== "connected") {''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''        ...(action === "use" && resourceSelection\n          ? { resourceSelection }\n          : {}),\n      })''',
    '''        ...(action === "use" && resourceSelection\n          ? { resourceSelection }\n          : {}),\n        ...(action === "use" && resolvedBonusRollValues\n          ? { bonusRollValues: resolvedBonusRollValues }\n          : {}),\n      })''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''      setAbilityResourceEntry(null)\n      setSelected(null)\n      return''',
    '''      setAbilityResourceEntry(null)\n      if (!hasResolvedRolls) setSelected(null)\n      return''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '? paidCurrent.useEquipmentAbility(source.itemId, source.abilityId)',
    '? paidCurrent.useEquipmentAbility(source.itemId, source.abilityId, resolvedBonusRollValues)',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '? useAbilityEffect(paidCurrent, ability, { type: "race", sourceLabel: "Raça" }, optionId)',
    '? useAbilityEffect(paidCurrent, ability, { type: "race", sourceLabel: "Raça" }, optionId, resolvedBonusRollValues)',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '? useCharacterAbility(paidCurrent, source.abilityId, optionId)',
    '? useCharacterAbility(paidCurrent, source.abilityId, optionId, resolvedBonusRollValues)',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''    setAbilityResourceEntry(null)\n    setSelected(null)\n  }\n\n  function useCustomSystemAction''',
    '''    setAbilityResourceEntry(null)\n    if (!hasResolvedRolls) setSelected(null)\n  }\n\n  function useCustomSystemAction''',
)

# Custom-system action button now supports the same automatic/manual roll flow.
start = '''  function useCustomSystemAction(entry: ActionEntry) {\n    const source = entry.customSystemActionSource\n    if (!source) return\n    try {\n      setError("")'''
replacement = '''  function useCustomSystemAction(entry: ActionEntry) {\n    const source = entry.customSystemActionSource\n    if (!source) return\n    try {\n      setError("")\n      let rollValue: number | undefined\n      if (entry.customAbilityRoll?.mode === "manual") {\n        const raw = manualRollValue.trim()\n        if (!raw || !Number.isFinite(Number(raw))) {\n          setError("Informe um resultado numérico válido para a rolagem.")\n          return\n        }\n        rollValue = Number(raw)\n      }\n      const resolved = activateCustomSystemActionWithRoll(\n        character,\n        definitions,\n        source.systemId,\n        source.actionId,\n        rollValue,\n      )\n      if (resolved.roll) {\n        rollValue = resolved.roll.value\n        setRollFeedback([{\n          label: entry.customAbilityRoll?.label?.trim() || entry.name,\n          dice: resolved.roll.dice,\n          diceValue: resolved.roll.value,\n          formulaBonus: (resolved.roll.total ?? resolved.roll.value) - resolved.roll.value,\n          total: resolved.roll.total ?? resolved.roll.value,\n        }])\n      }'''
replace_once("src/features/characters/characterSheet/minimalCharacterActions.tsx", start, replacement)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''          actionId: source.actionId,\n        })''',
    '''          actionId: source.actionId,\n          ...(rollValue !== undefined ? { rollValue } : {}),\n        })''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''        setSelected(null)\n        return\n      }\n\n      updateCharacter(character.get("id"), (current) =>\n        activateCustomSystemAction(\n          current,\n          definitions,\n          source.systemId,\n          source.actionId,\n        ),\n      )\n      setSelected(null)''',
    '''        if (!resolved.roll) setSelected(null)\n        return\n      }\n\n      updateCharacter(character.get("id"), () => resolved.character)\n      if (!resolved.roll) setSelected(null)''',
)

# Custom ability: resolve once on the client, display it, and send that same
# value to the server (automatic rolls included).
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''      const costError = customAbilityCostError(\n        resolveCustomAbilityCosts(character, definitions, source, rollValue),\n      )''',
    '''      const resolved = activateCustomAbilityWithRoll(\n        character,\n        definitions,\n        source.systemId,\n        source.abilityId,\n        rollValue,\n      )\n      if (resolved.roll) {\n        rollValue = resolved.roll.value\n        setRollFeedback([{\n          label: entry.customAbilityRoll?.label?.trim() || entry.name,\n          dice: resolved.roll.dice,\n          diceValue: resolved.roll.value,\n          formulaBonus: (resolved.roll.total ?? resolved.roll.value) - resolved.roll.value,\n          total: resolved.roll.total ?? resolved.roll.value,\n        }])\n      }\n\n      const costError = customAbilityCostError(\n        resolveCustomAbilityCosts(character, definitions, source, rollValue),\n      )''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''        setSelected(null)\n        return\n      }\n\n      const next = activateCustomAbilityWithRoll(\n        character,\n        definitions,\n        source.systemId,\n        source.abilityId,\n        rollValue,\n      ).character\n      updateCharacter(character.get("id"), () => next)\n      setSelected(null)''',
    '''        if (!resolved.roll) setSelected(null)\n        return\n      }\n\n      updateCharacter(character.get("id"), () => resolved.character)\n      if (!resolved.roll) setSelected(null)''',
)

# System actions advertise their roll in the same modal UI used by custom abilities.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''        customSystemActionSource: {\n          systemId: definition.id,\n          actionId: action.id,\n        },''',
    '''        customAbilityRoll: action.roll,\n        customSystemActionSource: {\n          systemId: definition.id,\n          actionId: action.id,\n        },''',
)

# Result card shown in the action modal immediately after the use succeeds.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>''',
    '''            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>\n            {rollFeedback.length > 0 ? (\n              <div className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg/30 p-3">\n                <div className="text-xs font-semibold text-textH">Resultado da rolagem</div>\n                {rollFeedback.map((result, index) => (\n                  <div key={`${result.label}-${index}`} className="rounded-lg border border-border bg-bg px-3 py-2 text-xs">\n                    <div className="font-semibold text-textH">{result.label}</div>\n                    <div className="mt-1 text-textMuted">\n                      {result.dice ? `${result.dice} = ` : "Dado = "}\n                      <span className="font-semibold text-textH">{result.diceValue}</span>\n                      {result.formulaBonus ? (\n                        <> {result.formulaBonus > 0 ? "+" : "−"} {Math.abs(result.formulaBonus)} de fórmula</>\n                      ) : null}\n                    </div>\n                    <div className="mt-1 font-semibold text-accent">Total: {result.total}</div>\n                  </div>\n                ))}\n              </div>\n            ) : null}''',
)

# Manual native bonus rolls need the activation modal even if there is no other
# resource configuration.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''                ) : hasAbilityResourceCosts(selected.ability) || selected.ability.resourceUpcast?.enabled ? (''',
    '''                ) : hasAbilityResourceCosts(selected.ability) || selected.ability.resourceUpcast?.enabled || hasManualBonusRolls(selected.ability.bonuses) ? (''',
)
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''          onConfirm={(optionId, resourceSelection) =>\n            changeAbilityState(abilityResourceEntry, "use", optionId, resourceSelection)\n          }''',
    '''          onConfirm={(optionId, resourceSelection, bonusRollValues) =>\n            changeAbilityState(abilityResourceEntry, "use", optionId, resourceSelection, bonusRollValues)\n          }''',
)

# Manual custom-system action button follows the same validation as a custom ability.
replace_once(
    "src/features/characters/characterSheet/minimalCharacterActions.tsx",
    '''                <Button variant="primary" onClick={() => useCustomSystemAction(selected)}>Usar</Button>''',
    '''                <Button\n                  variant="primary"\n                  disabled={selected.customAbilityRoll?.mode === "manual" && !isFiniteInput(manualRollValue)}\n                  onClick={() => useCustomSystemAction(selected)}\n                >Usar</Button>''',
)

# Remove the temporary one-off scripts/workflow after the validated commit.
for temporary in [
    ".github/apply_ability_roll_affinity_fixes.py",
    ".github/repair_ability_roll_patcher.py",
    ".github/apply_front_roll_feedback.py",
    ".github/workflows/apply-ability-roll-master.yml",
]:
    Path(temporary).unlink(missing_ok=True)
