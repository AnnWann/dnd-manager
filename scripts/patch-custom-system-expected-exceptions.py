from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# Model: configurable acquisition exception presets.
replace_once(
    'src/models/customSystems/CustomAbilityDefinition.ts',
    "  predefinedAbilities?: CustomPredefinedAbilityDefinition[]\n  /** Mantém disponível a criação de uma habilidade completamente livre. Padrão: somente o mestre. */",
    "  predefinedAbilities?: CustomPredefinedAbilityDefinition[]\n  /** Presets de exceção de aquisição/preparo esperados para personagens específicos. */\n  acquisitionExceptionPresets?: CustomAbilityAcquisitionExceptionPresetDefinition[]\n  /** Mantém disponível a criação de uma habilidade completamente livre. Padrão: somente o mestre. */",
)
replace_once(
    'src/models/customSystems/CustomAbilityDefinition.ts',
    "export interface CustomAbilityActivationDefinition {",
    """export interface CustomAbilityAcquisitionExceptionPresetDefinition {
  id: string
  name: string
  description?: string
  learnedLimitFormulaOverride?: FormulaExpression
  preparedLimitFormulaOverride?: FormulaExpression
  extraLearnedSlots?: number
  extraPreparedSlots?: number
  /** Quantas habilidades o mestre normalmente deve marcar como sempre aprendidas ao aplicar o preset. */
  alwaysLearnedSelectionCount?: number
  /** Quantas habilidades o mestre normalmente deve marcar como sempre preparadas ao aplicar o preset. */
  alwaysPreparedSelectionCount?: number
}

export interface CustomAbilityActivationDefinition {""",
)

# Character state remembers which expected exception preset was applied.
replace_once(
    'src/models/customSystems/CustomSystemDefinition.ts',
    "export interface CustomAbilityAcquisitionExceptionState {\n  /** Substitui a fórmula de limite definida pelo sistema apenas neste personagem. */",
    "export interface CustomAbilityAcquisitionExceptionState {\n  /** Preset de exceção aplicado; valores manuais podem limpar esta referência. */\n  presetId?: string\n  /** Substitui a fórmula de limite definida pelo sistema apenas neste personagem. */",
)

# Normalize/persist preset id along with exception values.
replace_once(
    'src/lib/customSystems/CustomAbilityManagement.ts',
    "  const normalized: CustomAbilityAcquisitionExceptionState = {\n    learnedLimitFormulaOverride,",
    "  const normalized: CustomAbilityAcquisitionExceptionState = {\n    presetId: value.presetId?.trim() || undefined,\n    learnedLimitFormulaOverride,",
)
replace_once(
    'src/lib/customSystems/CustomAbilityManagement.ts',
    "  const hasValue = Boolean(\n    learnedLimitFormulaOverride",
    "  const hasValue = Boolean(\n    normalized.presetId\n      || learnedLimitFormulaOverride",
)

# Export shared preset resolver.
replace_once(
    'src/lib/customSystems/index.ts',
    'export * from "./CustomResourceMaximum"\n',
    'export * from "./CustomResourceMaximum"\nexport * from "./CustomAbilityExceptionPresets"\n',
)

# Custom System authoring UI: add expected exception preset editor.
replace_once(
    'src/features/customSystems/CustomAbilityConfigurationEditor.tsx',
    "  CustomAbilityAcquisitionDefinition,\n  CustomAbilityResourceChangeDefinition,",
    "  CustomAbilityAcquisitionDefinition,\n  CustomAbilityAcquisitionExceptionPresetDefinition,\n  CustomAbilityResourceChangeDefinition,",
)
replace_once(
    'src/features/customSystems/CustomAbilityConfigurationEditor.tsx',
    "import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'",
    "import {\n  getCustomAbilityAcquisitionExceptionPresets,\n  listCustomFormulaVariables,\n  validateCustomFormula,\n} from '../../lib/customSystems'",
)
replace_once(
    'src/features/customSystems/CustomAbilityConfigurationEditor.tsx',
    """        <div className=\"mt-3 flex flex-wrap gap-4 text-sm text-textH\">
          {usesLearned(acquisition.mode) ? <Check label=\"Novas começam aprendidas\" checked={acquisition.defaultLearned !== false} onChange={(defaultLearned) => patchAcquisition({ defaultLearned })} /> : null}
          {usesPrepared(acquisition.mode) ? <Check label=\"Novas começam preparadas\" checked={Boolean(acquisition.defaultPrepared)} onChange={(defaultPrepared) => patchAcquisition({ defaultPrepared })} /> : null}
        </div>
      </Section>""",
    """        <div className=\"mt-3 flex flex-wrap gap-4 text-sm text-textH\">
          {usesLearned(acquisition.mode) ? <Check label=\"Novas começam aprendidas\" checked={acquisition.defaultLearned !== false} onChange={(defaultLearned) => patchAcquisition({ defaultLearned })} /> : null}
          {usesPrepared(acquisition.mode) ? <Check label=\"Novas começam preparadas\" checked={Boolean(acquisition.defaultPrepared)} onChange={(defaultPrepared) => patchAcquisition({ defaultPrepared })} /> : null}
        </div>
        <AcquisitionExceptionPresetsEditor
          type={type}
          definition={currentSystem}
          onChange={onChange}
        />
      </Section>""",
)

