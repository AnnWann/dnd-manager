import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Select } from '../../components/ui/Select'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type { AbilityActionKind, AbilityKind } from '../../models/abilities/Ability'
import type {
  CustomAbilityAcquisitionDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityTypeDefinition,
  CustomUsageResetKind,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'

const NATIVE_RESOURCES = [
  ['hitPoints', 'Pontos de vida'],
  ['temporaryHitPoints', 'Pontos de vida temporários'],
  ['inspiration', 'Inspiração'],
  ['exhaustion', 'Exaustão'],
] as const

const ABILITY_KINDS: Array<[AbilityKind | '', string]> = [
  ['', 'Não definido'],
  ['active', 'Ativa'],
  ['passive', 'Passiva'],
  ['feature', 'Característica'],
]

const ACTION_KINDS: Array<[AbilityActionKind | '', string]> = [
  ['', 'Não exibir como ação'],
  ['action', 'Ação'],
  ['bonusAction', 'Ação bônus'],
  ['reaction', 'Reação'],
  ['free', 'Ação livre'],
  ['legendaryAction', 'Ação lendária'],
  ['legendaryReaction', 'Reação lendária'],
  ['legendaryResistance', 'Resistência lendária'],
]

const RESET_KINDS: Array<[CustomUsageResetKind, string]> = [
  ['turn', 'Início do turno'],
  ['combat', 'Fim do combate'],
  ['shortRest', 'Descanso curto'],
  ['longRest', 'Descanso longo'],
  ['manual', 'Manual'],
  ['never', 'Nunca'],
]

export function CustomAbilityConfigurationEditor({
  draft,
  setDraft,
  definitions,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  definitions: CustomSystemDefinition[]
}) {
  const [selected, setSelected] = useState(0)
  const type = draft.abilityTypes[selected]

  useEffect(() => {
    if (selected >= draft.abilityTypes.length) {
      setSelected(Math.max(0, draft.abilityTypes.length - 1))
    }
  }, [draft.abilityTypes.length, selected])

  function addType() {
    const id = uniqueId('tipo-habilidade', draft.abilityTypes.map((entry) => entry.id))
    const next: CustomAbilityTypeDefinition = {
      id,
      name: 'Novo tipo de habilidade',
      description: '',
      fields: [],
      display: { titleFieldId: '' },
      acquisition: {
        mode: 'learned',
        defaultLearned: true,
        defaultPrepared: false,
        preparationReset: 'manual',
      },
      activation: {
        kind: 'active',
        actionKind: 'action',
        usage: { mode: 'unlimited', reset: 'manual' },
      },
      predefinedAbilities: [],
    }
    setDraft({ ...draft, abilityTypes: [...draft.abilityTypes, next] })
    setSelected(draft.abilityTypes.length)
  }

  function replaceType(next: CustomAbilityTypeDefinition) {
    setDraft({
      ...draft,
      abilityTypes: draft.abilityTypes.map((entry, index) =>
        index === selected ? next : entry,
      ),
    })
  }

  function removeType() {
    if (!type) return
    if (type.predefinedAbilities?.length && !window.confirm(
      `O tipo “${type.name}” possui ${type.predefinedAbilities.length} habilidade(s) no compêndio. Remover o tipo também remove essas definições. Continuar?`,
    )) return
    setDraft({
      ...draft,
      abilityTypes: draft.abilityTypes.filter((_, index) => index !== selected),
    })
    setSelected(Math.max(0, selected - 1))
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="self-start rounded-xl border border-border bg-bg p-3 xl:sticky xl:top-3">
        <div>
          <h2 className="font-semibold text-textH">Tipos de habilidade</h2>
          <p className="mt-1 text-xs leading-5 text-text">
            Cada tipo define a estrutura e o comportamento padrão das habilidades. Exceções individuais ficam no compêndio.
          </p>
        </div>
        <button
          type="button"
          onClick={addType}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-medium text-accentText"
        >
          <Plus className="h-4 w-4" /> Criar tipo de habilidade
        </button>
        <div className="mt-3 grid gap-2">
          {draft.abilityTypes.map((entry, index) => (
            <button
              key={entry.id || `type-${index}`}
              type="button"
              onClick={() => setSelected(index)}
              className={`rounded-lg border p-3 text-left ${
                index === selected
                  ? 'border-accent bg-accentBg'
                  : 'border-border hover:bg-bg-subtle'
              }`}
            >
              <div className="truncate text-sm font-medium text-textH">{entry.name}</div>
              <div className="mt-1 truncate font-mono text-[11px] text-textMuted">{entry.id}</div>
              <div className="mt-1 text-[11px] text-textMuted">
                {entry.predefinedAbilities?.length ?? 0} no compêndio
              </div>
            </button>
          ))}
          {!draft.abilityTypes.length ? (
            <Empty>Crie o primeiro tipo de habilidade aqui. Não é mais necessário ir para Avançado.</Empty>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0">
        {type ? (
          <TypeEditor
            type={type}
            currentSystem={draft}
            definitions={definitions}
            onChange={replaceType}
            onRemove={removeType}
          />
        ) : (
          <Empty>Selecione ou crie um tipo de habilidade.</Empty>
        )}
      </main>
    </div>
  )
}

function TypeEditor({
  type,
  currentSystem,
  definitions,
  onChange,
  onRemove,
}: {
  type: CustomAbilityTypeDefinition
  currentSystem: CustomSystemDefinition
  definitions: CustomSystemDefinition[]
  onChange: (type: CustomAbilityTypeDefinition) => void
  onRemove: () => void
}) {
  const acquisition = normalizeAcquisition(type.acquisition)
  const activation = type.activation ?? {}
  const usage = activation.usage ?? { mode: 'unlimited' as const, reset: 'manual' as const }
  const usageMode = usage.mode ?? (usage.maximum !== undefined || usage.maximumFormula ? 'limited' : 'unlimited')
  const changes = activation.resourceChanges ?? []

  const patchActivation = (patch: Partial<typeof activation>) =>
    onChange({ ...type, activation: { ...activation, ...patch } })
  const patchAcquisition = (patch: Partial<CustomAbilityAcquisitionDefinition>) =>
    onChange({ ...type, acquisition: { ...acquisition, ...patch } })
  const patchUsage = (patch: Partial<typeof usage>) =>
    patchActivation({ usage: { ...usage, ...patch } })
  const setChanges = (resourceChanges: CustomAbilityResourceChangeDefinition[]) =>
    patchActivation({ resourceChanges })

  return (
    <div className="grid gap-4">
      <header className="rounded-xl border border-border bg-bg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textH">{type.name}</h2>
            <p className="mt-1 text-sm text-text">
              Configure toda a regra padrão deste tipo neste painel. Habilidades específicas podem sobrescrever essas regras no compêndio.
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" /> Remover tipo
          </button>
        </div>
      </header>

      <Section title="1. Identificação" description="Nome, ID e descrição usados pelo sistema e pelo compêndio.">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Nome" value={type.name} onChange={(name) => onChange({ ...type, name })} />
          <TextField label="ID" value={type.id} onChange={(id) => onChange({ ...type, id: slug(id) })} />
          <TextField label="Ícone" value={type.icon ?? ''} onChange={(icon) => onChange({ ...type, icon: icon || undefined })} />
          <TextArea label="Descrição" value={type.description ?? ''} onChange={(description) => onChange({ ...type, description: description || undefined })} />
        </div>
      </Section>

      <Section title="2. Campos da habilidade" description="Defina os dados que cada habilidade deste tipo possui.">
        <AbilityFields
          fields={type.fields}
          onChange={(fields) => onChange({
            ...type,
            fields,
            display: normalizeDisplayAfterFields(type.display, fields),
          })}
        />
      </Section>

      <Section title="3. Exibição" description="Escolha quais campos aparecem como título, descrição, subtítulos e destaques.">
        <div className="grid gap-3 md:grid-cols-2">
          <ReferenceSelect
            label="Campo do título"
            value={type.display.titleFieldId}
            fields={type.fields}
            allowEmpty
            onChange={(titleFieldId) => onChange({ ...type, display: { ...type.display, titleFieldId } })}
          />
          <ReferenceSelect
            label="Campo da descrição"
            value={type.display.descriptionFieldId ?? ''}
            fields={type.fields}
            allowEmpty
            onChange={(descriptionFieldId) => onChange({ ...type, display: { ...type.display, descriptionFieldId: descriptionFieldId || undefined } })}
          />
          <FieldListSelect
            label="Campos do subtítulo"
            values={type.display.subtitleFieldIds ?? []}
            fields={type.fields}
            onChange={(subtitleFieldIds) => onChange({ ...type, display: { ...type.display, subtitleFieldIds } })}
          />
          <FieldListSelect
            label="Campos em destaque"
            values={type.display.badgeFieldIds ?? []}
            fields={type.fields}
            onChange={(badgeFieldIds) => onChange({ ...type, display: { ...type.display, badgeFieldIds } })}
          />
        </div>
      </Section>

      <Section title="4. Aquisição e preparo" description="Como habilidades deste tipo entram e ficam disponíveis na ficha.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Modelo"
            value={acquisition.mode}
            options={[
              ['granted', 'Concedida automaticamente'],
              ['learned', 'Aprendida'],
              ['prepared', 'Preparada diretamente'],
              ['learnedAndPrepared', 'Aprendida e preparada'],
            ]}
            onChange={(mode) => patchAcquisition({ mode: mode as CustomAbilityAcquisitionDefinition['mode'] })}
          />
          {usesLearned(acquisition.mode) ? <>
            <NumberField label="Limite aprendido" value={acquisition.learnedLimit} placeholder="Sem limite" onChange={(learnedLimit) => patchAcquisition({ learnedLimit })} />
            <FormulaField definition={currentSystem} label="Fórmula do limite aprendido" value={acquisition.learnedLimitFormula ?? ''} placeholder="Ex.: character.level + 2" onChange={(learnedLimitFormula) => patchAcquisition({ learnedLimitFormula: learnedLimitFormula || undefined })} />
          </> : null}
          {usesPrepared(acquisition.mode) ? <>
            <NumberField label="Limite preparado" value={acquisition.preparedLimit} placeholder="Sem limite" onChange={(preparedLimit) => patchAcquisition({ preparedLimit })} />
            <FormulaField definition={currentSystem} label="Fórmula do limite preparado" value={acquisition.preparedLimitFormula ?? ''} placeholder="Ex.: character.proficiencyBonus" onChange={(preparedLimitFormula) => patchAcquisition({ preparedLimitFormula: preparedLimitFormula || undefined })} />
            <SelectField label="Alterar preparo" value={acquisition.preparationReset ?? 'manual'} options={[
              ['manual', 'A qualquer momento'], ['shortRest', 'Durante descanso curto'], ['longRest', 'Durante descanso longo'],
            ]} onChange={(preparationReset) => patchAcquisition({ preparationReset: preparationReset as 'manual' | 'shortRest' | 'longRest' })} />
          </> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-textH">
          {usesLearned(acquisition.mode) ? <Check label="Novas começam aprendidas" checked={acquisition.defaultLearned !== false} onChange={(defaultLearned) => patchAcquisition({ defaultLearned })} /> : null}
          {usesPrepared(acquisition.mode) ? <Check label="Novas começam preparadas" checked={Boolean(acquisition.defaultPrepared)} onChange={(defaultPrepared) => patchAcquisition({ defaultPrepared })} /> : null}
        </div>
      </Section>

      <Section title="5. Ativação e ação" description="Esta é a regra padrão. Se houver exceção, configure-a diretamente na habilidade do compêndio.">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Tipo geral"
            value={activation.kind ?? ''}
            options={ABILITY_KINDS}
            onChange={(kind) => patchActivation({ kind: (kind || undefined) as AbilityKind | undefined })}
          />
          <SelectField
            label="Categoria na seção de ações"
            value={normalizeActionKind(activation.actionKind) ?? ''}
            options={ACTION_KINDS}
            onChange={(actionKind) => patchActivation({ actionKind: (actionKind || undefined) as AbilityActionKind | undefined })}
          />
        </div>
        <p className="mt-2 text-xs text-textMuted">
          Habilidades com categoria de ação aparecem automaticamente na seção Ações da ficha.
        </p>
      </Section>

      <Section title="6. Usos" description="Pode ser ilimitada, possuir máximo fixo ou calcular o máximo por fórmula.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Quantidade de usos"
            value={usageMode}
            options={[['unlimited', 'Ilimitados'], ['limited', 'Limitados']]}
            onChange={(mode) => {
              if (mode === 'unlimited') {
                patchActivation({ usage: { mode: 'unlimited', reset: 'manual' } })
              } else {
                patchActivation({ usage: { ...usage, mode: 'limited', reset: usage.reset ?? 'manual' } })
              }
            }}
          />
          {usageMode === 'limited' ? <>
            <NumberField label="Máximo fixo" value={usage.maximum} placeholder="Opcional" onChange={(maximum) => patchUsage({ maximum })} />
            <SelectField label="Recuperação" value={usage.reset ?? 'manual'} options={RESET_KINDS} onChange={(reset) => patchUsage({ reset: reset as CustomUsageResetKind })} />
          </> : null}
        </div>
        {usageMode === 'limited' ? (
          <FormulaField
            definition={currentSystem}
            label="Fórmula do máximo"
            value={usage.maximumFormula ?? ''}
            placeholder="Ex.: character.proficiencyBonus + 1"
            onChange={(maximumFormula) => patchUsage({ maximumFormula: maximumFormula || undefined })}
          />
        ) : null}
      </Section>

      <Section title="7. Alterações de recurso" description="Efeitos padrão executados quando a habilidade é usada.">
        <div className="grid gap-3">
          {changes.map((change, index) => (
            <ResourceChangeRow
              key={change.id}
              change={change}
              definitions={definitions}
              currentSystem={currentSystem}
              onChange={(next) => setChanges(changes.map((entry, current) => current === index ? next : entry))}
              onRemove={() => setChanges(changes.filter((_, current) => current !== index))}
            />
          ))}
          {!changes.length ? <Empty>Nenhuma alteração de recurso padrão.</Empty> : null}
        </div>
        <button
          type="button"
          onClick={() => setChanges([...changes, newResourceChange(currentSystem)])}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg"
        >
          <Plus className="h-4 w-4" /> Adicionar alteração de recurso
        </button>
      </Section>
    </div>
  )
}

function AbilityFields({ fields, onChange }: {
  fields: CustomFieldDefinition[]
  onChange: (fields: CustomFieldDefinition[]) => void
}) {
  function add() {
    onChange([...fields, {
      id: uniqueId('campo', fields.map((entry) => entry.id)),
      name: 'Novo campo',
      type: 'text',
      editPermission: 'ownerAndMaster',
    }])
  }

  return (
    <div className="grid gap-3">
      {fields.map((field, index) => (
        <article key={`${field.id}-${index}`} className="rounded-lg border border-border bg-bg-subtle p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
            <TextField label="Nome" value={field.name} onChange={(name) => onChange(fields.map((entry, current) => current === index ? { ...entry, name } : entry))} />
            <TextField label="ID" value={field.id} onChange={(id) => onChange(fields.map((entry, current) => current === index ? { ...entry, id: slug(id) } : entry))} />
            <SelectField label="Tipo" value={field.type} options={[
              ['text', 'Texto'], ['richText', 'Texto longo'], ['number', 'Número'], ['boolean', 'Sim/Não'],
              ['select', 'Seleção'], ['multiSelect', 'Seleção múltipla'], ['dice', 'Dado'], ['reference', 'Referência'], ['formula', 'Fórmula'],
            ]} onChange={(nextType) => onChange(fields.map((entry, current) => current === index ? makeFieldOfType(entry, nextType as CustomFieldDefinition['type']) : entry))} />
            <div className="flex items-end">
              <button type="button" title="Remover campo" onClick={() => onChange(fields.filter((_, current) => current !== index))} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </article>
      ))}
      <button type="button" onClick={add} className="justify-self-start inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg"><Plus className="h-4 w-4" /> Adicionar campo</button>
      {!fields.length ? <Empty>Nenhum campo. Você pode criar habilidades sem campos ou adicionar os dados necessários.</Empty> : null}
    </div>
  )
}

function ResourceChangeRow({
  change,
  definitions,
  currentSystem,
  onChange,
  onRemove,
}: {
  change: CustomAbilityResourceChangeDefinition
  definitions: CustomSystemDefinition[]
  currentSystem: CustomSystemDefinition
  onChange: (change: CustomAbilityResourceChangeDefinition) => void
  onRemove: () => void
}) {
  const customTarget = change.target.source === 'customSystem' ? change.target : undefined
  const selectedSystemId = customTarget?.systemId ?? currentSystem.id
  const selectedSystem = definitions.find((entry) => entry.id === selectedSystemId)
    ?? (currentSystem.id === selectedSystemId ? currentSystem : undefined)

  return (
    <article className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <FieldCell><SelectField label="Operação" value={change.operation} options={[['spend', 'Gastar'], ['gain', 'Gerar'], ['set', 'Definir valor']]} onChange={(operation) => onChange({ ...change, operation: operation as CustomAbilityResourceChangeDefinition['operation'] })} /></FieldCell>
        <FieldCell><SelectField label="Origem" value={change.target.source} options={[['native', 'Recurso nativo'], ['customSystem', 'Sistema personalizado']]} onChange={(source) => onChange({ ...change, target: source === 'native' ? { source: 'native', resource: 'hitPoints' } : { source: 'customSystem', systemId: currentSystem.id, resourceId: currentSystem.resources[0]?.id ?? '' } })} /></FieldCell>
        {change.target.source === 'native' ? (
          <FieldCell><SelectField label="Recurso" value={change.target.resource} options={NATIVE_RESOURCES} onChange={(resource) => onChange({ ...change, target: { source: 'native', resource: resource as 'hitPoints' | 'temporaryHitPoints' | 'inspiration' | 'exhaustion' } })} /></FieldCell>
        ) : <>
          <FieldCell><SelectField label="Sistema" value={selectedSystemId} options={uniqueSystems(currentSystem, definitions).map((entry) => [entry.id, entry.name])} onChange={(systemId) => {
            const system = definitions.find((entry) => entry.id === systemId) ?? (currentSystem.id === systemId ? currentSystem : undefined)
            onChange({ ...change, target: { source: 'customSystem', systemId, resourceId: system?.resources[0]?.id ?? '' } })
          }} /></FieldCell>
          <FieldCell><SelectField label="Recurso" value={customTarget?.resourceId ?? ''} options={(selectedSystem?.resources ?? []).map((entry) => [entry.id, entry.name])} onChange={(resourceId) => onChange({ ...change, target: { source: 'customSystem', systemId: selectedSystemId, resourceId } })} /></FieldCell>
        </>}
        <div className="min-w-[8rem] flex-[0.65_1_8rem]"><NumberField label="Quantidade" value={change.amount} placeholder="1" onChange={(amount) => onChange({ ...change, amount })} /></div>
        <button type="button" onClick={onRemove} className="shrink-0 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10">Remover</button>
      </div>
      <FormulaField definition={currentSystem} label="Fórmula opcional da quantidade" value={change.formula ?? ''} placeholder="Substitui a quantidade fixa" onChange={(formula) => onChange({ ...change, formula: formula || undefined })} />
    </article>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-bg p-4"><h3 className="font-semibold text-textH">{title}</h3>{description ? <p className="mt-1 text-xs leading-5 text-text">{description}</p> : null}<div className="mt-4">{children}</div></section>
}

function FieldCell({ children }: { children: ReactNode }) {
  return <div className="min-w-[11rem] flex-[1_1_11rem]">{children}</div>
}

function FormulaField({ definition, label, value, onChange, placeholder }: {
  definition: CustomSystemDefinition
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const error = value.trim() ? validateCustomFormula(value, definition) : undefined
  return <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg/30 p-3"><label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base min-w-0 w-full font-mono" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label><div className="mt-2"><FormulaVariablePicker variables={listCustomFormulaVariables(definition)} onSelect={(path) => onChange(`${value}${value.trim() ? ' ' : ''}${path}`)} /></div>{value.trim() ? <div className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</div> : null}</div>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><Select className="min-w-0 w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id || 'empty'} value={id}>{name}</option>)}</Select></label>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base min-w-0 w-full" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><textarea rows={3} className="input-base min-w-0 w-full resize-y" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value?: number; onChange: (value: number | undefined) => void; placeholder?: string }) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base min-w-0 w-full" type="number" min={0} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0))} /></label>
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>
}

function ReferenceSelect({ label, value, fields, onChange, allowEmpty }: { label: string; value: string; fields: CustomFieldDefinition[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return <SelectField label={label} value={value} options={[...(allowEmpty ? [['', 'Nenhum'] as const] : []), ...fields.map((field) => [field.id, field.name] as const)]} onChange={onChange} />
}

function FieldListSelect({ label, values, fields, onChange }: { label: string; values: string[]; fields: CustomFieldDefinition[]; onChange: (values: string[]) => void }) {
  return <div className="min-w-0"><div className="label mb-1">{label}</div><div className="grid gap-2">{values.map((value, index) => <div key={`${value}-${index}`} className="flex min-w-0 gap-2"><select className="input-base min-w-0 flex-1" value={value} onChange={(event) => onChange(values.map((entry, current) => current === index ? event.target.value : entry))}>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><button type="button" onClick={() => onChange(values.filter((_, current) => current !== index))} className="shrink-0 rounded-lg border border-border p-2 text-textMuted hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" disabled={!fields.length} onClick={() => fields[0] && onChange([...values, fields[0].id])} className="justify-self-start rounded-lg border border-border px-3 py-2 text-xs text-textH disabled:opacity-40">Adicionar</button></div></div>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text">{children}</div>
}

function normalizeAcquisition(value?: CustomAbilityAcquisitionDefinition): CustomAbilityAcquisitionDefinition {
  return value ?? { mode: 'learned', defaultLearned: true, defaultPrepared: false, preparationReset: 'manual' }
}

function usesLearned(mode: CustomAbilityAcquisitionDefinition['mode']) {
  return mode === 'learned' || mode === 'learnedAndPrepared'
}

function usesPrepared(mode: CustomAbilityAcquisitionDefinition['mode']) {
  return mode === 'prepared' || mode === 'learnedAndPrepared'
}

function normalizeActionKind(value: unknown): AbilityActionKind | undefined {
  if (value === 'freeAction') return 'free'
  return ACTION_KINDS.some(([kind]) => kind && kind === value) ? value as AbilityActionKind : undefined
}

function newResourceChange(system: CustomSystemDefinition): CustomAbilityResourceChangeDefinition {
  return system.resources.length
    ? { id: crypto.randomUUID(), target: { source: 'customSystem', systemId: system.id, resourceId: system.resources[0].id }, operation: 'spend', amount: 1 }
    : { id: crypto.randomUUID(), target: { source: 'native', resource: 'hitPoints' }, operation: 'spend', amount: 1 }
}

function uniqueSystems(current: CustomSystemDefinition, definitions: CustomSystemDefinition[]) {
  return Array.from(new Map([current, ...definitions].map((entry) => [entry.id, entry])).values())
}

function normalizeDisplayAfterFields(display: CustomAbilityTypeDefinition['display'], fields: CustomFieldDefinition[]) {
  const ids = new Set(fields.map((field) => field.id))
  return {
    ...display,
    titleFieldId: ids.has(display.titleFieldId) ? display.titleFieldId : '',
    descriptionFieldId: display.descriptionFieldId && ids.has(display.descriptionFieldId) ? display.descriptionFieldId : undefined,
    subtitleFieldIds: (display.subtitleFieldIds ?? []).filter((id) => ids.has(id)),
    badgeFieldIds: (display.badgeFieldIds ?? []).filter((id) => ids.has(id)),
  }
}

function makeFieldOfType(field: CustomFieldDefinition, type: CustomFieldDefinition['type']): CustomFieldDefinition {
  const base = { id: field.id, name: field.name, description: field.description, required: field.required, editPermission: field.editPermission }
  if (type === 'number') return { ...base, type }
  if (type === 'boolean') return { ...base, type }
  if (type === 'select' || type === 'multiSelect') return { ...base, type, options: [] }
  if (type === 'dice') return { ...base, type }
  if (type === 'reference') return { ...base, type, target: 'character' }
  if (type === 'formula') return { ...base, type, formula: '', resultType: 'number', editPermission: 'automaticOnly' }
  return { ...base, type }
}

function uniqueId(base: string, used: string[]) {
  if (!used.includes(base)) return base
  let index = 2
  while (used.includes(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}
