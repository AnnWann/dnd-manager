import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react'
import { listCustomFormulaVariables, type CustomFormulaVariable } from '../../lib/customSystems'
import { useCustomSystemDefinitions } from '../../lib/customSystems/CustomSystemRegistry'
import type {
  CustomAutomationDefinition,
  CustomComparisonOperator,
  CustomCondition,
  CustomEffectDefinition,
  CustomNumericOperation,
  CustomOperand,
  CustomSystemEventType,
} from '../../models/customSystems/CustomAutomationDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type {
  CustomPanelBlock,
  CustomPanelDefinition,
  CustomPanelLocation,
} from '../../models/customSystems/CustomPanelDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'

export function AdvancedSystemEditors({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const [tab, setTab] = useState<'panels' | 'automations' | 'json'>('panels')

  return <div>
    <div className="mb-4 rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
      Tipos, campos, aquisição, ativação, ações e usos de habilidades agora são configurados integralmente na aba <strong>Habilidades</strong>. O compêndio contém apenas as exceções específicas de cada habilidade.
    </div>
    <nav className="mb-4 flex flex-wrap gap-2 rounded-lg border border-border p-2">
      {([
        ['panels', 'Painéis'],
        ['automations', 'Automações'],
        ['json', 'JSON'],
      ] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm ${tab === id ? 'bg-accent text-accentText' : 'text-text hover:bg-accentBg'}`}>
          {label}
        </button>
      ))}
    </nav>

    {tab === 'panels' ? <PanelsEditor draft={draft} setDraft={setDraft} /> : null}
    {tab === 'automations' ? <AutomationsEditor draft={draft} setDraft={setDraft} /> : null}
    {tab === 'json' ? <JsonEditor draft={draft} setDraft={setDraft} /> : null}
  </div>
}

function PanelsEditor({ draft, setDraft }: EditorProps) {
  const [selected, setSelected] = useState(0)
  const current = draft.panels[selected]

  function replace(next: CustomPanelDefinition) {
    setDraft({ ...draft, panels: draft.panels.map((entry, index) => index === selected ? next : entry) })
  }

  function add() {
    const next: CustomPanelDefinition = { id: uniqueId('panel', draft.panels.map((entry) => entry.id)), name: 'Novo painel', location: 'main', blocks: [] }
    setDraft({ ...draft, panels: [...draft.panels, next] })
    setSelected(draft.panels.length)
  }

  function remove() {
    setDraft({ ...draft, panels: draft.panels.filter((_, index) => index !== selected) })
    setSelected(Math.max(0, selected - 1))
  }

  return <MasterDetail title="Painéis" description="Monte seções da ficha usando campos, recursos, fórmulas, textos e listas de habilidades." items={draft.panels} selected={selected} onSelect={setSelected} onAdd={add} empty="Nenhum painel criado.">
    {current ? <div className="grid gap-4">
      <Section title="Informações gerais">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Nome" value={current.name} onChange={(name) => replace({ ...current, name })} />
          <Input label="ID" value={current.id} onChange={(id) => replace({ ...current, id: slugify(id) })} />
          <Select label="Local" value={current.location} options={['main','sidebar','combat','abilities','resources','customTab']} labels={['Principal','Barra lateral','Combate','Habilidades','Recursos','Aba personalizada']} onChange={(location) => replace({ ...current, location: location as CustomPanelLocation })} />
        </div>
      </Section>

      <Section title="Blocos do painel" description="A ordem abaixo é a ordem de exibição na ficha.">
        <PanelBlocksEditor blocks={current.blocks} draft={draft} onChange={(blocks) => replace({ ...current, blocks })} />
      </Section>

      <DangerButton onClick={remove}>Remover painel</DangerButton>
    </div> : null}
  </MasterDetail>
}

function PanelBlocksEditor({ blocks, draft, onChange }: { blocks: CustomPanelBlock[]; draft: CustomSystemDefinition; onChange: (blocks: CustomPanelBlock[]) => void }) {
  function add(type: CustomPanelBlock['type']) {
    const id = uniqueId('block', blocks.map((entry) => entry.id))
    const block: CustomPanelBlock = type === 'resource' ? { id, type, resourceId: draft.resources[0]?.id ?? '', display: 'number' }
      : type === 'field' ? { id, type, fieldId: draft.fields[0]?.id ?? '' }
      : type === 'abilityList' ? { id, type, abilityTypeId: draft.abilityTypes[0]?.id ?? '', layout: 'list' }
      : type === 'text' ? { id, type, content: '' }
      : type === 'formulaDisplay' ? { id, type, formula: '0', label: 'Resultado' }
      : type === 'grid' ? { id, type, columns: 2, blocks: [] }
      : { id, type: 'divider' }
    onChange([...blocks, block])
  }

  function replace(index: number, block: CustomPanelBlock) { onChange(blocks.map((entry, current) => current === index ? block : entry)) }
  function remove(index: number) { onChange(blocks.filter((_, current) => current !== index)) }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return <div>
    <div className="mb-3 flex flex-wrap gap-2">
      {([
        ['resource','Recurso'],['field','Campo'],['abilityList','Lista de habilidades'],['text','Texto'],['formulaDisplay','Fórmula'],['divider','Divisor'],['grid','Grade'],
      ] as const).map(([type, label]) => <SmallButton key={type} onClick={() => add(type)}><Plus className="h-3.5 w-3.5" /> {label}</SmallButton>)}
    </div>
    <div className="grid gap-3">
      {blocks.map((block, index) => <article key={`block-${index}`} className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <strong className="text-sm text-textH">{blockTypeLabel(block.type)}</strong>
          <div className="flex gap-1">
            <IconButton title="Mover para cima" onClick={() => move(index, -1)}><ChevronUp className="h-4 w-4" /></IconButton>
            <IconButton title="Mover para baixo" onClick={() => move(index, 1)}><ChevronDown className="h-4 w-4" /></IconButton>
            <IconButton title="Remover bloco" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Título opcional" value={block.title ?? ''} onChange={(title) => replace(index, { ...block, title: title || undefined })} />
          {block.type === 'resource' ? <><ReferenceSelect label="Recurso" value={block.resourceId} options={draft.resources} onChange={(resourceId) => replace(index, { ...block, resourceId })} /><Select label="Exibição" value={block.display} options={['number','bar','checkboxes','dicePool']} labels={['Número','Barra','Caixas','Dados']} onChange={(display) => replace(index, { ...block, display: display as any })} /></> : null}
          {block.type === 'field' ? <ReferenceSelect label="Campo" value={block.fieldId} options={draft.fields} onChange={(fieldId) => replace(index, { ...block, fieldId })} /> : null}
          {block.type === 'abilityList' ? <><ReferenceSelect label="Tipo de habilidade" value={block.abilityTypeId} options={draft.abilityTypes} onChange={(abilityTypeId) => replace(index, { ...block, abilityTypeId })} /><Select label="Layout" value={block.layout ?? 'list'} options={['list','cards','compact']} labels={['Lista','Cartões','Compacto']} onChange={(layout) => replace(index, { ...block, layout: layout as any })} /></> : null}
          {block.type === 'text' ? <TextArea label="Conteúdo" value={block.content} onChange={(content) => replace(index, { ...block, content })} /> : null}
          {block.type === 'formulaDisplay' ? <><Input label="Rótulo" value={block.label ?? ''} onChange={(label) => replace(index, { ...block, label: label || undefined })} /><Input label="Fórmula" value={block.formula} onChange={(formula) => replace(index, { ...block, formula })} /></> : null}
          {block.type === 'grid' ? <Select label="Colunas" value={String(block.columns)} options={['1','2','3','4']} onChange={(columns) => replace(index, { ...block, columns: Number(columns) as 1|2|3|4 })} /> : null}
        </div>
      </article>)}
      {!blocks.length ? <Empty>Nenhum bloco adicionado.</Empty> : null}
    </div>
  </div>
}

function AutomationsEditor({ draft, setDraft }: EditorProps) {
  const [selected, setSelected] = useState(0)
  const registeredDefinitions = useCustomSystemDefinitions()
  const definitions = useMemo(
    () => [draft, ...registeredDefinitions.filter((entry) => entry.id !== draft.id)],
    [draft, registeredDefinitions],
  )
  const variables = useMemo(
    () => automationFormulaVariables(draft, definitions),
    [draft, definitions],
  )
  const current = draft.automations[selected]

  function replace(next: CustomAutomationDefinition) {
    setDraft({ ...draft, automations: draft.automations.map((entry, index) => index === selected ? next : entry) })
  }

  function add() {
    const next: CustomAutomationDefinition = { id: uniqueId('automation', draft.automations.map((entry) => entry.id)), name: 'Nova automação', event: 'manual', enabled: true, conditions: [], effects: [] }
    setDraft({ ...draft, automations: [...draft.automations, next] })
    setSelected(draft.automations.length)
  }

  function remove() {
    setDraft({ ...draft, automations: draft.automations.filter((_, index) => index !== selected) })
    setSelected(Math.max(0, selected - 1))
  }

  return <MasterDetail title="Automações" description="Execute efeitos automaticamente quando eventos da ficha ou do combate acontecerem." items={draft.automations} selected={selected} onSelect={setSelected} onAdd={add} empty="Nenhuma automação criada.">
    {current ? <div className="grid gap-4">
      <Section title="Informações gerais">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nome" value={current.name} onChange={(name) => replace({ ...current, name })} />
          <Input label="ID" value={current.id} onChange={(id) => replace({ ...current, id: slugify(id) })} />
          <Select label="Evento" value={current.event} options={EVENTS} labels={EVENT_LABELS} onChange={(event) => replace({ ...current, event: event as CustomSystemEventType })} />
          <Check label="Automação habilitada" checked={current.enabled !== false} onChange={(enabled) => replace({ ...current, enabled })} />
        </div>
      </Section>

      <Section title="Condições" description="Todas as condições precisam ser verdadeiras para a automação executar.">
        <ConditionsEditor conditions={current.conditions ?? []} draft={draft} definitions={definitions} variables={variables} onChange={(conditions) => replace({ ...current, conditions })} />
      </Section>

      <Section title="Efeitos" description="Os efeitos são executados na ordem exibida. Campos e recursos podem pertencer a qualquer sistema personalizado instalado.">
        <EffectsEditor effects={current.effects} draft={draft} definitions={definitions} variables={variables} onChange={(effects) => replace({ ...current, effects })} />
      </Section>

      <DangerButton onClick={remove}>Remover automação</DangerButton>
    </div> : null}
  </MasterDetail>
}

function ConditionsEditor({ conditions, draft, definitions, variables, onChange }: {
  conditions: CustomCondition[]
  draft: CustomSystemDefinition
  definitions: CustomSystemDefinition[]
  variables: CustomFormulaVariable[]
  onChange: (conditions: CustomCondition[]) => void
}) {
  function add() { onChange([...conditions, { left: defaultOperand('field', draft, definitions), operator: 'equals', right: { type: 'literal', value: true } }]) }
  function replace(index: number, condition: CustomCondition) { onChange(conditions.map((entry, current) => current === index ? condition : entry)) }
  return <div className="grid gap-3">
    <div><SmallButton onClick={add}><Plus className="h-3.5 w-3.5" /> Adicionar condição</SmallButton></div>
    {conditions.map((condition, index) => <article key={`condition-${index}`} className="rounded-lg border border-border p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_200px_1fr_auto]">
        <OperandEditor label="Valor esquerdo" operand={condition.left} draft={draft} definitions={definitions} variables={variables} onChange={(left) => replace(index, { ...condition, left })} />
        <Select label="Comparação" value={condition.operator} options={OPERATORS} labels={OPERATOR_LABELS} onChange={(operator) => replace(index, { ...condition, operator: operator as CustomComparisonOperator })} />
        {!['isTruthy','isFalsy'].includes(condition.operator) ? <OperandEditor label="Valor direito" operand={condition.right ?? { type: 'literal', value: true }} draft={draft} definitions={definitions} variables={variables} onChange={(right) => replace(index, { ...condition, right })} /> : <div />}
        <div className="flex items-end"><IconButton title="Remover condição" onClick={() => onChange(conditions.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></IconButton></div>
      </div>
    </article>)}
    {!conditions.length ? <Empty>Nenhuma condição. A automação sempre será executada.</Empty> : null}
  </div>
}

function OperandEditor({ label, operand, draft, definitions, variables, onChange }: {
  label: string
  operand: CustomOperand
  draft: CustomSystemDefinition
  definitions: CustomSystemDefinition[]
  variables: CustomFormulaVariable[]
  onChange: (operand: CustomOperand) => void
}) {
  const selectedSystemId = operand.type === 'field' || operand.type === 'resource'
    ? operand.systemId ?? draft.id
    : draft.id
  const selectedDefinition = definitions.find((entry) => entry.id === selectedSystemId) ?? draft
  const characterVariables = variables.filter((entry) => entry.path.startsWith('character.'))

  return <div className="grid gap-2">
    <Select label={label} value={operand.type} options={['literal','field','resource','characterPath','formula']} labels={['Valor fixo','Campo de sistema','Recurso de sistema','Variável da ficha','Fórmula']} onChange={(type) => onChange(defaultOperand(type, draft, definitions))} />
    {operand.type === 'literal' ? <Input label="Valor" value={String(operand.value ?? '')} onChange={(value) => onChange({ ...operand, value: parseLiteral(value) })} /> : null}
    {operand.type === 'field' ? <>
      <SystemSelect value={selectedSystemId} definitions={definitions} onChange={(systemId) => {
        const definition = definitions.find((entry) => entry.id === systemId) ?? draft
        onChange({ type: 'field', systemId: externalSystemId(systemId, draft.id), fieldId: readableFields(definition)[0]?.id ?? '' })
      }} />
      <ReferenceSelect label="Campo" value={operand.fieldId} options={readableFields(selectedDefinition)} allowEmpty onChange={(fieldId) => onChange({ ...operand, fieldId })} />
    </> : null}
    {operand.type === 'resource' ? <>
      <SystemSelect value={selectedSystemId} definitions={definitions} onChange={(systemId) => {
        const definition = definitions.find((entry) => entry.id === systemId) ?? draft
        onChange({ type: 'resource', systemId: externalSystemId(systemId, draft.id), resourceId: definition.resources[0]?.id ?? '', property: operand.property ?? 'current' })
      }} />
      <ReferenceSelect label="Recurso" value={operand.resourceId} options={selectedDefinition.resources} allowEmpty onChange={(resourceId) => onChange({ ...operand, resourceId })} />
      <Select label="Propriedade" value={operand.property ?? 'current'} options={['current','maximum','temporary']} labels={['Atual','Máximo','Temporário']} onChange={(property) => onChange({ ...operand, property: property as 'current' | 'maximum' | 'temporary' })} />
    </> : null}
    {operand.type === 'characterPath' ? <>
      <Input label="Caminho" value={operand.path} onChange={(path) => onChange({ ...operand, path })} />
      <FormulaVariablePicker variables={characterVariables} buttonLabel="Escolher variável" onSelect={(path) => onChange({ ...operand, path })} />
    </> : null}
    {operand.type === 'formula' ? <FormulaInput label="Fórmula" value={operand.formula} variables={variables} onChange={(formula) => onChange({ ...operand, formula })} /> : null}
  </div>
}

function EffectsEditor({ effects, draft, definitions, variables, onChange }: {
  effects: CustomEffectDefinition[]
  draft: CustomSystemDefinition
  definitions: CustomSystemDefinition[]
  variables: CustomFormulaVariable[]
  onChange: (effects: CustomEffectDefinition[]) => void
}) {
  function add(type: CustomEffectDefinition['type']) {
    const definition = type === 'modifyResource'
      ? firstDefinitionWithResources(definitions) ?? draft
      : type === 'modifyField'
        ? firstDefinitionWithNumericFields(definitions) ?? draft
        : firstDefinitionWithFields(definitions) ?? draft
    const systemId = externalSystemId(definition.id, draft.id)
    const effect: CustomEffectDefinition = type === 'modifyResource'
      ? { type, systemId, resourceId: definition.resources[0]?.id ?? '', operation: 'add', value: 1 }
      : type === 'setField'
        ? { type, systemId, fieldId: writableFields(definition)[0]?.id ?? '', value: true }
        : { type, systemId, fieldId: numericFields(definition)[0]?.id ?? '', operation: 'add', value: 1 }
    onChange([...effects, effect])
  }
  function replace(index: number, effect: CustomEffectDefinition) { onChange(effects.map((entry, current) => current === index ? effect : entry)) }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= effects.length) return
    const next = [...effects]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return <div className="grid gap-3">
    <div className="flex flex-wrap gap-2">
      <SmallButton onClick={() => add('modifyResource')}><Plus className="h-3.5 w-3.5" /> Modificar recurso</SmallButton>
      <SmallButton onClick={() => add('setField')}><Plus className="h-3.5 w-3.5" /> Definir campo</SmallButton>
      <SmallButton onClick={() => add('modifyField')}><Plus className="h-3.5 w-3.5" /> Modificar número</SmallButton>
    </div>
    {effects.map((effect, index) => {
      const selectedSystemId = effect.systemId ?? draft.id
      const selectedDefinition = definitions.find((entry) => entry.id === selectedSystemId) ?? draft
      const fields = effect.type === 'modifyField' ? numericFields(selectedDefinition) : writableFields(selectedDefinition)

      return <article key={`effect-${index}`} className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-textH">{effectTypeLabel(effect.type)}</strong><div className="flex gap-1"><IconButton title="Mover para cima" onClick={() => move(index, -1)}><ChevronUp className="h-4 w-4" /></IconButton><IconButton title="Mover para baixo" onClick={() => move(index, 1)}><ChevronDown className="h-4 w-4" /></IconButton><IconButton title="Remover efeito" onClick={() => onChange(effects.filter((_, current) => current !== index))}><Trash2 className="h-4 w-4" /></IconButton></div></div>
        <div className="grid gap-3 md:grid-cols-3">
          <SystemSelect value={selectedSystemId} definitions={definitions} onChange={(systemId) => {
            const definition = definitions.find((entry) => entry.id === systemId) ?? draft
            const nextSystemId = externalSystemId(systemId, draft.id)
            if (effect.type === 'modifyResource') replace(index, { ...effect, systemId: nextSystemId, resourceId: definition.resources[0]?.id ?? '' })
            else if (effect.type === 'modifyField') replace(index, { ...effect, systemId: nextSystemId, fieldId: numericFields(definition)[0]?.id ?? '' })
            else replace(index, { ...effect, systemId: nextSystemId, fieldId: writableFields(definition)[0]?.id ?? '' })
          }} />
          {effect.type === 'modifyResource'
            ? <ReferenceSelect label="Recurso" value={effect.resourceId} options={selectedDefinition.resources} allowEmpty onChange={(resourceId) => replace(index, { ...effect, resourceId })} />
            : <ReferenceSelect label="Campo" value={effect.fieldId} options={fields} allowEmpty onChange={(fieldId) => replace(index, { ...effect, fieldId })} />}
          {effect.type !== 'setField' ? <Select label="Operação" value={effect.operation} options={OPERATIONS} labels={OPERATION_LABELS} onChange={(operation) => replace(index, { ...effect, operation: operation as CustomNumericOperation })} /> : <div />}
          <Input label="Valor" value={String(effect.value ?? '')} onChange={(value) => {
            if (effect.type === 'setField') replace(index, { ...effect, value: parseLiteral(value), formula: undefined })
            else replace(index, { ...effect, value: optionalNumber(value), formula: undefined })
          }} />
          <div className="md:col-span-2"><FormulaInput label="Ou fórmula" value={effect.formula ?? ''} variables={variables} onChange={(formula) => replace(index, { ...effect, formula: formula || undefined } as CustomEffectDefinition)} /></div>
        </div>
      </article>
    })}
    {!effects.length ? <Empty>Nenhum efeito adicionado.</Empty> : null}
  </div>
}

function FormulaInput({ label, value, variables, onChange }: {
  label: string
  value: string
  variables: CustomFormulaVariable[]
  onChange: (value: string) => void
}) {
  return <div className="grid gap-2">
    <Input label={label} value={value} onChange={onChange} />
    <div><FormulaVariablePicker variables={variables} buttonLabel="Inserir variável" onSelect={(path) => onChange(`${value}${value.trim() ? ' ' : ''}${path}`)} /></div>
  </div>
}

function SystemSelect({ value, definitions, onChange }: {
  value: string
  definitions: CustomSystemDefinition[]
  onChange: (value: string) => void
}) {
  return <Select label="Sistema" value={value} options={definitions.map((entry) => entry.id)} labels={definitions.map((entry) => entry.name)} onChange={onChange} />
}

function JsonEditor({ draft, setDraft }: EditorProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setText(JSON.stringify({ abilityTypes: draft.abilityTypes, panels: draft.panels, automations: draft.automations }, null, 2)), [draft.id, draft.abilityTypes, draft.panels, draft.automations])
  function apply() {
    try {
      const parsed = JSON.parse(text) as Partial<CustomSystemDefinition>
      if (!Array.isArray(parsed.abilityTypes) || !Array.isArray(parsed.panels) || !Array.isArray(parsed.automations)) throw new Error('Tipos de habilidade, painéis e automações devem ser listas.')
      setDraft({ ...draft, abilityTypes: parsed.abilityTypes, panels: parsed.panels, automations: parsed.automations })
      setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'JSON inválido.') }
  }
  return <Section title="Importar ou editar JSON" description="Use somente para importação, exportação ou ajustes técnicos. Os outros editores são recomendados para uso normal."><TextArea label="Definição" value={text} onChange={setText} mono rows={24} />{error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}<div className="mt-3"><PrimaryButton onClick={apply}><Save className="h-4 w-4" /> Aplicar JSON</PrimaryButton></div></Section>
}

type EditorProps = { draft: CustomSystemDefinition; setDraft: (definition: CustomSystemDefinition) => void }
type Named = { id: string; name: string }
type GroupedFormulaVariable = CustomFormulaVariable & { customSystemId?: string; customSystemName?: string }

function MasterDetail({ title, description, items, selected, onSelect, onAdd, empty, children }: { title: string; description: string; items: Named[]; selected: number; onSelect: (index: number) => void; onAdd: () => void; empty: string; children: ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><aside className="rounded-lg border border-border p-3"><div className="mb-3"><h3 className="font-medium text-textH">{title}</h3><p className="mt-1 text-xs text-text">{description}</p></div><PrimaryButton onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar</PrimaryButton><div className="mt-3 grid gap-2">{items.map((item, index) => <button key={`item-${index}`} type="button" onClick={() => onSelect(index)} className={`rounded-lg border p-3 text-left ${selected === index ? 'border-accent bg-accentBg' : 'border-border hover:bg-accentBg'}`}><div className="truncate text-sm font-medium text-textH">{item.name}</div><div className="mt-1 truncate font-mono text-[11px] text-text">{item.id}</div></button>)}{!items.length ? <Empty>{empty}</Empty> : null}</div></aside><main className="min-w-0">{children}</main></div>
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) { return <section className="rounded-lg border border-border p-4"><h3 className="font-medium text-textH">{title}</h3>{description ? <p className="mt-1 text-xs text-text">{description}</p> : null}<div className="mt-4">{children}</div></section> }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base min-w-0 w-full" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function TextArea({ label, value, onChange, mono, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean; rows?: number }) { return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><textarea rows={rows} className={`input-base min-w-0 w-full resize-y ${mono ? 'font-mono text-xs' : ''}`} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, labels, onChange }: { label: string; value: string; options: readonly string[]; labels?: readonly string[]; onChange: (value: string) => void }) { return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><select className="input-base min-w-0 w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={`${option}-${index}`} value={option}>{labels?.[index] ?? option}</option>)}</select></label> }
function ReferenceSelect({ label, value, options, onChange, allowEmpty }: { label: string; value: string; options: Named[]; onChange: (value: string) => void; allowEmpty?: boolean }) { return <Select label={label} value={value} options={[...(allowEmpty ? [''] : []), ...options.map((entry) => entry.id)]} labels={[...(allowEmpty ? ['Nenhum'] : []), ...options.map((entry) => entry.name)]} onChange={onChange} /> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm text-textH">{label}</span></label> }
function Empty({ children }: { children: ReactNode }) { return <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-text">{children}</div> }
function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-3 py-2 text-sm text-accentText">{children}</button> }
function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">{children}</button> }
function DangerButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"><Trash2 className="h-4 w-4" />{children}</button> }
function IconButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) { return <button type="button" onClick={onClick} title={title} className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg">{children}</button> }

const EVENTS: CustomSystemEventType[] = ['combatStarted','combatEnded','roundStarted','roundEnded','turnStarted','turnEnded','attackHit','criticalHit','damageTaken','healingReceived','abilityUsed','shortRestCompleted','longRestCompleted','manual']
const EVENT_LABELS = ['Combate iniciado','Combate encerrado','Rodada iniciada','Rodada encerrada','Turno iniciado','Turno encerrado','Ataque acertou','Acerto crítico','Dano recebido','Cura recebida','Habilidade usada','Descanso curto concluído','Descanso longo concluído','Manual']
const OPERATORS: CustomComparisonOperator[] = ['equals','notEquals','greaterThan','greaterThanOrEqual','lessThan','lessThanOrEqual','contains','notContains','isTruthy','isFalsy']
const OPERATOR_LABELS = ['Igual a','Diferente de','Maior que','Maior ou igual','Menor que','Menor ou igual','Contém','Não contém','É verdadeiro','É falso']
const OPERATIONS: CustomNumericOperation[] = ['set','add','subtract','multiply','resetToMaximum']
const OPERATION_LABELS = ['Definir','Adicionar','Subtrair','Multiplicar','Restaurar ao máximo']

function defaultOperand(type: string, draft: CustomSystemDefinition, definitions: CustomSystemDefinition[]): CustomOperand {
  if (type === 'field') {
    const definition = firstDefinitionWithFields(definitions) ?? draft
    return { type, systemId: externalSystemId(definition.id, draft.id), fieldId: readableFields(definition)[0]?.id ?? '' }
  }
  if (type === 'resource') {
    const definition = firstDefinitionWithResources(definitions) ?? draft
    return { type, systemId: externalSystemId(definition.id, draft.id), resourceId: definition.resources[0]?.id ?? '', property: 'current' }
  }
  if (type === 'characterPath') return { type, path: 'character.level' }
  if (type === 'formula') return { type, formula: '0' }
  return { type: 'literal', value: true }
}

function automationFormulaVariables(draft: CustomSystemDefinition, definitions: CustomSystemDefinition[]): CustomFormulaVariable[] {
  const local = listCustomFormulaVariables(draft)
  const external: GroupedFormulaVariable[] = definitions
    .filter((definition) => definition.id !== draft.id)
    .flatMap((definition) => [
      ...definition.fields
        .filter(isExternalFormulaCompatibleField)
        .map((field) => ({
          path: `character.customSystem.${definition.id}.field.${field.id}`,
          label: `${definition.name} — ${field.name}`,
          valueType: fieldValueType(field),
          customSystemId: definition.id,
          customSystemName: definition.name,
        })),
      ...definition.resources.flatMap((resource) => [
        externalVariable(definition, `character.customSystem.${definition.id}.resource.${resource.id}.current`, `${resource.name} — atual`),
        externalVariable(definition, `character.customSystem.${definition.id}.resource.${resource.id}.maximum`, `${resource.name} — máximo`),
        externalVariable(definition, `character.customSystem.${definition.id}.resource.${resource.id}.temporary`, `${resource.name} — temporário`),
      ]),
    ])
  return Array.from(new Map([...local, ...external].map((entry) => [entry.path, entry])).values())
}

function externalVariable(definition: CustomSystemDefinition, path: string, label: string): GroupedFormulaVariable {
  return { path, label: `${definition.name} — ${label}`, valueType: 'number', customSystemId: definition.id, customSystemName: definition.name }
}

function isExternalFormulaCompatibleField(field: CustomFieldDefinition): boolean {
  return field.type !== 'formula' && field.type !== 'multiSelect' && field.type !== 'reference'
}

function fieldValueType(field: CustomFieldDefinition): CustomFormulaVariable['valueType'] {
  if (field.type === 'number') return 'number'
  if (field.type === 'boolean') return 'boolean'
  if (field.type === 'dice') return 'dice'
  return 'text'
}

function readableFields(definition: CustomSystemDefinition): CustomFieldDefinition[] {
  return definition.fields.filter((field) => field.type !== 'formula')
}

function writableFields(definition: CustomSystemDefinition): CustomFieldDefinition[] {
  return definition.fields.filter((field) => field.type !== 'formula')
}

function numericFields(definition: CustomSystemDefinition): CustomFieldDefinition[] {
  return definition.fields.filter((field) => field.type === 'number')
}

function firstDefinitionWithFields(definitions: CustomSystemDefinition[]): CustomSystemDefinition | undefined {
  return definitions.find((definition) => writableFields(definition).length > 0)
}

function firstDefinitionWithNumericFields(definitions: CustomSystemDefinition[]): CustomSystemDefinition | undefined {
  return definitions.find((definition) => numericFields(definition).length > 0)
}

function firstDefinitionWithResources(definitions: CustomSystemDefinition[]): CustomSystemDefinition | undefined {
  return definitions.find((definition) => definition.resources.length > 0)
}

function externalSystemId(systemId: string, ownerSystemId: string): string | undefined {
  return systemId === ownerSystemId ? undefined : systemId
}

function blockTypeLabel(type: CustomPanelBlock['type']): string { return ({ resource:'Recurso', field:'Campo', abilityList:'Lista de habilidades', text:'Texto', divider:'Divisor', formulaDisplay:'Fórmula', grid:'Grade' } as const)[type] }
function effectTypeLabel(type: CustomEffectDefinition['type']): string { return ({ modifyResource:'Modificar recurso', setField:'Definir campo', modifyField:'Modificar campo numérico' } as const)[type] }
function optionalNumber(value: string): number | undefined { if (!value.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined }
function parseLiteral(value: string): string | number | boolean { if (value === 'true') return true; if (value === 'false') return false; const numeric = Number(value); return value.trim() && Number.isFinite(numeric) ? numeric : value }
function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') }
function uniqueId(base: string, used: string[]): string { let index = 1; let candidate = base; while (used.includes(candidate)) candidate = `${base}-${index++}`; return candidate }