editor_component = r'''
function AcquisitionExceptionPresetsEditor({
  type,
  definition,
  onChange,
}: {
  type: CustomAbilityTypeDefinition
  definition: CustomSystemDefinition
  onChange: (type: CustomAbilityTypeDefinition) => void
}) {
  const presets = getCustomAbilityAcquisitionExceptionPresets(definition, type)

  function setPresets(next: CustomAbilityAcquisitionExceptionPresetDefinition[]) {
    onChange({ ...type, acquisitionExceptionPresets: next })
  }

  function addPreset() {
    const id = uniqueId('excecao', presets.map((preset) => preset.id))
    setPresets([
      ...presets,
      {
        id,
        name: 'Nova exceção esperada',
      },
    ])
  }

  function patchPreset(
    index: number,
    patch: Partial<CustomAbilityAcquisitionExceptionPresetDefinition>,
  ) {
    setPresets(
      presets.map((preset, currentIndex) =>
        currentIndex === index ? { ...preset, ...patch } : preset,
      ),
    )
  }

  function removePreset(index: number) {
    setPresets(presets.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-textH">Exceções esperadas</h3>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Cadastre subclasses, talentos ou outras regras conhecidas que alteram os limites deste tipo. Na configuração do personagem, o mestre poderá aplicá-las por um select.
          </p>
        </div>
        <button
          type="button"
          onClick={addPreset}
          className="inline-flex items-center gap-2 rounded-lg border border-accentBorder px-3 py-2 text-xs font-medium text-textH hover:bg-accentBg"
        >
          <Plus className="h-4 w-4" /> Adicionar exceção
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        {presets.map((preset, index) => (
          <div key={`${preset.id}-${index}`} className="rounded-xl border border-border bg-bg-subtle p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium text-textH">{preset.name || preset.id}</div>
              <button
                type="button"
                onClick={() => removePreset(index)}
                className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10"
                aria-label={`Remover exceção ${preset.name || preset.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextField
                label="Nome"
                value={preset.name}
                onChange={(name) => patchPreset(index, { name })}
              />
              <TextField
                label="ID"
                value={preset.id}
                onChange={(id) => patchPreset(index, { id: slug(id) })}
              />
              <div className="md:col-span-2">
                <TextArea
                  label="Descrição"
                  value={preset.description ?? ''}
                  onChange={(description) => patchPreset(index, { description: description || undefined })}
                />
              </div>
              {usesLearned(type.acquisition?.mode ?? 'learned') ? (
                <FormulaField
                  definition={definition}
                  label="Fórmula alternativa — aprendidas"
                  value={preset.learnedLimitFormulaOverride ?? ''}
                  placeholder="Vazio = manter regra do sistema"
                  onChange={(learnedLimitFormulaOverride) =>
                    patchPreset(index, {
                      learnedLimitFormulaOverride: learnedLimitFormulaOverride || undefined,
                    })
                  }
                />
              ) : null}
              {usesPrepared(type.acquisition?.mode ?? 'learned') ? (
                <FormulaField
                  definition={definition}
                  label="Fórmula alternativa — preparadas"
                  value={preset.preparedLimitFormulaOverride ?? ''}
                  placeholder="Vazio = manter regra do sistema"
                  onChange={(preparedLimitFormulaOverride) =>
                    patchPreset(index, {
                      preparedLimitFormulaOverride: preparedLimitFormulaOverride || undefined,
                    })
                  }
                />
              ) : null}
              {usesLearned(type.acquisition?.mode ?? 'learned') ? (
                <NumberField
                  label="Espaços adicionais — aprendidas"
                  value={preset.extraLearnedSlots}
                  placeholder="0"
                  onChange={(extraLearnedSlots) => patchPreset(index, { extraLearnedSlots })}
                />
              ) : null}
              {usesPrepared(type.acquisition?.mode ?? 'learned') ? (
                <NumberField
                  label="Espaços adicionais — preparadas"
                  value={preset.extraPreparedSlots}
                  placeholder="0"
                  onChange={(extraPreparedSlots) => patchPreset(index, { extraPreparedSlots })}
                />
              ) : null}
              {usesLearned(type.acquisition?.mode ?? 'learned') ? (
                <NumberField
                  label="Quantidade esperada — sempre aprendidas"
                  value={preset.alwaysLearnedSelectionCount}
                  placeholder="0"
                  onChange={(alwaysLearnedSelectionCount) => patchPreset(index, { alwaysLearnedSelectionCount })}
                />
              ) : null}
              {usesPrepared(type.acquisition?.mode ?? 'learned') ? (
                <NumberField
                  label="Quantidade esperada — sempre preparadas"
                  value={preset.alwaysPreparedSelectionCount}
                  placeholder="0"
                  onChange={(alwaysPreparedSelectionCount) => patchPreset(index, { alwaysPreparedSelectionCount })}
                />
              ) : null}
            </div>
          </div>
        ))}
        {!presets.length ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-textMuted">
            Nenhuma exceção esperada configurada.
          </div>
        ) : null}
      </div>
    </div>
  )
}

'''
replace_once(
    'src/features/customSystems/CustomAbilityConfigurationEditor.tsx',
    'function TypeEditor({\n',
    editor_component + 'function TypeEditor({\n',
)

