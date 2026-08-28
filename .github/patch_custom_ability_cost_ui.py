from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

path = "src/features/characters/characterSheet/minimalCharacterActions.tsx"
text = read(path)

text = replace_once(
    text,
    """import {\n  getCustomAbilityAvailability,\n} from \"../../../lib/customSystems\"\n""",
    """import {\n  evaluateCustomFormula,\n  getCustomAbilityAvailability,\n} from \"../../../lib/customSystems\"\n""",
    "formula import",
)

entry_anchor = """type ActionEntry = {\n  id: string\n"""
cost_type = """type CustomAbilityCostPreview = {\n  key: string\n  name: string\n  amount?: number\n  current?: number\n  sufficient?: boolean\n  unavailable?: boolean\n}\n\n"""
text = replace_once(text, entry_anchor, cost_type + entry_anchor, "cost preview type")

memo_anchor = """  const passiveAbilities = useMemo(\n    () => getPassiveAbilities(character),\n    [character],\n  )\n\n  function open(entry: ActionEntry) {\n"""
memo_replacement = """  const passiveAbilities = useMemo(\n    () => getPassiveAbilities(character),\n    [character],\n  )\n  const selectedCustomAbilityCosts = useMemo(() => {\n    if (!selected?.customAbilitySource) return []\n    const previewRollValue =\n      selected.customAbilityRoll?.mode === \"manual\" && isFiniteInput(manualRollValue)\n        ? Number(manualRollValue)\n        : undefined\n    return resolveCustomAbilityCosts(\n      character,\n      definitions,\n      selected.customAbilitySource,\n      previewRollValue,\n    )\n  }, [character, definitions, manualRollValue, selected])\n  const selectedCustomAbilityCostError = customAbilityCostError(\n    selectedCustomAbilityCosts,\n  )\n\n  function open(entry: ActionEntry) {\n"""
text = replace_once(text, memo_anchor, memo_replacement, "selected cost memo")

use_anchor = """      if (sessionRuntime) {\n        if (sessionRuntime.status !== \"connected\") {\n          setError(\"A sessão está desconectada. Não foi possível usar esta habilidade.\")\n          return\n        }\n"""
use_replacement = """      const costError = customAbilityCostError(\n        resolveCustomAbilityCosts(character, definitions, source, rollValue),\n      )\n      if (costError) {\n        setError(costError)\n        return\n      }\n\n      if (sessionRuntime) {\n        if (sessionRuntime.status !== \"connected\") {\n          setError(\"A sessão está desconectada. Não foi possível usar esta habilidade.\")\n          return\n        }\n"""
# There are other `if (sessionRuntime)` blocks; anchor includes the exact custom ability message.
text = replace_once(text, use_anchor, use_replacement, "pre-dispatch resource validation")

meta_anchor = """              {selected.customAbilitySource || selected.customSystemActionSource ? (\n                <span>• Sistema personalizado</span>\n              ) : null}\n            </div>\n            <p className=\"whitespace-pre-wrap text-sm leading-6 text-text\">{selected.description}</p>\n"""
meta_replacement = """              {selected.customAbilitySource || selected.customSystemActionSource ? (\n                <span>• Sistema personalizado</span>\n              ) : null}\n              {selectedCustomAbilityCosts.map((cost) => (\n                <span key={cost.key}>\n                  • Custo: {formatCustomAbilityCost(cost)}\n                </span>\n              ))}\n            </div>\n            <p className=\"whitespace-pre-wrap text-sm leading-6 text-text\">{selected.description}</p>\n"""
text = replace_once(text, meta_anchor, meta_replacement, "cost metadata")

error_anchor = """            {error ? (\n              <div className=\"rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger\">\n                {error}\n              </div>\n            ) : null}\n"""
error_replacement = """            {error || selectedCustomAbilityCostError ? (\n              <div className=\"rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger\">\n                {error || selectedCustomAbilityCostError}\n              </div>\n            ) : null}\n"""
text = replace_once(text, error_anchor, error_replacement, "cost error display")

button_anchor = """                  disabled={selected.customAbilityRoll?.mode === \"manual\" && !isFiniteInput(manualRollValue)}\n                  onClick={() => useCustomAbility(selected)}\n"""
button_replacement = """                  disabled={\n                    Boolean(selectedCustomAbilityCostError) ||\n                    (selected.customAbilityRoll?.mode === \"manual\" && !isFiniteInput(manualRollValue))\n                  }\n                  onClick={() => useCustomAbility(selected)}\n"""
text = replace_once(text, button_anchor, button_replacement, "disable insufficient ability")

