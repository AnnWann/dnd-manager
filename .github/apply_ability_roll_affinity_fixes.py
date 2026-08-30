from pathlib import Path


def replace_once(path: str, old: str, new: str):
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))


# CharacterTemplate: propagate manual roll values through the convenience API.
replace_once(
    "src/models/characters/CharacterTemplate.ts",
    '  useAbility(abilityId: string, activationOptionId?: string): CharacterTemplate {return useAbility(this, abilityId, activationOptionId)}',
    '  useAbility(abilityId: string, activationOptionId?: string, bonusRollValues?: Record<string, number>): CharacterTemplate {return useAbility(this, abilityId, activationOptionId, bonusRollValues)}',
)
replace_once(
    "src/models/characters/CharacterTemplate.ts",
    '  useEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return useEquipmentAbility(this, itemId, abilityId)}',
    '  useEquipmentAbility(itemId: string, abilityId: string, bonusRollValues?: Record<string, number>): CharacterTemplate {return useEquipmentAbility(this, itemId, abilityId, bonusRollValues)}',
)

# Equipment abilities use the same roll resolver as regular/racial abilities.
replace_once(
    "src/models/characters/characterEquipment.ts",
    '''export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {''',
    '''export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
  bonusRollValues?: Record<string, number>,
): CharacterTemplate {''',
)
replace_once(
    "src/models/characters/characterEquipment.ts",
    '''      sourceLabel: `Equipamento: ${sourceItemName}`,
    },
  )
}''',
    '''      sourceLabel: `Equipamento: ${sourceItemName}`,
    },
    undefined,
    bonusRollValues,
  )
}''',
)

# Ability editor: expose per-bonus automatic/manual roll configuration.
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    'import { AbilityAdvancedEffectsEditor } from "./abilityAdvancedEffectsEditor"',
    'import { AbilityAdvancedEffectsEditor } from "./abilityAdvancedEffectsEditor"\nimport { AbilityBonusRollEditor } from "./abilityBonusRollEditor"',
)
replace_once(
    "src/features/characters/abilities/abilityDialog.tsx",
    '''            <BonusesFields
              bonuses={draft.bonuses ?? {}}
              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}
              description="Aplique modificadores enquanto os benefícios desta habilidade estiverem ativos."
            />''',
    '''            <BonusesFields
              bonuses={draft.bonuses ?? {}}
              character={character}
              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}
              description="Aplique modificadores enquanto os benefícios desta habilidade estiverem ativos."
            />
            <AbilityBonusRollEditor
              bonuses={draft.bonuses ?? {}}
              character={character}
              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}
            />''',
)

