import { useEffect, useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import type {
  CharacterCondition,
  ConditionDurationType,
} from '../../models/characters/CharacterCondition'
import type { CustomAbilityConditionChangeDefinition } from '../../models/customSystems/CustomAbilityDefinition'
import { BonusesFields } from '../characters/inventory/equipmentBonusFields'
import {
  STANDARD_CONDITION_PRESETS,
  type StandardConditionPreset,
} from '../characters/characterSheet/standardConditionPresets'

const NUMERIC_DURATION_TYPES = new Set<ConditionDurationType>([
  'rounds',
  'turns',
  'minutes',
  'hours',
  'days',
])

const DURATION_OPTIONS: Array<{ value: ConditionDurationType; label: string }> = [
  { value: 'rounds', label: 'Rodadas' },
  { value: 'turns', label: 'Turnos' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
  { value: 'until-start-of-turn', label: 'Até o início do turno' },
  { value: 'until-end-of-turn', label: 'Até o fim do turno' },
  { value: 'until-save', label: 'Até passar em um teste' },
  { value: 'concentration', label: 'Enquanto houver concentração' },
  { value: 'permanent', label: 'Permanente' },
  { value: 'custom', label: 'Duração personalizada' },
]

export function CustomConditionEffectDialog({
  open,
  change,
  isNew,
  onClose,
  onSave,
}: {
  open: boolean
  change: CustomAbilityConditionChangeDefinition | null
  isNew?: boolean
  onClose: () => void
  onSave: (change: CustomAbilityConditionChangeDefinition) => void
}) {
  const [draft, setDraft] = useState<CharacterCondition>(() =>
    conditionFromChange(change ?? createConditionChange()),
  )

  useEffect(() => {
    if (!open) return
    setDraft(conditionFromChange(change ?? createConditionChange()))
  }, [change, open])

  if (!open) return null

  const numeric = NUMERIC_DURATION_TYPES.has(draft.duration.type)

  function patch(patchValue: Partial<CharacterCondition>) {
    setDraft((current) => ({ ...current, ...patchValue }))
  }

  function patchDuration(patchValue: Partial<CharacterCondition['duration']>) {
    setDraft((current) => ({
      ...current,
      duration: { ...current.duration, ...patchValue },
    }))
  }

  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center overflow-y-auto bg-black/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-auto grid max-h-[calc(100dvh-1rem)] w-full max-w-3xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">
              {isNew ? 'Adicionar condição' : 'Editar condição'}
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Preencha apenas o efeito principal e a duração. Os demais controles ficam em opções avançadas.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {isNew ? (
            <section className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg p-3 sm:col-span-2">
              <div>
                <div className="text-xs font-semibold text-textH">Condição padrão</div>
                <p className="mt-1 text-[11px] leading-5 text-textMuted">
                  Selecione uma condição comum para preencher automaticamente os campos principais.
                </p>
              </div>
              <Select
                value=""
                aria-label="Selecionar condição padrão"
                onChange={(event) => {
                  const preset = STANDARD_CONDITION_PRESETS.find((entry) => entry.id === event.target.value)
                  if (preset) setDraft((current) => applyStandardConditionPreset(current, preset))
                }}
              >
                <option value="">Escolha uma condição...</option>
                {STANDARD_CONDITION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </Select>
            </section>
          ) : null}

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Nome</span>
            <Input
              value={draft.name}
              placeholder="Ex.: Amedrontado"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Efeito principal</span>
            <Textarea
              rows={3}
              value={draft.behavior}
              placeholder="Ex.: desvantagem em ataques enquanto enxergar a fonte; não pode se aproximar voluntariamente."
              onChange={(event) => patch({ behavior: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-text">Duração</span>
            <Select
              value={draft.duration.type}
              onChange={(event) => {
                const type = event.target.value as ConditionDurationType
                const becomesNumeric = NUMERIC_DURATION_TYPES.has(type)
                patchDuration({
                  type,
                  total: becomesNumeric ? draft.duration.total ?? 1 : undefined,
                  remaining: becomesNumeric
                    ? draft.duration.total ?? draft.duration.remaining ?? 1
                    : undefined,
                  customLabel: type === 'custom' ? draft.duration.customLabel ?? '' : undefined,
                })
              }}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>

          {numeric ? (
            <label className="grid gap-1.5">
              <span className="text-xs text-text">Quantidade</span>
              <Input
                type="number"
                min={0}
                value={draft.duration.total ?? 1}
                onChange={(event) => {
                  const total = Math.max(0, Number(event.target.value) || 0)
                  patchDuration({ total, remaining: total })
                }}
              />
            </label>
          ) : null}

          {draft.duration.type === 'custom' ? (
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-text">Texto da duração</span>
              <Input
                value={draft.duration.customLabel ?? ''}
                placeholder="Ex.: até abandonar o templo"
                onChange={(event) => patchDuration({ customLabel: event.target.value })}
              />
            </label>
          ) : null}

          <details className="rounded-lg border border-border bg-bg-subtle p-3 sm:col-span-2">
            <summary className="cursor-pointer text-xs font-medium text-textH">Opções avançadas</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs text-text">Fonte</span>
                <Input
                  value={draft.source}
                  placeholder="Ex.: magia Medo, veneno, criatura"
                  onChange={(event) => patch({ source: event.target.value })}
                />
              </label>

              {numeric ? (
                <label className="grid gap-1.5">
                  <span className="text-xs text-text">Tempo restante</span>
                  <Input
                    type="number"
                    min={0}
                    value={draft.duration.remaining ?? draft.duration.total ?? 1}
                    onChange={(event) => patchDuration({ remaining: Math.max(0, Number(event.target.value) || 0) })}
                  />
                </label>
              ) : null}

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-text">Descrição</span>
                <Textarea
                  rows={2}
                  value={draft.description}
                  placeholder="Descrição narrativa ou contexto da condição."
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs text-text">Quando reduzir</span>
                <Select
                  value={draft.duration.tickOn ?? 'end-of-turn'}
                  onChange={(event) => patchDuration({ tickOn: event.target.value as CharacterCondition['duration']['tickOn'] })}
                >
                  <option value="start-of-turn">Início do turno</option>
                  <option value="end-of-turn">Fim do turno</option>
                  <option value="manual">Somente manualmente</option>
                </Select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs text-text">Turno de referência</span>
                <Select
                  value={draft.duration.tickOwner ?? 'affected'}
                  onChange={(event) => patchDuration({ tickOwner: event.target.value as CharacterCondition['duration']['tickOwner'] })}
                >
                  <option value="affected">Personagem afetado</option>
                  <option value="source">Fonte da condição</option>
                </Select>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-bg p-3 text-xs text-text sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.duration.autoRemoveAtZero !== false}
                  onChange={(event) => patchDuration({ autoRemoveAtZero: event.target.checked })}
                />
                <span>
                  <span className="font-medium text-textH">Remover automaticamente ao chegar a zero</span>
                  <span className="mt-0.5 block text-textMuted">Usado pelo controlador de turnos da iniciativa.</span>
                </span>
              </label>

              <div className="sm:col-span-2">
                <BonusesFields
                  bonuses={draft.bonuses ?? {}}
                  description="Modificadores aplicados enquanto esta condição estiver ativa e não expirada."
                  onChange={(bonuses) => patch({ bonuses })}
                />
              </div>

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-text">Etiquetas</span>
                <Input
                  value={draft.tags.join(', ')}
                  placeholder="Ex.: mental, medo, magia, debilitante"
                  onChange={(event) => patch({
                    tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                  })}
                />
              </label>

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-text">Notas</span>
                <Textarea rows={2} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs text-text">ID da fonte</span>
                <Input
                  value={draft.sourceCharacterId ?? ''}
                  placeholder="Opcional"
                  onChange={(event) => patch({ sourceCharacterId: event.target.value || undefined })}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs text-text">ID do combatente vinculado</span>
                <Input
                  value={draft.linkedCombatantId ?? ''}
                  placeholder="Preenchido futuramente"
                  onChange={(event) => patch({ linkedCombatantId: event.target.value || undefined })}
                />
              </label>
            </div>
          </details>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.name.trim()}
            onClick={() => onSave(changeFromCondition(change ?? createConditionChange(), draft))}
          >
            Salvar condição
          </Button>
        </div>
      </div>
    </div>
  )
}

export function createConditionChange(): CustomAbilityConditionChangeDefinition {
  return {
    id: crypto.randomUUID(),
    operation: 'add',
    name: '',
    description: '',
    behavior: '',
    source: '',
    notes: '',
    tags: [],
    bonuses: {},
    duration: {
      type: 'rounds',
      total: 1,
      remaining: 1,
      tickOn: 'end-of-turn',
      tickOwner: 'affected',
      autoRemoveAtZero: true,
    },
  }
}

function conditionFromChange(change: CustomAbilityConditionChangeDefinition): CharacterCondition {
  const legacyAmount = change.duration?.amount
  const total = change.duration?.total ?? legacyAmount
  return {
    id: change.id,
    name: change.name,
    description: change.description ?? '',
    behavior: change.behavior ?? '',
    source: change.source ?? '',
    notes: change.notes ?? '',
    tags: change.tags ?? [],
    bonuses: change.bonuses ?? {},
    duration: {
      type: change.duration?.type ?? 'rounds',
      total,
      remaining: change.duration?.remaining ?? total,
      tickOn: change.duration?.tickOn ?? 'end-of-turn',
      tickOwner: change.duration?.tickOwner ?? 'affected',
      autoRemoveAtZero: change.duration?.autoRemoveAtZero ?? true,
      customLabel: change.duration?.customLabel,
      expiresAt: change.duration?.expiresAt,
    },
    createdAt: new Date().toISOString(),
    sourceCharacterId: change.sourceCharacterId,
    linkedCombatantId: change.linkedCombatantId,
  }
}

function changeFromCondition(
  current: CustomAbilityConditionChangeDefinition,
  condition: CharacterCondition,
): CustomAbilityConditionChangeDefinition {
  return {
    ...current,
    name: condition.name,
    description: condition.description,
    behavior: condition.behavior,
    source: condition.source,
    notes: condition.notes,
    tags: condition.tags,
    bonuses: condition.bonuses,
    duration: { ...condition.duration },
    sourceCharacterId: condition.sourceCharacterId,
    linkedCombatantId: condition.linkedCombatantId,
  }
}

function applyStandardConditionPreset(
  current: CharacterCondition,
  preset: StandardConditionPreset,
): CharacterCondition {
  return {
    ...current,
    name: preset.name,
    description: preset.description,
    behavior: preset.behavior,
    tags: [...preset.tags],
    bonuses: {},
    duration: {
      type: 'custom',
      customLabel: 'Até a condição ser encerrada',
      tickOn: 'manual',
      tickOwner: 'affected',
      autoRemoveAtZero: false,
    },
  }
}
