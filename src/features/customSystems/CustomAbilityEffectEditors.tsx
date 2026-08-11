import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type { ConditionDurationType } from '../../models/characters/CharacterCondition'
import type {
  CustomAbilityConditionChangeDefinition,
  CustomAbilityResourceChangeDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import { FormulaVariablePicker } from './FormulaVariablePicker'

const DURATIONS: Array<[ConditionDurationType, string]> = [
  ['permanent', 'Permanente'],
  ['rounds', 'Rodadas'],
  ['turns', 'Turnos'],
  ['minutes', 'Minutos'],
  ['hours', 'Horas'],
  ['days', 'Dias'],
  ['until-start-of-turn', 'Até o início do turno'],
  ['until-end-of-turn', 'Até o fim do turno'],
  ['until-save', 'Até passar em um teste'],
  ['concentration', 'Concentração'],
  ['custom', 'Personalizada'],
]

export function ResourceAmountFormulaField({
  definition,
  change,
  onChange,
}: {
  definition: CustomSystemDefinition
  change: CustomAbilityResourceChangeDefinition
  onChange: (change: CustomAbilityResourceChangeDefinition) => void
}) {
  const value = change.formula ?? (change.amount === undefined ? '' : String(change.amount))
  const formulaError = change.formula?.trim()
    ? validateCustomFormula(change.formula, definition)
    : undefined

  function setValue(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onChange({ ...change, amount: undefined, formula: undefined })
      return
    }

    if (isPlainNumber(trimmed)) {
      onChange({ ...change, amount: Math.max(0, Number(trimmed)), formula: undefined })
      return
    }

    onChange({ ...change, amount: undefined, formula: raw })
  }

  return (
    <div className="min-w-[12rem] flex-[1_1_14rem]">
      <label className="grid min-w-0 gap-1">
        <span className="label">Quantidade / fórmula</span>
        <input
          className="input-base min-w-0 w-full font-mono"
          value={value}
          placeholder="1 ou character.proficiencyBonus"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <FormulaVariablePicker
          variables={listCustomFormulaVariables(definition)}
          onSelect={(path) => setValue(`${value}${value.trim() ? ' ' : ''}${path}`)}
        />
        {change.formula?.trim() ? (
          <span className={`text-[11px] ${formulaError ? 'text-red-300' : 'text-emerald-300'}`}>
            {formulaError ?? 'Fórmula válida.'}
          </span>
        ) : (
          <span className="text-[11px] text-textMuted">Aceita número fixo ou expressão.</span>
        )}
      </div>
    </div>
  )
}

export function AbilityConditionChangesEditor({
  value,
  onChange,
  emptyLabel = 'Nenhuma condição alterada.',
}: {
  value: CustomAbilityConditionChangeDefinition[]
  onChange: (value: CustomAbilityConditionChangeDefinition[]) => void
  emptyLabel?: string
}) {
  return (
    <div className="grid gap-3">
      {value.map((change, index) => (
        <ConditionRow
          key={change.id}
          value={change}
          onChange={(next) => onChange(value.map((entry, current) => current === index ? next : entry))}
          onRemove={() => onChange(value.filter((_, current) => current !== index))}
        />
      ))}
      {!value.length ? <Empty>{emptyLabel}</Empty> : null}
      <button
        type="button"
        onClick={() => onChange([...value, newAbilityConditionChange()])}
        className="justify-self-start inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar condição
      </button>
    </div>
  )
}

function ConditionRow({ value, onChange, onRemove }: {
  value: CustomAbilityConditionChangeDefinition
  onChange: (value: CustomAbilityConditionChangeDefinition) => void
  onRemove: () => void
}) {
  const duration = value.duration ?? { type: 'permanent' as const }
  const numeric = isNumericDuration(duration.type)

  return (
    <article className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Cell>
          <SelectField
            label="Operação"
            value={value.operation}
            options={[["add", "Aplicar / renovar"], ["remove", "Remover"]]}
            onChange={(operation) => onChange({ ...value, operation: operation as 'add' | 'remove' })}
          />
        </Cell>
        <Cell>
          <TextField label="Condição / estado" value={value.name} onChange={(name) => onChange({ ...value, name })} />
        </Cell>
        {value.operation === 'add' ? <>
          <Cell>
            <SelectField
              label="Duração"
              value={duration.type}
              options={DURATIONS}
              onChange={(type) => onChange({ ...value, duration: { ...duration, type: type as ConditionDurationType } })}
            />
          </Cell>
          {numeric ? (
            <div className="min-w-[8rem] flex-[0.6_1_8rem]">
              <TextField
                label="Quantidade"
                type="number"
                value={String(duration.amount ?? 1)}
                onChange={(amount) => onChange({ ...value, duration: { ...duration, amount: Math.max(0, Number(amount) || 0) } })}
              />
            </div>
          ) : duration.type === 'custom' ? (
            <Cell>
              <TextField
                label="Duração personalizada"
                value={duration.customLabel ?? ''}
                onChange={(customLabel) => onChange({ ...value, duration: { ...duration, customLabel: customLabel || undefined } })}
              />
            </Cell>
          ) : null}
        </> : null}
        <button
          type="button"
          title="Remover alteração"
          onClick={onRemove}
          className="shrink-0 rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {value.operation === 'add' ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <TextField
            label="Descrição opcional"
            value={value.description ?? ''}
            onChange={(description) => onChange({ ...value, description: description || undefined })}
          />
          <TextField
            label="Comportamento / observação opcional"
            value={value.behavior ?? ''}
            onChange={(behavior) => onChange({ ...value, behavior: behavior || undefined })}
          />
        </div>
      ) : null}
    </article>
  )
}

export function newAbilityConditionChange(): CustomAbilityConditionChangeDefinition {
  return {
    id: crypto.randomUUID(),
    operation: 'add',
    name: 'Novo estado',
    duration: { type: 'permanent' },
  }
}

function isPlainNumber(value: string): boolean {
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value))
}

function isNumericDuration(type: ConditionDurationType): boolean {
  return ['rounds', 'turns', 'minutes', 'hours', 'days'].includes(type)
}

function Cell({ children }: { children: ReactNode }) {
  return <div className="min-w-[11rem] flex-[1_1_11rem]">{children}</div>
}

function TextField({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><input className="input-base min-w-0 w-full" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  onChange: (value: string) => void
}) {
  return <label className="grid min-w-0 gap-1"><span className="label">{label}</span><select className="input-base min-w-0 w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">{children}</div>
}