# Activation modal: manual bonus dice are entered before the ability is used.
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    'import { Button } from "../../../components/ui/Button"',
    'import { Button } from "../../../components/ui/Button"\nimport { Input } from "../../../components/ui/Input"',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport { listBonusRollRequirements } from "../../../models/bonuses/BonusRoll"',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '  onConfirm: (optionId: string | undefined, selection: AbilityResourceSelection | undefined) => void',
    '  onConfirm: (optionId: string | undefined, selection: AbilityResourceSelection | undefined, bonusRollValues?: Record<string, number>) => void',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '''  const [alternatives, setAlternatives] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (ability.resourceCosts ?? [])
        .filter((group) => group.mode === "oneOf" && group.costs[0])
        .map((group) => [group.id, group.costs[0]!.id]),
    ),
  )''',
    '''  const [alternatives, setAlternatives] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (ability.resourceCosts ?? [])
        .filter((group) => group.mode === "oneOf" && group.costs[0])
        .map((group) => [group.id, group.costs[0]!.id]),
    ),
  )
  const manualRollRequirements = useMemo(
    () => listBonusRollRequirements(ability.bonuses).filter((entry) => entry.mode === "manual"),
    [ability.bonuses],
  )
  const [manualRollValues, setManualRollValues] = useState<Record<string, string>>({})''',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '''  const payment = canPayAbilityResourceCosts(character, ability, selection)
  const optionRequired = (ability.activationOptions?.length ?? 0) > 0
  const canConfirm = payment.ok && (!optionRequired || Boolean(optionId))''',
    '''  const payment = canPayAbilityResourceCosts(character, ability, selection)
  const optionRequired = (ability.activationOptions?.length ?? 0) > 0
  const manualRollsValid = manualRollRequirements.every((entry) => {
    const raw = manualRollValues[entry.key]?.trim() ?? ""
    return raw !== "" && Number.isFinite(Number(raw))
  })
  const canConfirm = payment.ok && (!optionRequired || Boolean(optionId)) && manualRollsValid''',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '''        {!payment.ok ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">''',
    '''        {manualRollRequirements.length > 0 ? (
          <div className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg/20 p-3">
            <div>
              <div className="text-xs font-semibold text-textH">Rolagens manuais dos bônus</div>
              <p className="mt-1 text-[11px] leading-5 text-textMuted">
                Informe apenas o resultado dos dados. O bônus por fórmula é calculado e somado automaticamente.
              </p>
            </div>
            {manualRollRequirements.map((entry) => (
              <label key={entry.key} className="grid gap-1">
                <span className="text-xs font-medium text-textH">{entry.label}</span>
                <span className="text-[10px] text-textMuted">Role {entry.dice}{entry.formula?.trim() ? " + fórmula" : ""}.</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={manualRollValues[entry.key] ?? ""}
                  placeholder="Resultado dos dados"
                  onChange={(event) => setManualRollValues((current) => ({
                    ...current,
                    [entry.key]: event.target.value,
                  }))}
                />
              </label>
            ))}
          </div>
        ) : null}

        {!payment.ok ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">''',
)
replace_once(
    "src/features/characters/abilities/abilityResourceActivationModal.tsx",
    '            onClick={() => onConfirm(optionId || undefined, selection)}',
    '''            onClick={() => onConfirm(
              optionId || undefined,
              selection,
              manualRollRequirements.length
                ? Object.fromEntries(
                    manualRollRequirements.map((entry) => [entry.key, Number(manualRollValues[entry.key])]),
                  )
                : undefined,
            )}''',
)

