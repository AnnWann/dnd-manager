import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { cn } from '../../lib/cn'
import type { AbilityUsageCooldownUnit, AbilityUsageResetKind, Character, CustomAbility } from '../../types'

const USAGE_OPTIONS: Array<{ value: AbilityUsageResetKind; label: string }> = [
  { value: 'turn', label: 'Por turno' },
  { value: 'cooldown', label: 'Cooldown' },
  { value: 'shortRest', label: 'Por descanso curto' },
  { value: 'longRest', label: 'Por descanso longo' },
]

const COOLDOWN_UNIT_OPTIONS: Array<{ value: AbilityUsageCooldownUnit; label: string }> = [
  { value: 'turns', label: 'Turnos' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
  { value: 'tenDays', label: '10 dias' },
]

type AbilityDraft = {
  id: string
  name: string
  description: string
  usageEnabled: boolean
  usageReset: AbilityUsageResetKind
  usageMax: string
  usageUsed: string
  cooldownAmount: string
  cooldownUnit: AbilityUsageCooldownUnit
}

const EMPTY_DRAFT: AbilityDraft = {
  id: '',
  name: '',
  description: '',
  usageEnabled: false,
  usageReset: 'longRest',
  usageMax: '1',
  usageUsed: '0',
  cooldownAmount: '1',
  cooldownUnit: 'turns',
}

// Preview truncation handled via CSS multi-line clamp to avoid layout overflow

type Props = {
  character: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function CharacterAbilities({ character, updateCharacter }: Props) {
  const abilities = character.customAbilities ?? []
  const [editingAbilityId, setEditingAbilityId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AbilityDraft>(EMPTY_DRAFT)

  function openCreateAbility() {
    setDraft(EMPTY_DRAFT)
    setEditingAbilityId('__new__')
  }

  function openEditAbility(ability: CustomAbility) {
    setEditingAbilityId(ability.id)
    setDraft({
      id: ability.id,
      name: ability.name,
      description: ability.description ?? '',
      usageEnabled: Boolean(ability.usage),
      usageReset: ability.usage?.reset ?? 'longRest',
      usageMax: String(ability.usage?.max ?? 1),
      usageUsed: String(ability.usage?.used ?? 0),
      cooldownAmount: String(ability.usage?.cooldownAmount ?? 1),
      cooldownUnit: ability.usage?.cooldownUnit ?? 'turns',
    })
  }

  function closeModal() {
    setEditingAbilityId(null)
    setDraft(EMPTY_DRAFT)
  }

  function saveDraft() {
    const name = draft.name.trim().slice(0, 20)
    const description = draft.description.trim()
    if (!name) return

    const usage = draft.usageEnabled
      ? {
          max: Math.max(1, Number(draft.usageMax) || 1),
          used: Math.max(0, Math.min(Math.max(1, Number(draft.usageMax) || 1), Number(draft.usageUsed) || 0)),
          reset: draft.usageReset,
          cooldownAmount: draft.usageReset === 'cooldown' ? Math.max(1, Number(draft.cooldownAmount) || 1) : undefined,
          cooldownUnit: draft.usageReset === 'cooldown' ? draft.cooldownUnit : undefined,
        }
      : undefined

    if (editingAbilityId === '__new__') {
      updateCharacter(character.id, (c) => ({
        ...c,
        customAbilities: [...(c.customAbilities ?? []), { id: crypto.randomUUID(), name, description: description || undefined, usage }],
      }))
    } else if (editingAbilityId) {
      updateCharacter(character.id, (c) => ({
        ...c,
        customAbilities: (c.customAbilities ?? []).map((ability) =>
          ability.id === editingAbilityId ? { ...ability, name, description: description || undefined, usage } : ability,
        ),
      }))
    }

    closeModal()
  }

  const modalNode =
    editingAbilityId && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={closeModal}
            role="presentation"
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-border bg-bg shadow-theme"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={editingAbilityId === '__new__' ? 'Adicionar habilidade' : 'Editar habilidade'}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <div className="text-sm font-semibold text-textH">
                    {editingAbilityId === '__new__' ? 'Adicionar habilidade' : 'Editar habilidade'}
                  </div>
                  <div className="mt-1 text-xs text-text">
                    Organize nome, usos e cooldown em um formulário separado do card.
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={closeModal}>
                  Fechar
                </Button>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="text-xs font-semibold text-textH">Nome</div>
                  <Input
                    className="mt-2"
                    maxLength={20}
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Sentidos Aguçados"
                  />
                  <div className="mt-1 text-[11px] text-text">Máximo de 20 caracteres.</div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold text-textH">Descrição</div>
                    <Textarea
                      className="mt-2 min-h-32 resize-y"
                      value={draft.description}
                      onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Explique o que a habilidade faz, quando ela é usada e quaisquer detalhes importantes."
                    />
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-textH">Contador de uso</div>
                        <div className="mt-1 text-xs text-text">Ative para controlar usos e reinício.</div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-text">
                        <input
                          type="checkbox"
                          checked={draft.usageEnabled}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              usageEnabled: e.target.checked,
                            }))
                          }
                        />
                        Habilitar
                      </label>
                    </div>

                    {draft.usageEnabled ? (
                      <>
                        <div>
                          <div className="text-xs font-semibold text-textH">Reset</div>
                          <Select
                            className="mt-2 h-9"
                            value={draft.usageReset}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                usageReset: e.target.value as AbilityUsageResetKind,
                              }))
                            }
                          >
                            {USAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>

                        {draft.usageReset === 'cooldown' ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-textH">Quantidade</div>
                              <Input
                                className="mt-2 h-9"
                                type="number"
                                min={1}
                                value={draft.cooldownAmount}
                                onChange={(e) => setDraft((prev) => ({ ...prev, cooldownAmount: e.target.value }))}
                              />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-textH">Unidade</div>
                              <Select
                                className="mt-2 h-9"
                                value={draft.cooldownUnit}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    cooldownUnit: e.target.value as AbilityUsageCooldownUnit,
                                  }))
                                }
                              >
                                {COOLDOWN_UNIT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold text-textH">Usos máximos</div>
                            <Input
                              className="mt-2 h-9"
                              type="number"
                              min={1}
                              value={draft.usageMax}
                              onChange={(e) => setDraft((prev) => ({ ...prev, usageMax: e.target.value }))}
                            />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-textH">Usos já gastos</div>
                            <Input
                              className="mt-2 h-9"
                              type="number"
                              min={0}
                              value={draft.usageUsed}
                              onChange={(e) => setDraft((prev) => ({ ...prev, usageUsed: e.target.value }))}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] p-4">
                  <div className="text-xs font-semibold text-textH">Prévia</div>
                  <div className="mt-3 rounded-xl border border-border bg-bg p-3">
                    <div className="text-sm font-semibold text-textH">{draft.name.trim() || 'Nova habilidade'}</div>
                    {draft.description.trim() ? (
                      <div className="mt-2 text-xs leading-5 text-text">
                        <div
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'normal',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {draft.description.trim()}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-text">
                      {draft.usageEnabled
                        ? draft.usageReset === 'cooldown'
                          ? `Cooldown • ${draft.cooldownAmount || '1'} ${COOLDOWN_UNIT_OPTIONS.find((option) => option.value === draft.cooldownUnit)?.label.toLowerCase() ?? 'turnos'}`
                          : USAGE_OPTIONS.find((option) => option.value === draft.usageReset)?.label ?? 'Sem uso'
                        : 'Sem contador de uso'}
                    </div>
                    {draft.usageEnabled ? (
                      <div className="mt-2 text-xs text-text">
                        Max {draft.usageMax || '1'} • Usados {draft.usageUsed || '0'}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={saveDraft} disabled={!draft.name.trim()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  const summaryLabel = (ability: CustomAbility) => {
    const usage = ability.usage
    if (!usage) return 'Sem contador de uso'
    if (usage.reset === 'cooldown') {
      const amount = Math.max(1, Math.trunc(usage.cooldownAmount ?? 1) || 1)
      const unit = COOLDOWN_UNIT_OPTIONS.find((option) => option.value === (usage.cooldownUnit ?? 'turns'))?.label ?? 'Turnos'
      return `Cooldown • ${amount} ${unit.toLowerCase()}`
    }
    return USAGE_OPTIONS.find((option) => option.value === usage.reset)?.label ?? 'Sem uso'
  }

  const sortedAbilities = [...abilities].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">Habilidades</div>
              <div className="mt-1 text-xs text-text">Gerencie habilidades e seus usos em um modal dedicado.</div>
            </div>
            <Button size="sm" variant="secondary" onClick={openCreateAbility}>
              + Adicionar habilidade
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedAbilities.length === 0 ? (
            <p className="text-xs text-text">Adicione habilidades livres da ficha.</p>
          ) : (
            <div className="grid gap-3">
              {sortedAbilities.map((ability) => {
                const usage = ability.usage
                const remaining = usage ? Math.max(0, usage.max - usage.used) : null

                return (
                  <div
                    key={ability.id}
                    className={cn(
                      'rounded-2xl border border-border bg-bg p-4 transition-shadow hover:shadow-theme',
                      usage ? 'grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]' : 'flex items-center justify-between gap-4',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-textH">{ability.name || 'Habilidade sem nome'}</div>
                        {usage ? (
                          <span className="rounded-full border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] px-2 py-0.5 text-[11px] font-medium text-text">
                            {summaryLabel(ability)}
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] px-2 py-0.5 text-[11px] font-medium text-text">
                            Sem contador
                          </span>
                        )}
                      </div>

                      {ability.description ? (
                        <div className="mt-2 text-xs leading-5 text-text">
                          <div
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                            }}
                          >
                            {ability.description}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-2 text-xs text-text">
                        {usage ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>{remaining}/{usage.max} usos restantes</span>
                            <span>Gastos {usage.used}</span>
                            {usage.reset === 'cooldown' ? (
                              <span>{Math.max(1, Math.trunc(usage.cooldownAmount ?? 1) || 1)} {COOLDOWN_UNIT_OPTIONS.find((option) => option.value === (usage.cooldownUnit ?? 'turns'))?.label.toLowerCase()}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span>Habilidade livre, sem recursos associados.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button size="sm" variant="secondary" onClick={() => openEditAbility(ability)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateCharacter(character.id, (c) => ({
                            ...c,
                            customAbilities: (c.customAbilities ?? []).filter((item) => item.id !== ability.id),
                          }))
                        }
                        title="Remover habilidade"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {modalNode}
    </>
  )
}