helpers_anchor = """function getPassiveAbilities(character: CharacterTemplate): ActionEntry[] {\n"""
helpers = r'''function resolveCustomAbilityCosts(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  source: CustomAbilitySource,
  rollValue?: number,
): CustomAbilityCostPreview[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const state = states.find((entry) => entry.systemId === source.systemId)
  const definition = definitions.find((entry) => entry.id === source.systemId)
  const ability = state?.abilities.find((entry) => entry.id === source.abilityId)
  const type = ability && definition?.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!state || !definition || !ability || !type) return []

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  return (activation.resourceChanges ?? [])
    .filter((change) => change.operation === "spend")
    .map((change) => {
      const amount = resolveCustomAbilityCostAmount(
        change,
        definition,
        state,
        type,
        ability,
        character,
        rollValue,
      )

      if (change.target.source === "native") {
        const current = nativeResourcePreviewValue(character, change.target.resource)
        const sufficient = amount === undefined
          ? undefined
          : change.target.resource === "hitPoints" || current >= amount
        return {
          key: change.id,
          name: nativeResourcePreviewName(change.target.resource),
          amount,
          current,
          sufficient,
        }
      }

      const targetState = states.find(
        (entry) => entry.systemId === change.target.systemId,
      )
      const targetDefinition = definitions.find(
        (entry) => entry.id === change.target.systemId,
      )
      const resource = targetDefinition?.resources.find(
        (entry) => entry.id === change.target.resourceId,
      )
      const resourceState = targetState?.resources[change.target.resourceId]
      if (!resource || !resourceState) {
        return {
          key: change.id,
          name: resource?.name || change.target.resourceId,
          amount,
          sufficient: false,
          unavailable: true,
        }
      }

      const minimum = resource.minimum ?? 0
      return {
        key: change.id,
        name: resource.name,
        amount,
        current: resourceState.current,
        sufficient: amount === undefined
          ? undefined
          : resourceState.current - amount >= minimum,
      }
    })
}

function resolveCustomAbilityCostAmount(
  change: NonNullable<ReturnType<typeof getEffectiveCustomAbilityActivation>["resourceChanges"]>[number],
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: NonNullable<CustomSystemDefinition["abilityTypes"]>[number],
  ability: CustomAbilityInstance,
  character: CharacterTemplate,
  rollValue?: number,
): number | undefined {
  if (!change.formula?.trim()) return Math.max(0, change.amount ?? 0)

  let formula = change.formula
  if (formula.includes("roll.value")) {
    if (rollValue === undefined) return undefined
    formula = formula.replace(
      /(^|[^A-Za-z0-9_.-])roll\.value(?=$|[^A-Za-z0-9_.-])/g,
      (_match, prefix: string) => `${prefix}(${rollValue})`,
    )
  }

  const result = evaluateCustomFormula(
    formula,
    definition,
    state,
    character,
    { type, values: ability.values },
  )
  if (!result.ok || typeof result.value !== "number" || !Number.isFinite(result.value)) {
    return undefined
  }
  return Math.max(0, result.value)
}

function customAbilityCostError(costs: CustomAbilityCostPreview[]): string {
  const unavailable = costs.find((cost) => cost.unavailable)
  if (unavailable) return `O recurso “${unavailable.name}” não está disponível.`
  const insufficient = costs.find((cost) => cost.sufficient === false)
  return insufficient ? `Não há ${insufficient.name} suficiente.` : ""
}

function formatCustomAbilityCost(cost: CustomAbilityCostPreview): string {
  if (cost.amount === undefined) return `variável de ${cost.name}`
  return `${formatResourceAmount(cost.amount)} ${cost.name}`
}

function formatResourceAmount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function nativeResourcePreviewName(
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
): string {
  if (resource === "hitPoints") return "Pontos de Vida"
  if (resource === "temporaryHitPoints") return "Pontos de Vida temporários"
  if (resource === "inspiration") return "Inspiração"
  return "Exaustão"
}

function nativeResourcePreviewValue(
  character: CharacterTemplate,
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
): number {
  if (resource === "hitPoints") return character.get("sheet").HP.current
  if (resource === "temporaryHitPoints") return character.get("sheet").HP.temporary ?? 0
  if (resource === "inspiration") return character.get("sheet").stats.inspiration ? 1 : 0
  return character.get("sheet").stats.exhaustion ?? 0
}

'''
text = replace_once(text, helpers_anchor, helpers + helpers_anchor, "cost preview helpers")

write(path, text)
print("custom ability cost UI patch applied")