# Ability sheet: open the modal when manual bonus rolls exist and propagate values.
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    'import { hasAbilityResourceCosts, spendAbilityResourceCosts } from "../../../models/abilities/abilityResourceCosts"',
    'import { hasAbilityResourceCosts, spendAbilityResourceCosts } from "../../../models/abilities/abilityResourceCosts"\nimport { hasManualBonusRolls } from "../../../models/bonuses/BonusRoll"',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '    if ((ability.activationOptions?.length ?? 0) > 0 || hasAbilityResourceCosts(ability) || ability.resourceUpcast?.enabled) {',
    '    if ((ability.activationOptions?.length ?? 0) > 0 || hasAbilityResourceCosts(ability) || ability.resourceUpcast?.enabled || hasManualBonusRolls(ability.bonuses)) {',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '  function useAbility(id: string, optionId?: string, resourceSelection?: AbilityResourceSelection) {',
    '  function useAbility(id: string, optionId?: string, resourceSelection?: AbilityResourceSelection, bonusRollValues?: Record<string, number>) {',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''        source,
        activationOptionId: optionId,
        resourceSelection,
      })) {''',
    '''        source,
        abilityName: ability.name,
        activationOptionId: optionId,
        resourceSelection,
        bonusRollValues,
      })) {''',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '        return paidCharacter.useEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)',
    '        return paidCharacter.useEquipmentAbility(ability.sourceItemId, ability.originalAbilityId, bonusRollValues)',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''          "use",
          optionId,
        )''',
    '''          "use",
          optionId,
          bonusRollValues,
        )''',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '      return useCharacterAbility(paidCharacter, id, optionId)',
    '      return useCharacterAbility(paidCharacter, id, optionId, bonusRollValues)',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '          onConfirm={(optionId, resourceSelection) => useAbility(activationChoice.id, optionId, resourceSelection)}',
    '          onConfirm={(optionId, resourceSelection, bonusRollValues) => useAbility(activationChoice.id, optionId, resourceSelection, bonusRollValues)}',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''  action: "use" | "restore" | "deactivate",
  optionId?: string,
): CharacterTemplate {''',
    '''  action: "use" | "restore" | "deactivate",
  optionId?: string,
  bonusRollValues?: Record<string, number>,
): CharacterTemplate {''',
)
replace_once(
    "src/features/characters/abilities/characterAbilities.tsx",
    '''      sourceLabel: "Raça",
    }, optionId)''',
    '''      sourceLabel: "Raça",
    }, optionId, bonusRollValues)''',
)

# Authoritative ability server: accept manual values and log resolved automatic/manual rolls.
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    'import { normalizeDamageAffinities } from "../../../../../src/models/combat/Damage";',
    'import { normalizeDamageAffinities } from "../../../../../src/models/combat/Damage";\nimport { listResolvedBonusRolls } from "../../../../../src/models/bonuses/BonusRoll";',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''    const next = applyAbilityOperation(current, operation);
    if (!next) {''',
    '''    const next = applyAbilityOperation(current, operation);
    if (!next) {''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation,''',
    '''    let loggedOperation = operation;
    if (operation.type === "character.ability.use") {
      const resolvedAbility = findAbilityForSource(next, operation.source);
      const bonusRollResults = listResolvedBonusRolls(resolvedAbility?.bonuses);
      if (bonusRollResults.length > 0) {
        loggedOperation = { ...operation, bonusRollResults };
      }
    }

    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: loggedOperation,''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return nextCharacter.useAbility(source.abilityId, operation.activationOptionId);',
    '        return nextCharacter.useAbility(source.abilityId, operation.activationOptionId, operation.bonusRollValues);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return nextCharacter.useEquipmentAbility(source.itemId, source.abilityId);',
    '        return nextCharacter.useEquipmentAbility(source.itemId, source.abilityId, operation.bonusRollValues);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '        return nextCharacter.useAbility(projectedId, operation.activationOptionId);',
    '        return nextCharacter.useAbility(projectedId, operation.activationOptionId, operation.bonusRollValues);',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''        operation.type === "character.ability.use"
          ? operation.activationOptionId
          : undefined,
      );''',
    '''        operation.type === "character.ability.use"
          ? operation.activationOptionId
          : undefined,
        operation.type === "character.ability.use"
          ? operation.bonusRollValues
          : undefined,
      );''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''  action: "use" | "restore" | "deactivate",
  optionId?: string,
): CharacterTemplate {''',
    '''  action: "use" | "restore" | "deactivate",
  optionId?: string,
  bonusRollValues?: Record<string, number>,
): CharacterTemplate {''',
)
replace_once(
    "session-server/src/routes/characters/abilities/AbilitySessionActor.ts",
    '''      { type: "race", sourceLabel: "Raça" },
      optionId,
    );''',
    '''      { type: "race", sourceLabel: "Raça" },
      optionId,
      bonusRollValues,
    );''',
)

