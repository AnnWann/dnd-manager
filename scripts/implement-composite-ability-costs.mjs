import fs from 'node:fs'

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after === before) throw new Error(`No changes produced for ${path}`)
  fs.writeFileSync(path, after)
  console.log(`patched ${path}`)
}

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`)
  return source.replace(before, after)
}

patch('src/models/customSystems/CustomAbilityDefinition.ts', (source) => replaceExact(
  source,
`export interface CustomAbilityResourceChangeDefinition {
  id: string
  target: CustomAbilityResourceReference
  operation: 'spend' | 'gain' | 'set'
  /** Mantido para compatibilidade e valores numéricos simples. Fórmula tem precedência. */
  amount?: number
  formula?: FormulaExpression
}`,
`export interface CustomAbilityResourceChangeDefinition {
  id: string
  target: CustomAbilityResourceReference
  operation: 'spend' | 'gain' | 'set'
  /** Mantido para compatibilidade e valores numéricos simples. Fórmula tem precedência. */
  amount?: number
  formula?: FormulaExpression
  /**
   * Conector entre custos consecutivos. Ausente equivale a \`and\` para manter
   * compatibilidade com definições antigas. \`or\` inicia uma nova alternativa.
   */
  costJoin?: 'and' | 'or'
  /** Nível em que o custo base é aplicado quando a habilidade permite upcast. */
  upcastBaseLevel?: number
  /** Quantidade adicionada ao custo para cada nível acima de upcastBaseLevel. */
  upcastAmountPerLevel?: number
}`,
  'CustomAbilityResourceChangeDefinition',
))

patch('src/lib/customSystems/CustomAbilityActivation.ts', (source) => {
  source = replaceExact(
    source,
`export function activateCustomAbility(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  sourceSystemId: string,
  abilityId: string,
): CharacterTemplate {`,
`export function activateCustomAbility(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  sourceSystemId: string,
  abilityId: string,
  activationLevel?: number,
): CharacterTemplate {`,
    'activateCustomAbility signature',
  )

  source = replaceExact(
    source,
`  const resolvedChanges = (activation.resourceChanges ?? []).map((change) => ({
    change,
    amount: resolveAmount(change, sourceDefinition, sourceState, type, ability, character),
  }))

  validateResourceChanges(character, definitions, states, resolvedChanges)

  let nextCharacter = character
  for (const resolved of resolvedChanges) {
    nextCharacter = applyResourceChange(nextCharacter, definitions, states, resolved.change, resolved.amount)
  }`,
`  const resourceChanges = effectiveResourceChanges(activation, sourceSystemId)
  const resolvedChanges = resourceChanges.map((change) => ({
    change,
    amount: resolveAmount(
      change,
      sourceDefinition,
      sourceState,
      type,
      ability,
      character,
      activationLevel,
    ),
  }))

  const costBranches = buildSpendBranches(resolvedChanges)
  const selectedCostBranch = selectAffordableSpendBranch(
    character,
    definitions,
    states,
    costBranches,
  )
  if (costBranches.length > 0 && !selectedCostBranch) {
    throw new Error('Nenhuma combinação de custos possui recursos suficientes para usar a habilidade.')
  }

  let nextCharacter = character
  for (const resolved of selectedCostBranch ?? []) {
    nextCharacter = applyResourceChange(
      nextCharacter,
      definitions,
      states,
      resolved.change,
      resolved.amount,
    )
  }
  for (const resolved of resolvedChanges.filter(({ change }) => change.operation !== 'spend')) {
    nextCharacter = applyResourceChange(
      nextCharacter,
      definitions,
      states,
      resolved.change,
      resolved.amount,
    )
  }`,
    'resource resolution block',
  )

  source = replaceExact(
    source,
`    usage: preset.activation.usage ?? base?.usage,
    resourceChanges: preset.activation.resourceChanges ?? base?.resourceChanges,
    conditionChanges: preset.activation.conditionChanges ?? base?.conditionChanges,`,
`    usage: preset.activation.usage ?? base?.usage,
    resourceCosts: preset.activation.resourceCosts ?? base?.resourceCosts,
    resourceChanges: preset.activation.resourceChanges ?? base?.resourceChanges,
    conditionChanges: preset.activation.conditionChanges ?? base?.conditionChanges,`,
    'mergeActivation resourceCosts',
  )

  const oldFunctions = `function resolveAmount(change: CustomAbilityResourceChangeDefinition, definition: CustomSystemDefinition, state: CharacterCustomSystemState, type: CustomAbilityTypeDefinition, ability: CustomAbilityInstance, character: CharacterTemplate): number {
  if (change.formula?.trim()) {
    const result = evaluateCustomFormula(change.formula, definition, state, character, { type, values: ability.values })
    if (!result.ok || typeof result.value !== 'number' || !Number.isFinite(result.value)) throw new Error(\`A fórmula do efeito de recurso “\${change.id}” não retornou um número válido.\`)
    return Math.max(0, result.value)
  }
  return Math.max(0, change.amount ?? 0)
}

function validateResourceChanges(character: CharacterTemplate, definitions: CustomSystemDefinition[], states: CharacterCustomSystemState[], changes: Array<{ change: CustomAbilityResourceChangeDefinition; amount: number }>) {
  for (const { change, amount } of changes) {
    if (change.operation !== 'spend') continue
    if (change.target.source === 'native') {
      const available = nativeResourceValue(character, change.target.resource)
      if (available < amount && change.target.resource !== 'hitPoints') throw new Error('Recurso nativo insuficiente para usar a habilidade.')
      continue
    }
    const state = requireState(states, change.target.systemId)
    const definition = requireDefinition(definitions, change.target.systemId)
    const resource = definition.resources.find((entry) => entry.id === change.target.resourceId)
    const resourceState = state.resources[change.target.resourceId]
    if (!resource || !resourceState) throw new Error(\`O recurso “\${change.target.resourceId}” não está disponível.\`)
    const minimum = resource.minimum ?? 0
    if (resourceState.current - amount < minimum) throw new Error(\`Não há \${resource.name} suficiente para usar a habilidade.\`)
  }
}`

  const newFunctions = `type ResolvedResourceChange = {
  change: CustomAbilityResourceChangeDefinition
  amount: number
}

function effectiveResourceChanges(
  activation: CustomAbilityActivationDefinition,
  sourceSystemId: string,
): CustomAbilityResourceChangeDefinition[] {
  if (activation.resourceChanges !== undefined) return activation.resourceChanges
  return (activation.resourceCosts ?? []).map((cost, index) => ({
    id: \`legacy-cost:\${index}\`,
    target: {
      source: 'customSystem' as const,
      systemId: sourceSystemId,
      resourceId: cost.resourceId,
    },
    operation: 'spend' as const,
    amount: cost.amount,
    formula: cost.formula,
    costJoin: 'and' as const,
  }))
}

function resolveAmount(
  change: CustomAbilityResourceChangeDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
  character: CharacterTemplate,
  activationLevel?: number,
): number {
  let baseAmount = Math.max(0, change.amount ?? 0)
  if (change.formula?.trim()) {
    const result = evaluateCustomFormula(change.formula, definition, state, character, { type, values: ability.values })
    if (!result.ok || typeof result.value !== 'number' || !Number.isFinite(result.value)) throw new Error(\`A fórmula do efeito de recurso “\${change.id}” não retornou um número válido.\`)
    baseAmount = Math.max(0, result.value)
  }

  if (change.operation !== 'spend') return baseAmount
  const perLevel = Math.max(0, change.upcastAmountPerLevel ?? 0)
  if (perLevel <= 0) return baseAmount
  const baseLevel = Math.max(1, Math.floor(change.upcastBaseLevel ?? 1))
  const resolvedLevel = Math.max(baseLevel, Math.floor(activationLevel ?? baseLevel))
  return baseAmount + ((resolvedLevel - baseLevel) * perLevel)
}

function buildSpendBranches(changes: ResolvedResourceChange[]): ResolvedResourceChange[][] {
  const branches: ResolvedResourceChange[][] = []
  for (const resolved of changes) {
    if (resolved.change.operation !== 'spend') continue
    if (branches.length === 0 || resolved.change.costJoin === 'or') branches.push([])
    branches[branches.length - 1].push(resolved)
  }
  return branches
}

function selectAffordableSpendBranch(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  branches: ResolvedResourceChange[][],
): ResolvedResourceChange[] | undefined {
  for (const branch of branches) {
    const simulatedStates = states.map(cloneState)
    let simulatedCharacter = character
    let affordable = true
    try {
      for (const { change, amount } of branch) {
        assertSpendAvailable(simulatedCharacter, definitions, simulatedStates, change, amount)
        simulatedCharacter = applyResourceChange(
          simulatedCharacter,
          definitions,
          simulatedStates,
          change,
          amount,
        )
      }
    } catch {
      affordable = false
    }
    if (affordable) return branch
  }
  return undefined
}

function assertSpendAvailable(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  change: CustomAbilityResourceChangeDefinition,
  amount: number,
) {
  if (change.target.source === 'native') {
    const available = nativeResourceValue(character, change.target.resource)
    if (available < amount) throw new Error('Recurso nativo insuficiente para usar a habilidade.')
    return
  }
  const state = requireState(states, change.target.systemId)
  const definition = requireDefinition(definitions, change.target.systemId)
  const resource = definition.resources.find((entry) => entry.id === change.target.resourceId)
  const resourceState = state.resources[change.target.resourceId]
  if (!resource || !resourceState) throw new Error(\`O recurso “\${change.target.resourceId}” não está disponível.\`)
  const minimum = resource.minimum ?? 0
  if (resourceState.current - amount < minimum) throw new Error(\`Não há \${resource.name} suficiente para usar a habilidade.\`)
}`

  source = replaceExact(source, oldFunctions, newFunctions, 'resolveAmount + validation')
  return source
})

patch('src/lib/customSystems/CustomAbilityRoll.ts', (source) => {
  source = replaceExact(
    source,
`  abilityId: string,
  suppliedRollValue?: number,
): { character: CharacterTemplate; roll?: CustomAbilityRollResolution } {`,
`  abilityId: string,
  suppliedRollValue?: number,
  activationLevel?: number,
): { character: CharacterTemplate; roll?: CustomAbilityRollResolution } {`,
    'activateCustomAbilityWithRoll signature',
  )
  source = source.replaceAll(
    'activateCustomAbility(character, definitions, systemId, abilityId)',
    'activateCustomAbility(character, definitions, systemId, abilityId, activationLevel)',
  )
  source = replaceExact(
    source,
`      systemId,
      abilityId,
    ),`,
`      systemId,
      abilityId,
      activationLevel,
    ),`,
    'resolved activateCustomAbility call',
  )
  return source
})

patch('src/features/session-runtime/customSystemSessionProtocol.ts', (source) => replaceExact(
  source,
`  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string; rollValue?: number }`,
`  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string; rollValue?: number; activationLevel?: number }`,
  'client custom system activation protocol',
))

patch('session-server/src/routes/characters/custom-systems/customSystemProtocol.ts', (source) => {
  source = replaceExact(
    source,
`  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string; rollValue?: number }`,
`  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string; rollValue?: number; activationLevel?: number }`,
    'server custom system activation protocol',
  )
  source = replaceExact(
    source,
`    case "character.customSystem.ability.activate":
      return nonEmpty(value.abilityId)
        && (value.rollValue === undefined || finite(value.rollValue));`,
`    case "character.customSystem.ability.activate":
      return nonEmpty(value.abilityId)
        && (value.rollValue === undefined || finite(value.rollValue))
        && (value.activationLevel === undefined || positiveInteger(value.activationLevel));`,
    'server activation validator',
  )
  source = replaceExact(
    source,
`function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}`,
`function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}`,
    'positiveInteger helper',
  )
  return source
})

patch('session-server/src/routes/characters/custom-systems/CustomSystemSessionActor.ts', (source) => replaceExact(
  source,
`          operation.abilityId,
          operation.rollValue,
        );`,
`          operation.abilityId,
          operation.rollValue,
          operation.activationLevel,
        );`,
  'server actor activation level',
))

patch('src/features/customSystems/CustomAbilityEffectEditors.tsx', (source) => replaceExact(
  source,
`      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <FormulaVariablePicker variables={listCustomFormulaVariables(definition, abilityType)} onSelect={(path) => setValue(\`${'${value}'}${'${value.trim() ? \' \' : \'\'}'}${'${path}'}\`)} />
        {change.formula?.trim() ? (
          <span className={\`text-[11px] ${'${formulaError ? \'text-red-300\' : \'text-emerald-300\'}'}\`}>{formulaError ?? 'Fórmula válida.'}</span>
        ) : (
          <span className="text-[11px] text-textMuted">Aceita número fixo ou expressão.</span>
        )}
      </div>`,
`      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <FormulaVariablePicker variables={listCustomFormulaVariables(definition, abilityType)} onSelect={(path) => setValue(\`${'${value}'}${'${value.trim() ? \' \' : \'\'}'}${'${path}'}\`)} />
        {change.formula?.trim() ? (
          <span className={\`text-[11px] ${'${formulaError ? \'text-red-300\' : \'text-emerald-300\'}'}\`}>{formulaError ?? 'Fórmula válida.'}</span>
        ) : (
          <span className="text-[11px] text-textMuted">Aceita número fixo ou expressão.</span>
        )}
      </div>
      {change.operation === 'spend' ? (
        <div className="mt-2 grid gap-2 rounded-lg border border-border bg-bg-subtle p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Relação com custo anterior</span>
              <SharedSelect
                className="input-base min-w-0 w-full text-xs"
                value={change.costJoin ?? 'and'}
                onChange={(event) => onChange({ ...change, costJoin: event.target.value as 'and' | 'or' })}
              >
                <option value="and">E — exige ambos</option>
                <option value="or">OU — alternativa</option>
              </SharedSelect>
            </label>
            <label className="flex items-center gap-2 self-end rounded-lg border border-border px-2 py-2 text-xs text-textH">
              <input
                type="checkbox"
                checked={change.upcastAmountPerLevel !== undefined}
                onChange={(event) => onChange(event.target.checked
                  ? { ...change, upcastBaseLevel: change.upcastBaseLevel ?? 1, upcastAmountPerLevel: change.upcastAmountPerLevel ?? 1 }
                  : { ...change, upcastBaseLevel: undefined, upcastAmountPerLevel: undefined })}
              />
              Escala com nível de uso
            </label>
          </div>
          {change.upcastAmountPerLevel !== undefined ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Nível base</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input-base min-w-0 w-full text-xs"
                  value={change.upcastBaseLevel ?? 1}
                  onChange={(event) => onChange({ ...change, upcastBaseLevel: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">+ custo por nível</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="input-base min-w-0 w-full text-xs"
                  value={change.upcastAmountPerLevel}
                  onChange={(event) => onChange({ ...change, upcastAmountPerLevel: Math.max(0, Number(event.target.value) || 0) })}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}`,
  'resource cost editor controls',
))

patch('src/features/characters/characterSheet/character_info/components/actions/CustomSystemActionsPanel.tsx', (source) => {
  source = replaceExact(
    source,
`  status?: string
  roll?: CustomAbilityRollDefinition
  operation?: SessionCustomSystemOperation
  activate: (character: CharacterTemplate, rollValue?: number) => CharacterTemplate`,
`  status?: string
  roll?: CustomAbilityRollDefinition
  minimumActivationLevel?: number
  operation?: SessionCustomSystemOperation
  activate: (character: CharacterTemplate, rollValue?: number, activationLevel?: number) => CharacterTemplate`,
    'SheetActionEntry activation level',
  )
  source = replaceExact(
    source,
`  const [error, setError] = useState("")
  const [manualRollValues, setManualRollValues] = useState<Record<string, string>>({})`,
`  const [error, setError] = useState("")
  const [manualRollValues, setManualRollValues] = useState<Record<string, string>>({})
  const [activationLevels, setActivationLevels] = useState<Record<string, string>>({})`,
    'activationLevels state',
  )
  source = replaceExact(
    source,
`      if (sessionRuntime && entry.operation) {
        const acceptsRoll = entry.operation.type === "character.customSystem.ability.activate"
          || entry.operation.type === "character.customSystem.action.execute"
        const operation = acceptsRoll && rollValue !== undefined
          ? { ...entry.operation, rollValue }
          : entry.operation
        sessionRuntime.dispatchAbilityOperation(operation)
        return
      }
      updateCharacter(character.get("id"), (current) => entry.activate(current, rollValue))`,
`      let activationLevel: number | undefined
      if (entry.minimumActivationLevel !== undefined) {
        const rawLevel = activationLevels[entry.key]?.trim() || String(entry.minimumActivationLevel)
        const parsedLevel = Number(rawLevel)
        if (!Number.isInteger(parsedLevel) || parsedLevel < entry.minimumActivationLevel) {
          setError(\`Informe um nível de uso inteiro igual ou maior que \${entry.minimumActivationLevel} para \${entry.name}.\`)
          return
        }
        activationLevel = parsedLevel
      }

      if (sessionRuntime && entry.operation) {
        let operation: SessionCustomSystemOperation = entry.operation
        if (operation.type === "character.customSystem.ability.activate" && activationLevel !== undefined) {
          operation = { ...operation, activationLevel }
        }
        if ((operation.type === "character.customSystem.ability.activate" || operation.type === "character.customSystem.action.execute") && rollValue !== undefined) {
          operation = { ...operation, rollValue }
        }
        sessionRuntime.dispatchAbilityOperation(operation)
        return
      }
      updateCharacter(character.get("id"), (current) => entry.activate(current, rollValue, activationLevel))`,
    'activate handler',
  )
  source = replaceExact(
    source,
`                          {entry.roll?.mode === "manual" ? (`,
`                          {entry.minimumActivationLevel !== undefined ? (
                            <label className="mt-3 grid gap-1 rounded-lg border border-accentBorder bg-accentBg/30 p-2">
                              <span className="text-[11px] font-semibold text-textH">Nível de uso</span>
                              <span className="text-[10px] text-textMuted">
                                Custos escaláveis usam este nível para calcular o consumo.
                              </span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={entry.minimumActivationLevel}
                                step={1}
                                value={activationLevels[entry.key] ?? String(entry.minimumActivationLevel)}
                                onChange={(event) => setActivationLevels((current) => ({ ...current, [entry.key]: event.target.value }))}
                                className="input-base h-8"
                              />
                            </label>
                          ) : null}
                          {entry.roll?.mode === "manual" ? (`,
    'activation level input',
  )
  source = replaceExact(
    source,
`  const usage = resolveUsageDisplay(
    activation.usage,
    type,
    ability,
    definition,
    state,
    character,
  )`,
`  const usage = resolveUsageDisplay(
    activation.usage,
    type,
    ability,
    definition,
    state,
    character,
  )
  const scalableCosts = (activation.resourceChanges ?? []).filter(
    (change) => change.operation === "spend" && (change.upcastAmountPerLevel ?? 0) > 0,
  )
  const minimumActivationLevel = scalableCosts.length > 0
    ? Math.min(...scalableCosts.map((change) => Math.max(1, Math.floor(change.upcastBaseLevel ?? 1))))
    : undefined`,
    'ability scalable costs',
  )
  source = replaceExact(
    source,
`    roll: activation.roll,
    operation: {`,
`    roll: activation.roll,
    minimumActivationLevel,
    operation: {`,
    'ability entry minimumActivationLevel',
  )
  source = replaceExact(
    source,
`    activate: (current, rollValue) =>
      activateCustomAbilityWithRoll(
        current,
        definitions,
        definition.id,
        ability.id,
        rollValue,
      ).character,`,
`    activate: (current, rollValue, activationLevel) =>
      activateCustomAbilityWithRoll(
        current,
        definitions,
        definition.id,
        ability.id,
        rollValue,
        activationLevel,
      ).character,`,
    'ability entry activate',
  )
  return source
})

console.log('Composite ability costs migration completed.')