# Character configuration modal: select/apply expected presets.
replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    "import { X } from 'lucide-react'\n",
    "import { X } from 'lucide-react'\nimport { Select as SharedSelect } from '../../../components/ui/Select'\n",
)
replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    "  getCustomAbilityAcquisitionException,\n  getCustomAbilityLimit,",
    "  getCustomAbilityAcquisitionException,\n  getCustomAbilityAcquisitionExceptionPresets,\n  getCustomAbilityLimit,",
)
replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    """  function toggleAlways(
    typeId: string,""",
    """  function applyPreset(type: CustomAbilityTypeDefinition, presetId: string) {
    if (!presetId) {
      updateException(type.id, (current) => ({ ...current, presetId: undefined }))
      return
    }

    const preset = getCustomAbilityAcquisitionExceptionPresets(definition, type)
      .find((entry) => entry.id === presetId)
    if (!preset) return

    updateException(type.id, (current) => ({
      ...current,
      presetId: preset.id,
      learnedLimitFormulaOverride: preset.learnedLimitFormulaOverride,
      preparedLimitFormulaOverride: preset.preparedLimitFormulaOverride,
      extraLearnedSlots: preset.extraLearnedSlots,
      extraPreparedSlots: preset.extraPreparedSlots,
    }))
  }

  function toggleAlways(
    typeId: string,""",
)
replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    """              const exception = getCustomAbilityAcquisitionException(state, type.id)
              const abilities = state.abilities.filter(""",
    """              const exception = getCustomAbilityAcquisitionException(state, type.id)
              const presets = getCustomAbilityAcquisitionExceptionPresets(definition, type)
              const selectedPreset = presets.find((preset) => preset.id === exception.presetId)
              const abilities = state.abilities.filter(""",
)
replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    """                  <div className=\"mt-4 grid gap-3 md:grid-cols-2\">""",
    """                  {presets.length ? (
                    <div className=\"mt-4 rounded-lg border border-accentBorder bg-accentBg/40 p-3\">
                      <label className=\"block text-xs text-text\">
                        Exceção esperada
                        <SharedSelect
                          value={exception.presetId ?? ''}
                          onChange={(event) => applyPreset(type, event.target.value)}
                          className=\"mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH\"
                        >
                          <option value=\"\">Personalizada / sem preset</option>
                          {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                          ))}
                        </SharedSelect>
                      </label>
                      {selectedPreset?.description ? (
                        <p className=\"mt-2 text-xs leading-5 text-textMuted\">{selectedPreset.description}</p>
                      ) : null}
                      {selectedPreset?.alwaysLearnedSelectionCount || selectedPreset?.alwaysPreparedSelectionCount ? (
                        <div className=\"mt-2 flex flex-wrap gap-2 text-[11px] text-text\">
                          {selectedPreset.alwaysLearnedSelectionCount ? (
                            <span className=\"rounded-full border border-border bg-bg px-2 py-1\">
                              Sempre aprendidas: {countSelectedAlwaysLearned(exception)} / {selectedPreset.alwaysLearnedSelectionCount}
                            </span>
                          ) : null}
                          {selectedPreset.alwaysPreparedSelectionCount ? (
                            <span className=\"rounded-full border border-border bg-bg px-2 py-1\">
                              Sempre preparadas: {exception.alwaysPreparedAbilityIds?.length ?? 0} / {selectedPreset.alwaysPreparedSelectionCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className=\"mt-4 grid gap-3 md:grid-cols-2\">""",
)

# Manual limit edits make the configuration custom instead of claiming it still matches a preset.
p = Path('src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx')
text = p.read_text()
for old, new in [
    ("...current,\n                            learnedLimitFormulaOverride: value,", "...current,\n                            presetId: undefined,\n                            learnedLimitFormulaOverride: value,"),
    ("...current,\n                            extraLearnedSlots: value,", "...current,\n                            presetId: undefined,\n                            extraLearnedSlots: value,"),
    ("...current,\n                            preparedLimitFormulaOverride: value,", "...current,\n                            presetId: undefined,\n                            preparedLimitFormulaOverride: value,"),
    ("...current,\n                            extraPreparedSlots: value,", "...current,\n                            presetId: undefined,\n                            extraPreparedSlots: value,"),
]:
    if old not in text:
        raise SystemExit(f'manual exception edit anchor missing: {old!r}')
    text = text.replace(old, new, 1)
p.write_text(text)

replace_once(
    'src/features/characters/settings/CustomSystemAcquisitionExceptionsModal.tsx',
    "function abilityName(\n",
    """function countSelectedAlwaysLearned(
  exception: CustomAbilityAcquisitionExceptionState,
): number {
  return new Set([
    ...(exception.alwaysLearnedAbilityIds ?? []),
    ...(exception.alwaysPreparedAbilityIds ?? []),
  ]).size
}

function abilityName(
""",
)