# Initiative: always hydrate authoritative conditions when resolving character affinities.
replace_once(
    "session-server/src/routes/initiative/InitiativeSessionActor.ts",
    'import { getEffectiveDamageAffinities } from "../../../../src/models/characters/characterDamageAffinities";',
    'import { getEffectiveDamageAffinities } from "../../../../src/models/characters/characterDamageAffinities";\nimport type { CharacterCondition } from "../../../../src/models/characters/CharacterCondition";',
)
replace_once(
    "session-server/src/routes/initiative/InitiativeSessionActor.ts",
    '          const affinities = initiativeDamageAffinities(entry, abilities, runtimeConfig);',
    '          const affinities = initiativeDamageAffinities(entry, abilities, conditions, runtimeConfig);',
)
replace_once(
    "session-server/src/routes/initiative/InitiativeSessionActor.ts",
    '''function initiativeDamageAffinities(
  entry: InitiativeEntry,
  abilities: Record<string, SessionAbilityState>,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): DamageAffinity[] {''',
    '''function initiativeDamageAffinities(
  entry: InitiativeEntry,
  abilities: Record<string, SessionAbilityState>,
  conditions: Record<string, SessionConditionsState>,
  runtimeConfig: SessionRuntimeConfigSnapshot | null,
): DamageAffinity[] {''',
)
replace_once(
    "session-server/src/routes/initiative/InitiativeSessionActor.ts",
    '''        const character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
        return getEffectiveDamageAffinities(character);''',
    '''        const character = CharacterTemplate.fromJSON(stored.character as Partial<CharacterTemplateProps>);
        const authoritativeConditions = conditions[characterId];
        return getEffectiveDamageAffinities(
          character,
          authoritativeConditions?.initialized
            ? authoritativeConditions.conditions as unknown as CharacterCondition[]
            : undefined,
        );''',
)

