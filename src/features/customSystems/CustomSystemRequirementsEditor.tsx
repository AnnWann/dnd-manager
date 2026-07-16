import { Plus, Trash2 } from 'lucide-react'
import type { Attribute } from '../../models/sheet/Attribute'
import type { ClassName } from '../../models/sheet/Class'
import type { ProficiencyCategory } from '../../models/sheet/Proficiency'
import type {
  CustomSystemDefinition,
  CustomSystemInstallationRequirement,
} from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'
import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'

const CLASSES: ClassName[] = ['artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard']
const ATTRIBUTES: Attribute[] = ['str','dex','con','int','wis','cha']
const PROFICIENCY_CATEGORIES: ProficiencyCategory[] = ['armor','shield','weapon','tool','vehicle','mount','language','instrument','game','skill','saving-throw','other']

type Props = {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}

export function CustomSystemRequirementsEditor({ draft, setDraft }: Props) {
  const config = draft.automaticInstallation ?? { enabled: false, match: 'all' as const, requirements: [] }

  function update(patch: Partial<typeof config>) {
    setDraft({ ...draft, automaticInstallation: { ...config, ...patch } })
  }

  function add(type: CustomSystemInstallationRequirement['type']) {
    const id = crypto.randomUUID()
    const requirement: CustomSystemInstallationRequirement = type === 'class'
      ? { id, type, className: 'fighter', minimumLevel: 1 }
      : type === 'totalLevel'
        ? { id, type, minimumLevel: 1 }
        : type === 'proficiency'
          ? { id, type, category: 'skill', name: '' }
          : type === 'ability'
            ? { id, type, source: 'any', name: '' }
            : type === 'attribute'
              ? { id, type, attribute: 'str', minimumValue: 10 }
              : { id, type, formula: '' }
    update({ requirements: [...config.requirements, requirement] })
  }

  function replace(index: number, requirement: CustomSystemInstallationRequirement) {
    update({ requirements: config.requirements.map((entry, current) => current === index ? requirement : entry) })
  }

  function remove(index: number) {
    update({ requirements: config.requirements.filter((_, current) => current !== index) })
  }

  return <div className="grid gap-4">
    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-textH">Instalação automática</h3>
          <p className="mt-1 text-sm text-text">O sistema será adicionado à ficha quando o personagem cumprir os requisitos abaixo.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-textH">
          <input type="checkbox" checked={config.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          Ativar instalação automática
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="label">Como combinar os requisitos</span>
          <select className="input-base" value={config.match} onChange={(event) => update({ match: event.target.value as 'all' | 'any' })}>
            <option value="all">Cumprir todos os requisitos</option>
            <option value="any">Cumprir pelo menos um requisito</option>
          </select>
        </label>
        <div className="rounded-lg border border-border px-3 py-2 text-sm text-text">
          {config.enabled
            ? config.requirements.length
              ? `${config.match === 'all' ? 'Todos' : 'Ao menos um'} dos ${config.requirements.length} requisito(s) será avaliado.`
              : 'Adicione ao menos um requisito para ativar a instalação automática.'
            : 'A instalação automática está desativada.'}
        </div>
      </div>
    </section>

    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold text-textH">Requisitos</h3><p className="mt-1 text-sm text-text">As regras são avaliadas sempre que a ficha é aberta ou alterada.</p></div>
        <div className="flex flex-wrap gap-2">
          <AddButton onClick={() => add('class')}>Classe</AddButton>
          <AddButton onClick={() => add('totalLevel')}>Nível total</AddButton>
          <AddButton onClick={() => add('proficiency')}>Proficiência</AddButton>
          <AddButton onClick={() => add('ability')}>Habilidade</AddButton>
          <AddButton onClick={() => add('attribute')}>Atributo</AddButton>
          <AddButton onClick={() => add('formula')}>Fórmula</AddButton>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {config.requirements.map((requirement, index) => <RequirementRow
          key={requirement.id}
          requirement={requirement}
          definition={draft}
          onChange={(next) => replace(index, next)}
          onRemove={() => remove(index)}
        />)}
        {!config.requirements.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">Nenhum requisito configurado.</div> : null}
      </div>
    </section>
  </div>
}

function RequirementRow({ requirement, definition, onChange, onRemove }: {
  requirement: CustomSystemInstallationRequirement
  definition: CustomSystemDefinition
  onChange: (requirement: CustomSystemInstallationRequirement) => void
  onRemove: () => void
}) {
  return <article className="rounded-lg border border-border p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <strong className="text-sm text-textH">{typeLabel(requirement.type)}</strong>
      <button type="button" onClick={onRemove} title="Remover requisito" className="rounded-lg p-2 text-text hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
    </div>

    {requirement.type === 'class' ? <div className="grid gap-3 md:grid-cols-3">
      <Select label="Classe" value={requirement.className} options={CLASSES} labels={CLASSES.map(classLabel)} onChange={(value) => onChange({ ...requirement, className: value as ClassName })} />
      <Input label="Nível mínimo" type="number" value={String(requirement.minimumLevel ?? 1)} onChange={(value) => onChange({ ...requirement, minimumLevel: clampLevel(value) })} />
      <Input label="Subclasse opcional" value={requirement.subclassName ?? ''} onChange={(value) => onChange({ ...requirement, subclassName: value || undefined })} />
    </div> : null}

    {requirement.type === 'totalLevel' ? <Input label="Nível total mínimo" type="number" value={String(requirement.minimumLevel)} onChange={(value) => onChange({ ...requirement, minimumLevel: clampLevel(value) })} /> : null}

    {requirement.type === 'proficiency' ? <div className="grid gap-3 md:grid-cols-3">
      <Select label="Categoria" value={requirement.category ?? ''} options={['', ...PROFICIENCY_CATEGORIES]} labels={['Qualquer categoria', ...PROFICIENCY_CATEGORIES.map(proficiencyLabel)]} onChange={(value) => onChange({ ...requirement, category: (value || undefined) as ProficiencyCategory | undefined })} />
      <Input label="Nome da proficiência" value={requirement.name ?? ''} onChange={(value) => onChange({ ...requirement, name: value || undefined })} />
      <Input label="ID opcional" value={requirement.proficiencyId ?? ''} onChange={(value) => onChange({ ...requirement, proficiencyId: value || undefined })} />
    </div> : null}

    {requirement.type === 'ability' ? <div className="grid gap-3 md:grid-cols-3">
      <Select label="Origem" value={requirement.source ?? 'any'} options={['any','character','custom']} labels={['Qualquer habilidade','Habilidades padrão','Sistemas personalizados']} onChange={(value) => onChange({ ...requirement, source: value as 'any' | 'character' | 'custom' })} />
      <Input label="Nome da habilidade" value={requirement.name ?? ''} onChange={(value) => onChange({ ...requirement, name: value || undefined })} />
      <Input label="ID opcional" value={requirement.abilityId ?? ''} onChange={(value) => onChange({ ...requirement, abilityId: value || undefined })} />
    </div> : null}

    {requirement.type === 'attribute' ? <div className="grid gap-3 md:grid-cols-3">
      <Select label="Atributo" value={requirement.attribute} options={ATTRIBUTES} labels={ATTRIBUTES.map(attributeLabel)} onChange={(value) => onChange({ ...requirement, attribute: value as Attribute })} />
      <Input label="Valor mínimo" type="number" value={String(requirement.minimumValue)} onChange={(value) => onChange({ ...requirement, minimumValue: Number(value) || 0 })} />
      <label className="flex items-end gap-2 pb-2 text-sm text-textH"><input type="checkbox" checked={Boolean(requirement.useModifier)} onChange={(event) => onChange({ ...requirement, useModifier: event.target.checked })} /> Usar modificador em vez do valor</label>
    </div> : null}

    {requirement.type === 'formula' ? <FormulaRequirement requirement={requirement} definition={definition} onChange={onChange} /> : null}
  </article>
}

function FormulaRequirement({ requirement, definition, onChange }: {
  requirement: Extract<CustomSystemInstallationRequirement, { type: 'formula' }>
  definition: CustomSystemDefinition
  onChange: (requirement: CustomSystemInstallationRequirement) => void
}) {
  const error = requirement.formula.trim() ? validateCustomFormula(requirement.formula, definition) : 'Informe uma fórmula.'
  return <div>
    <Input label="Fórmula booleana" value={requirement.formula} onChange={(formula) => onChange({ ...requirement, formula })} />
    <div className="mt-2"><FormulaVariablePicker variables={listCustomFormulaVariables(definition)} onSelect={(path) => onChange({ ...requirement, formula: `${requirement.formula}${requirement.formula.trim() ? ' ' : ''}${path}` })} /></div>
    <p className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? 'Fórmula válida.'}</p>
  </div>
}

function AddButton({ children, onClick }: { children: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"><Plus className="h-3.5 w-3.5" /> {children}</button> }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1"><span className="label">{label}</span><input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function Select({ label, value, options, labels, onChange }: { label: string; value: string; options: readonly string[]; labels: string[]; onChange: (value: string) => void }) { return <label className="grid gap-1"><span className="label">{label}</span><select className="input-base" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={option || 'empty'} value={option}>{labels[index] ?? option}</option>)}</select></label> }
function clampLevel(value: string): number { return Math.max(1, Math.min(20, Math.trunc(Number(value) || 1))) }
function typeLabel(type: CustomSystemInstallationRequirement['type']): string { return ({ class: 'Classe', totalLevel: 'Nível total', proficiency: 'Proficiência', ability: 'Habilidade', attribute: 'Atributo', formula: 'Fórmula' })[type] }
function classLabel(value: string): string { return ({ artificer:'Artífice',barbarian:'Bárbaro',bard:'Bardo',cleric:'Clérigo',druid:'Druida',fighter:'Guerreiro',monk:'Monge',paladin:'Paladino',ranger:'Patrulheiro',rogue:'Ladino',sorcerer:'Feiticeiro',warlock:'Bruxo',wizard:'Mago' } as Record<string,string>)[value] ?? value }
function attributeLabel(value: string): string { return ({ str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma' } as Record<string,string>)[value] ?? value }
function proficiencyLabel(value: string): string { return ({ armor:'Armadura',shield:'Escudo',weapon:'Arma',tool:'Ferramenta',vehicle:'Veículo',mount:'Montaria',language:'Idioma',instrument:'Instrumento',game:'Jogo',skill:'Perícia', 'saving-throw':'Teste de resistência',other:'Outra' } as Record<string,string>)[value] ?? value }
