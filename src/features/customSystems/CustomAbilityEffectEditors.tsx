import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { listCustomFormulaVariables, validateCustomFormula } from '../../lib/customSystems'
import type {
  CustomAbilityConditionChangeDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityTypeDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import {
  createConditionChange,
  CustomConditionEffectDialog,
} from './CustomConditionEffectDialog'
import { FormulaVariablePicker } from './FormulaVariablePicker'

export function ResourceAmountFormulaField({
  definition,
  abilityType,
  change,
  onChange,
}: {
  definition: CustomSystemDefinition
  abilityType?: CustomAbilityTypeDefinition
  change: CustomAbilityResourceChangeDefinition
  onChange: (change: CustomAbilityResourceChangeDefinition) => void
}) {
  const value = change.formula ?? (change.amount === undefined ? '' : String(change.amount))
  const formulaError = change.formula?.trim()
    ? validateCustomFormula(change.formula, definition, abilityType)
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
        <input className="input-base min-w-0 w-full font-mono" value={value} placeholder="1 ou ability.custo" onChange={(event) => setValue(event.target.value)} />
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <FormulaVariablePicker variables={listCustomFormulaVariables(definition, abilityType)} onSelect={(path) => setValue(`${value}${value.trim() ? ' ' : ''}${path}`)} />
        {change.formula?.trim() ? (
          <span className={`text-[11px] ${formulaError ? 'text-red-300' : 'text-emerald-300'}`}>{formulaError ?? 'Fórmula válida.'}</span>
        ) : (
          <span className="text-[11px] text-textMuted">Aceita número fixo ou expressão.</span>
        )}
      </div>
    </div>
  )
}

export function AbilityConditionChangesEditor({ value, onChange, emptyLabel = 'Nenhuma condição alterada.' }: {
  value: CustomAbilityConditionChangeDefinition[]
  onChange: (value: CustomAbilityConditionChangeDefinition[]) => void
  emptyLabel?: string
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [creating, setCreating] = useState<CustomAbilityConditionChangeDefinition | null>(null)

  function saveCreating(change: CustomAbilityConditionChangeDefinition) {
    onChange([...value, change])
    setCreating(null)
  }

  function saveEditing(change: CustomAbilityConditionChangeDefinition) {
    if (editingIndex === null) return
    onChange(value.map((entry, index) => index === editingIndex ? change : entry))
    setEditingIndex(null)
  }

  return (
    <div className="grid gap-3">
      {value.map((change, index) => (
        <article key={change.id} className="rounded-lg border border-border bg-bg p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-textH">{change.name || 'Condição sem nome'}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-textMuted">{change.operation === 'add' ? 'Aplicar / renovar' : 'Remover'}</span>
              </div>
              {change.operation === 'add' ? (
                <div className="mt-1 text-xs text-textMuted">{formatDuration(change)}{change.source?.trim() ? ` · Fonte: ${change.source.trim()}` : ''}</div>
              ) : (
                <div className="mt-1 text-xs text-textMuted">Remove a condição pelo nome.</div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <select className="input-base min-w-[9rem] text-xs" value={change.operation} onChange={(event) => onChange(value.map((entry, current) => current === index ? { ...entry, operation: event.target.value as 'add' | 'remove' } : entry))}>
                <option value="add">Aplicar / renovar</option>
                <option value="remove">Remover</option>
              </select>
              {change.operation === 'add' ? (
                <button type="button" onClick={() => setEditingIndex(index)} className="rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg">Editar condição</button>
              ) : (
                <input className="input-base min-w-[12rem] text-xs" value={change.name} placeholder="Nome da condição" onChange={(event) => onChange(value.map((entry, current) => current === index ? { ...entry, name: event.target.value } : entry))} />
              )}
              <button type="button" title="Remover alteração" onClick={() => onChange(value.filter((_, current) => current !== index))} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </article>
      ))}
      {!value.length ? <Empty>{emptyLabel}</Empty> : null}
      <button type="button" onClick={() => setCreating(createConditionChange())} className="justify-self-start inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"><Plus className="h-3.5 w-3.5" /> Adicionar condição</button>
      <CustomConditionEffectDialog open={creating !== null} change={creating} isNew onClose={() => setCreating(null)} onSave={saveCreating} />
      <CustomConditionEffectDialog open={editingIndex !== null} change={editingIndex === null ? null : value[editingIndex] ?? null} onClose={() => setEditingIndex(null)} onSave={saveEditing} />
    </div>
  )
}

function formatDuration(change: CustomAbilityConditionChangeDefinition): string {
  const duration = change.duration
  if (!duration) return 'Duração não definida'
  const numeric = ['rounds', 'turns', 'minutes', 'hours', 'days'].includes(duration.type)
  if (numeric) {
    const amount = duration.total ?? duration.amount ?? 1
    const units: Record<string, string> = {
      rounds: amount === 1 ? 'rodada' : 'rodadas', turns: amount === 1 ? 'turno' : 'turnos', minutes: amount === 1 ? 'minuto' : 'minutos', hours: amount === 1 ? 'hora' : 'horas', days: amount === 1 ? 'dia' : 'dias',
    }
    return `${amount} ${units[duration.type]}`
  }
  const labels: Record<string, string> = {
    'until-start-of-turn': 'Até o início do turno', 'until-end-of-turn': 'Até o fim do turno', 'until-save': 'Até passar em um teste', concentration: 'Enquanto houver concentração', permanent: 'Permanente', custom: duration.customLabel?.trim() || 'Duração personalizada',
  }
  return labels[duration.type] ?? duration.type
}

function isPlainNumber(value: string): boolean {
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value))
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">{children}</div>
}