# Custom-system rolls: retain the raw die result and derive the formula total for the log.
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''export type CustomAbilityRollResolution = {
  mode: CustomAbilityRollDefinition["mode"]
  value: number
  dice?: string
}''',
    '''export type CustomAbilityRollResolution = {
  mode: CustomAbilityRollDefinition["mode"]
  /** Resultado dos dados / valor manual antes da fórmula do efeito. */
  value: number
  dice?: string
  /** Primeiro total numérico de uma fórmula de efeito que use roll.value. */
  total?: number
}''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''  return {
    character: activateCustomAbility(
      character,
      resolvedDefinitions,
      systemId,
      abilityId,
      activationLevel,
    ),
    roll: {
      mode: roll.mode,
      value: resolved.value,
      dice: resolved.dice,
    },
  }''',
    '''  const activation = getEffectiveCustomAbilityActivation(type, ability)
  return {
    character: activateCustomAbility(
      character,
      resolvedDefinitions,
      systemId,
      abilityId,
      activationLevel,
    ),
    roll: {
      mode: roll.mode,
      value: resolved.value,
      dice: resolved.dice,
      total: resolveRollFormulaTotal(
        activation.resourceChanges,
        resolved.value,
        definition,
        state,
        character,
        type,
        ability.values,
      ),
    },
  }''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''    roll: {
      mode: action.roll.mode,
      value: resolved.value,
      dice: resolved.dice,
    },
  }
}''',
    '''    roll: {
      mode: action.roll.mode,
      value: resolved.value,
      dice: resolved.dice,
      total: resolveRollFormulaTotal(
        action.resourceChanges,
        resolved.value,
        definition,
        state,
        character,
      ),
    },
  }
}''',
)
replace_once(
    "src/lib/customSystems/CustomAbilityRoll.ts",
    '''function replaceRollValueForAbility(''',
    '''function resolveRollFormulaTotal(
  changes: CustomAbilityActivationDefinition["resourceChanges"] | undefined,
  rollValue: number,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): number {
  for (const change of changes ?? []) {
    const formula = change.formula?.trim()
    if (!formula?.includes("roll.value")) continue
    const replaced = replaceRollToken(formula, rollValue)
    if (!replaced) continue
    const result = evaluateCustomFormula(
      replaced,
      definition,
      state,
      character,
      abilityType ? { type: abilityType, values: abilityValues } : undefined,
    )
    if (result.ok && typeof result.value === "number" && Number.isFinite(result.value)) {
      return result.value
    }
  }
  return rollValue
}

function replaceRollValueForAbility(''',
)

# Custom-system session protocols carry server-computed roll details only for logs.
for path in [
    "src/features/session-runtime/customSystemSessionProtocol.ts",
    "session-server/src/routes/characters/custom-systems/customSystemProtocol.ts",
]:
    replace_once(
        path,
        'rollValue?: number; activationLevel?: number' if path.startswith("session-server") else 'rollValue?: number; activationLevel?: number',
        'rollValue?: number; rollDice?: string; rollTotal?: number; activationLevel?: number',
    )
    replace_once(
        path,
        'actionId: string; rollValue?: number',
        'actionId: string; rollValue?: number; rollDice?: string; rollTotal?: number',
    )

# Server stores custom roll dice and total in the session log.
replace_once(
    "session-server/src/routes/characters/custom-systems/CustomSystemSessionActor.ts",
    '''          loggedOperation = {
            ...operation,
            rollValue: activation.roll.value,
          };''',
    '''          loggedOperation = {
            ...operation,
            rollValue: activation.roll.value,
            rollDice: activation.roll.dice,
            rollTotal: activation.roll.total,
          };''',
)
# Same snippet appears a second time for custom actions.
replace_once(
    "session-server/src/routes/characters/custom-systems/CustomSystemSessionActor.ts",
    '''          loggedOperation = {
            ...operation,
            rollValue: activation.roll.value,
          };''',
    '''          loggedOperation = {
            ...operation,
            rollValue: activation.roll.value,
            rollDice: activation.roll.dice,
            rollTotal: activation.roll.total,
          };''',
)

# Session log: show die value and final formula total for both native and custom ability rolls.
replace_once(
    "src/features/session/SessionActionLog.tsx",
    'import type { JsonValue } from "../../models/customSystems/CustomGenerals"',
    'import type { JsonValue } from "../../models/customSystems/CustomGenerals"\nimport type { BonusRollResolution } from "../../models/bonuses/Bonus"',
)
replace_once(
    "src/features/session/SessionActionLog.tsx",
    '    case "character.ability.use": return `${characterName} usou ${operation.abilityName || "uma habilidade"}.`',
    '    case "character.ability.use": return `${characterName} usou ${operation.abilityName || "uma habilidade"}.${formatBonusRollResults(operation.bonusRollResults)}`',
)
replace_once(
    "src/features/session/SessionActionLog.tsx",
    '      return `${characterName} usou ${abilityName}${suffix}`',
    '      return `${characterName} usou ${abilityName}${customRollDetails(operation)}${suffix}`',
)
replace_once(
    "src/features/session/SessionActionLog.tsx",
    '      return `${characterName} executou ${actionName}${suffix}`',
    '      return `${characterName} executou ${actionName}${customRollDetails(operation)}${suffix}`',
)
replace_once(
    "src/features/session/SessionActionLog.tsx",
    '''function previousCustomSystemState(''',
    '''function formatBonusRollResults(results: BonusRollResolution[] | undefined): string {
  if (!results?.length) return ""
  return ` Rolagem: ${results.map((result) => {
    const formula = result.formulaBonus !== 0
      ? ` ${result.formulaBonus >= 0 ? "+" : "−"} ${Math.abs(result.formulaBonus)} fórmula`
      : ""
    return `${result.dice} = ${result.diceValue}${formula}; total ${result.total}`
  }).join(" · ")}.`
}

function customRollDetails(
  operation: Extract<SessionCustomSystemOperation, {
    type: "character.customSystem.ability.activate" | "character.customSystem.action.execute"
  }>,
): string {
  if (operation.rollValue === undefined) return ""
  const dice = operation.rollDice?.trim()
  const base = dice ? ` — rolagem ${dice} = ${operation.rollValue}` : ` — rolagem = ${operation.rollValue}`
  if (operation.rollTotal === undefined || operation.rollTotal === operation.rollValue) return base
  return `${base}; total com fórmula ${operation.rollTotal}`
}

function previousCustomSystemState(''',
)

# Remove the one-off patcher from the generated commit.
Path('.github/apply_ability_roll_affinity_fixes.py').unlink(missing_ok=True)
Path('.github/workflows/apply-ability-roll-affinity-fixes.yml').unlink(missing_ok=True)
