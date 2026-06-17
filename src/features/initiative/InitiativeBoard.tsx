import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { Character } from '../../models/types'
import type { InitiativeResult } from './initiative'
import { InitiativeForm } from './initiativeForm'
import { InitiativeCarousel } from './initiativeCarousel'
import { InitiativeHpEditor } from './InitiativeHpEditor'
import { badge } from '../spells/addedSpells/badge'

type Props = {
  characters: Character[]
  initiativeOrder: InitiativeResult[]
  currentTurnIndex: number
  canSeeCharacterDetails: (character: Character | InitiativeResult) => boolean
  canEditInitiative: boolean
  canEditCharacterHp: (character: Character | InitiativeResult) => boolean
  onAdd: (character: Character, rolledValue: number) => void
  onRemove: (characterId: string) => void
  onRemoveEffect: (characterId: string, effectId: string) => void
  onApplyEffect: (characterId: string, effectLabel: string) => void
  onNextTurn: () => void
  onClear: () => void
  onUpdateCurrentHp: (characterId: string, currentHp: number, temporaryHp?: number) => void
}

export function InitiativeBoard({
  characters,
  initiativeOrder,
  currentTurnIndex,
  canSeeCharacterDetails,
  canEditInitiative,
  canEditCharacterHp,
  onAdd,
  onRemove,
  onRemoveEffect,
  onApplyEffect,
  onNextTurn,
  onClear,
  onUpdateCurrentHp,
}: Props) {
  const [effectDrafts, setEffectDrafts] = useState<Record<string, string>>({})
  const [effectDurations, setEffectDurations] = useState<Record<string, string>>({})

  function handleApplyEffect(characterId: string) {
    const effectLabel = effectDrafts[characterId]?.trim() ?? ''
    if (!effectLabel) return
    const turns = Math.max(1, Number.parseInt(effectDurations[characterId] ?? '1', 10) || 1)
    onApplyEffect(characterId, `${effectLabel}|||${turns}`)
    setEffectDrafts((prev) => ({ ...prev, [characterId]: '' }))
    setEffectDurations((prev) => ({ ...prev, [characterId]: '1' }))
  }

  return (
    <section className="flex flex-col gap-6">
      {canEditInitiative ? (
        <InitiativeForm
          characters={characters}
          initiativeOrder={initiativeOrder}
          onAdd={onAdd}
        />
      ) : null}

        <InitiativeCarousel
        order={initiativeOrder}
        currentTurnIndex={currentTurnIndex}
        canSeeCharacterDetails={canSeeCharacterDetails}
        canEditCharacterHp={canEditCharacterHp}
          onUpdateCurrentHp={onUpdateCurrentHp}
        onRemove={canEditInitiative ? onRemove : undefined}
        onRemoveEffect={canEditInitiative ? onRemoveEffect : undefined}
      />

      {canEditInitiative ? (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-accentBorder bg-accentBg/20 p-4">
          <Button variant="primary" onClick={onNextTurn} disabled={initiativeOrder.length === 0}>
            Próximo
          </Button>

          <Button variant="secondary" onClick={onClear} disabled={initiativeOrder.length === 0}>
            Limpar Iniciativa
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-accentBorder bg-accentBg/10">
        <div className="border-b border-accentBorder px-4 py-3">
          <div className="text-sm font-semibold text-textH">Lista da iniciativa</div>
          <div className="mt-1 text-xs text-text">Efeitos, posição e pontos de vida editáveis quando permitido.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-bg/60 text-xs uppercase tracking-wide text-text">
              <tr>
                <th className="border-b border-accentBorder px-4 py-3">Ordem</th>
                <th className="border-b border-accentBorder px-4 py-3">Personagem</th>
                <th className="border-b border-accentBorder px-4 py-3">Iniciativa</th>
                <th className="border-b border-accentBorder px-4 py-3">HP / CA</th>
                <th className="border-b border-accentBorder px-4 py-3">Efeitos</th>
                {canEditInitiative ? <th className="border-b border-accentBorder px-4 py-3">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {initiativeOrder.map((entry, index) => {
                const sourceCharacter = characters.find((character) => character.id === entry.sourceCharacterId) ?? null
                const canSeeDetails = sourceCharacter ? canSeeCharacterDetails(sourceCharacter) || canEditCharacterHp(sourceCharacter) : false
                const canEditHp = sourceCharacter ? canEditCharacterHp(sourceCharacter) : false

                return (
                  <tr key={entry.id} className={index === currentTurnIndex ? 'bg-accentBg/30' : ''}>
                    <td className="border-b border-accentBorder px-4 py-3 text-text">{index + 1}</td>
                    <td className="border-b border-accentBorder px-4 py-3 text-textH">
                      <div className="font-medium">{entry.displayName}</div>
                      {index === currentTurnIndex ? <div className="mt-1">{badge('Turno atual')}</div> : null}
                    </td>
                    <td className="border-b border-accentBorder px-4 py-3 text-text">
                      <strong>{entry.initiative}</strong>
                    </td>
                    <td className="border-b border-accentBorder px-4 py-3 text-text">
                      {canSeeDetails ? (
                        <div className="flex flex-col gap-1">
                          <InitiativeHpEditor
                            target={entry}
                            canEditHp={canEditHp}
                            onUpdateCurrentHp={onUpdateCurrentHp}
                          />
                          <span className="text-xs text-text">CA {entry.armorClass}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="border-b border-accentBorder px-4 py-3 text-text">
                      <div className="flex flex-wrap gap-2">
                        {entry.effects.length ? (
                          entry.effects.map((effect) =>
                            canEditInitiative && onRemoveEffect ? (
                              <button
                                key={effect.id}
                                type="button"
                                className="cursor-pointer text-left transition hover:opacity-75"
                                onClick={() => onRemoveEffect(entry.id, effect.id)}
                                title="Clique para remover"
                              >
                                {badge(`${effect.label} (${effect.turnsRemaining})`, { kind: 'grid', title: 'Clique para remover' })}
                              </button>
                            ) : (
                              <span key={effect.id} className="inline-flex items-center gap-2">
                                {badge(effect.label, { kind: 'grid' })}
                                <span
                                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white"
                                  title={`Turnos restantes: ${effect.turnsRemaining}`}
                                >
                                  {effect.turnsRemaining}
                                </span>
                              </span>
                            ),
                          )
                        ) : (
                          <span className="text-xs text-text">Sem efeitos</span>
                        )}
                      </div>
                    </td>
                    {canEditInitiative ? (
                      <td className="border-b border-accentBorder px-4 py-3">
                        <div className="flex min-w-[240px] items-center gap-2">
                          <Input
                            className="h-8 text-xs"
                            value={effectDrafts[entry.id] ?? ''}
                            onChange={(e) =>
                              setEffectDrafts((prev) => ({
                                ...prev,
                                [entry.id]: e.target.value,
                              }))
                            }
                            placeholder="ex: Amedrontado"
                          />
                          <Input
                            className="h-8 w-12 text-xs"
                            type="number"
                            min={1}
                            max={99}
                            inputMode="numeric"
                            value={effectDurations[entry.id] ?? '1'}
                            onChange={(e) =>
                              setEffectDurations((prev) => ({
                                ...prev,
                                [entry.id]: e.target.value.slice(0, 2),
                              }))
                            }
                            placeholder="turnos"
                            title="Turnos restantes"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleApplyEffect(entry.id)}
                            disabled={!(effectDrafts[entry.id] ?? '').trim()}
                          >
                            Aplicar efeito
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}