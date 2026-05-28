import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { CharacterSelector } from '../features/characters/characterSelector'
import { SlotsResources } from '../features/spells/SlotsResources'
import { abilityModifier } from '../lib/rules'
import { preparedLimitForClass } from '../lib/prepared'
import { multiclassSpellSlots } from '../lib/spellSlots'
import type { Character, CustomAbility, RestResetKind } from '../types'

const STANDARD_ACTIONS = [
  { key: 'attack', label: 'Atacar', description: 'Fazer um ataque com arma, magia ou outro efeito.' },
  { key: 'dash', label: 'Correr', description: 'Dobrar o deslocamento até o fim do turno.' },
  { key: 'disengage', label: 'Desengajar', description: 'Sair do alcance sem provocar ataques de oportunidade.' },
  { key: 'dodge', label: 'Esquivar', description: 'Conceder desvantagem nos ataques contra você.' },
  { key: 'help', label: 'Ajudar', description: 'Ajudar um aliado, concedendo vantagem.' },
  { key: 'hide', label: 'Esconder', description: 'Tentar ficar oculto.' },
  { key: 'ready', label: 'Preparar', description: 'Preparar uma ação para uma condição futura.' },
  { key: 'search', label: 'Procurar', description: 'Procurar detalhes, criaturas ou objetos.' },
  { key: 'jump', label: 'Saltar', description: 'Usar o movimento para um salto em distância ou altura.' },
  { key: 'object', label: 'Interagir', description: 'Manipular um objeto ou elemento do cenário.' },
  { key: 'grapple', label: 'Agarrar', description: 'Tentar agarrar uma criatura.' },
  { key: 'shove', label: 'Empurrar', description: 'Tentar empurrar ou derrubar uma criatura.' },
]

const RESET_LABELS: Record<RestResetKind | 'turn', string> = {
  turn: 'Por turno',
  shortRest: 'Por descanso curto',
  longRest: 'Por descanso longo',
}

type HitDiceDraft = {
  spent: string
  rolls: string[]
}

type Props = {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
  canEditActions: boolean
}

function resetSpellUsesForRest(spells: Character['spells'], kind: RestResetKind): Character['spells'] {
  return spells.map((spell) => {
    const freeUses = spell.freeUses
    if (!freeUses) return spell

    const reset = (freeUses.reset ?? 'longRest') as RestResetKind
    const shouldReset = kind === 'longRest' ? reset === 'longRest' || reset === 'shortRest' : reset === 'shortRest'
    if (!shouldReset) return spell

    const used = typeof freeUses.used === 'number' && Number.isFinite(freeUses.used) ? Math.max(0, Math.trunc(freeUses.used)) : 0
    if (used === 0) return spell
    return { ...spell, freeUses: { ...freeUses, used: 0 } }
  })
}

function resetAbilityUsesForRest(abilities: CustomAbility[], kind: 'shortRest' | 'longRest'): CustomAbility[] {
  return abilities.map((ability) => {
    const usage = ability.usage
    if (!usage) return ability

    if (kind === 'shortRest' && usage.reset !== 'shortRest') return ability

    return {
      ...ability,
      usage: {
        ...usage,
        used: 0,
      },
    }
  })
}

export function ActionsView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
  updateCharacter,
  canEditActions,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [hitDiceDrafts, setHitDiceDrafts] = useState<Record<number, HitDiceDraft>>({})

  useEffect(() => {
    setSelectedAction('')
    setHitDiceDrafts({})
  }, [activeCharacter.id])

  const slotMeta = useMemo(() => multiclassSpellSlots(activeCharacter.classes), [activeCharacter.classes])
  const slotUsage = activeCharacter.slotUsage ?? { usedByLevel: undefined, pactUsed: 0 }
  const usedByLevel = (() => {
    const arr = Array.isArray(slotUsage.usedByLevel) ? [...slotUsage.usedByLevel] : []
    while (arr.length < 10) arr.push(0)
    return arr
  })()
  const pactUsed = typeof slotUsage.pactUsed === 'number' && Number.isFinite(slotUsage.pactUsed)
    ? Math.max(0, Math.trunc(slotUsage.pactUsed))
    : 0

  const sorcererLevel = useMemo(
    () =>
      activeCharacter.classes.reduce(
        (acc, cls) => acc + (cls.classIndex === 'sorcerer' ? (typeof cls.level === 'number' ? cls.level : 0) : 0),
        0,
      ),
    [activeCharacter.classes],
  )
  const sorceryPointsMax = Math.max(0, Math.trunc(sorcererLevel))
  const sorceryPointsUsedRaw = activeCharacter.sorceryPointsUsed
  const sorceryPointsUsed =
    typeof sorceryPointsUsedRaw === 'number' && Number.isFinite(sorceryPointsUsedRaw)
      ? Math.max(0, Math.trunc(sorceryPointsUsedRaw))
      : 0
  const sorceryPointsUsedClamped = sorceryPointsMax > 0 ? Math.min(sorceryPointsUsed, sorceryPointsMax) : 0
  const sorceryPointsRemaining = sorceryPointsMax > 0 ? Math.max(0, sorceryPointsMax - sorceryPointsUsedClamped) : 0
  const hasSpells = activeCharacter.spells.length > 0

  const preparedSpells = useMemo(
    () =>
      activeCharacter.spells.filter((spell) => {
        if (spell.prepared) return true
        if (spell.sourceType === 'feat') return true

        if (spell.sourceType === 'class') {
          const sourceClass = activeCharacter.classes.find((cls) => cls.id === spell.sourceClassId)
          if (!sourceClass) return false

          const abilityScore = activeCharacter.attributes[sourceClass.castingAbility] ?? 10
          const preparedLimit = preparedLimitForClass({
            classIndex: sourceClass.classIndex,
            classLevel: sourceClass.level,
            abilityScore,
          })
          return preparedLimit === null
        }

        return false
      }),
    [activeCharacter.classes, activeCharacter.spells],
  )

  const freeUseSpells = useMemo(
    () =>
      activeCharacter.spells
        .map((spell) => {
          const maxRaw = spell.freeUses?.max
          const max = typeof maxRaw === 'number' && Number.isFinite(maxRaw) ? Math.max(0, Math.trunc(maxRaw)) : 0
          const usedRaw = spell.freeUses?.used
          const used = typeof usedRaw === 'number' && Number.isFinite(usedRaw) ? Math.max(0, Math.trunc(usedRaw)) : 0
          const remaining = max > 0 ? Math.max(0, max - Math.min(used, max)) : 0
          return {
            spellIndex: spell.spellIndex,
            name: spell.displayNamePt?.trim() || spell.spellName,
            max,
            used: Math.min(used, max),
            remaining,
          }
        })
        .filter((spell) => spell.max > 0)
        .sort((a, b) => a.name.toLocaleLowerCase('pt-BR').localeCompare(b.name.toLocaleLowerCase('pt-BR'), 'pt-BR')),
    [activeCharacter.spells],
  )

  function useFreeCast(spellIndex: string) {
    if (!canEditActions) return

    updateCharacter(activeCharacter.id, (c) => ({
      ...c,
      spells: c.spells.map((spell) => {
        if (spell.spellIndex !== spellIndex) return spell
        const prev = spell.freeUses
        if (!prev) return spell
        const max = Math.max(1, Math.trunc(prev.max))
        const used = typeof prev.used === 'number' && Number.isFinite(prev.used) ? Math.max(0, Math.trunc(prev.used)) : 0
        return { ...spell, freeUses: { ...prev, used: Math.min(max, used + 1) } }
      }),
    }))
  }

  function setFreeCastUsed(spellIndex: string, nextUsed: number) {
    if (!canEditActions) return

    updateCharacter(activeCharacter.id, (c) => ({
      ...c,
      spells: c.spells.map((spell) => {
        if (spell.spellIndex !== spellIndex) return spell
        const prev = spell.freeUses
        if (!prev) return spell
        const max = Math.max(1, Math.trunc(prev.max))
        const used = Math.max(0, Math.min(max, Math.trunc(nextUsed) || 0))
        return { ...spell, freeUses: { ...prev, used } }
      }),
    }))
  }

  function updateAbilityUsage(abilityId: string, nextUsed: number) {
    if (!canEditActions) return

    updateCharacter(activeCharacter.id, (c) => ({
      ...c,
      customAbilities: (c.customAbilities ?? []).map((ability) => {
        if (ability.id !== abilityId || !ability.usage) return ability
        return {
          ...ability,
          usage: {
            ...ability.usage,
            used: Math.max(0, Math.min(ability.usage.max, Math.trunc(nextUsed) || 0)),
          },
        }
      }),
    }))
  }

  function changeHitDiceDraft(index: number, nextSpent: string) {
    setHitDiceDrafts((prev) => {
      const current = prev[index] ?? { spent: '0', rolls: [] }
      const spent = Math.max(0, Number.parseInt(nextSpent, 10) || 0)
      const rolls = [...current.rolls]
      while (rolls.length < spent) rolls.push('')
      rolls.length = spent
      return { ...prev, [index]: { spent: String(spent), rolls } }
    })
  }

  function changeHitDiceRoll(index: number, rollIndex: number, value: string) {
    setHitDiceDrafts((prev) => {
      const current = prev[index] ?? { spent: '0', rolls: [] }
      const rolls = [...current.rolls]
      while (rolls.length <= rollIndex) rolls.push('')
      rolls[rollIndex] = value
      return { ...prev, [index]: { ...current, rolls } }
    })
  }

  function performShortRest() {
    if (!canEditActions) return

    const conMod = abilityModifier(activeCharacter.attributes.con)

    updateCharacter(activeCharacter.id, (c) => {
      let hpToAdd = 0

      const nextHitDice = (c.hitDice ?? []).map((hitDie, index) => {
        const draft = hitDiceDrafts[index]
        const spentRequested = Math.max(0, Number.parseInt(draft?.spent ?? '0', 10) || 0)
        const spent = Math.min(hitDie.current, spentRequested)
        const rolls = Array.from({ length: spent }, (_, rollIndex) => Math.max(0, Number.parseInt(draft?.rolls?.[rollIndex] ?? '0', 10) || 0))
        hpToAdd += rolls.reduce((sum, roll) => sum + Math.max(1, roll + conMod), 0)

        return {
          ...hitDie,
          current: Math.max(0, hitDie.current - spent),
        }
      })

      return {
        ...c,
        currentHp: Math.max(0, Math.min(c.maxHp, c.currentHp + hpToAdd)),
        hitDice: nextHitDice,
        spells: resetSpellUsesForRest(c.spells, 'shortRest'),
        customAbilities: resetAbilityUsesForRest(c.customAbilities ?? [], 'shortRest'),
        slotUsage: { ...(c.slotUsage ?? {}), pactUsed: 0 },
      }
    })

    setHitDiceDrafts({})
  }

  function performLongRest() {
    if (!canEditActions) return

    updateCharacter(activeCharacter.id, (c) => {
      const nextHitDice = (c.hitDice ?? []).map((hitDie) => {
        const regain = Math.max(1, Math.floor(Math.max(0, Math.trunc(hitDie.max)) / 2))
        return {
          ...hitDie,
          current: Math.min(hitDie.max, Math.max(0, hitDie.current) + regain),
        }
      })

      return {
        ...c,
        currentHp: c.maxHp,
        temporaryHp: 0,
        hitDice: nextHitDice,
        spells: resetSpellUsesForRest(c.spells, 'longRest'),
        customAbilities: resetAbilityUsesForRest(c.customAbilities ?? [], 'longRest'),
        slotUsage: { ...(c.slotUsage ?? {}), pactUsed: 0, usedByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        sorceryPointsUsed: sorcererLevel > 0 ? 0 : undefined,
      }
    })

    setHitDiceDrafts({})
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={showOwnerBadge}
      />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Ações básicas</div>
          <div className="mt-1 text-xs text-text">Ações padrão de D&D, úteis como referência rápida em combate.</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {STANDARD_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => setSelectedAction(action.key)}
                className={
                  selectedAction === action.key
                    ? 'rounded-xl border border-accentBorder bg-accentBg/30 p-3 text-left transition'
                    : 'rounded-xl border border-border bg-bg p-3 text-left transition hover:border-accentBorder'
                }
              >
                <div className="text-sm font-semibold text-textH">{action.label}</div>
                <div className="mt-1 text-xs text-text">{action.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Habilidades</div>
          <div className="mt-1 text-xs text-text">Use aqui habilidades com usos por turno, descanso curto ou descanso longo.</div>
        </CardHeader>
        <CardContent>
          {activeCharacter.customAbilities?.length ? (
            <div className="grid gap-2">
              {activeCharacter.customAbilities.map((ability) => {
                const usage = ability.usage
                const remaining = usage ? Math.max(0, usage.max - usage.used) : null
                return (
                  <div key={ability.id} className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-textH">{ability.name}</div>
                      {usage ? (
                        <div className="mt-1 text-xs text-text">
                          {RESET_LABELS[usage.reset]} • {remaining}/{usage.max} usos restantes
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-text">Sem contador de uso</div>
                      )}
                    </div>

                    {usage ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canEditActions || (remaining ?? 0) <= 0}
                          onClick={() => updateAbilityUsage(ability.id, usage.used + 1)}
                        >
                          Usar
                        </Button>
                        <Input
                          className="h-9 w-20"
                          type="number"
                          min={0}
                          max={usage.max}
                          disabled={!canEditActions}
                          value={usage.used}
                          onChange={(e) => updateAbilityUsage(ability.id, Number.parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-text">Nenhuma habilidade cadastrada.</p>
          )}
        </CardContent>
      </Card>

      {hasSpells ? (
        <>
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold text-textH">Magias preparadas</div>
              <div className="mt-1 text-xs text-text">Lista das magias marcadas como preparadas ou sempre disponíveis para uso rápido.</div>
            </CardHeader>
            <CardContent>
              {preparedSpells.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {preparedSpells.map((spell) => {
                    const name = spell.displayNamePt?.trim() || spell.spellName
                    const sourceLabel =
                      spell.prepared
                        ? 'Preparada'
                        : spell.sourceType === 'feat'
                          ? 'Talento'
                          : 'Sempre disponível'
                    return (
                      <div key={`${spell.spellIndex}-${spell.addedAt}`} className="rounded-xl border border-border bg-bg p-3">
                        <div className="text-sm font-semibold text-textH">{name}</div>
                        <div className="mt-1 text-xs text-text">Círc. {spell.castSlotLevel ?? '—'} • {sourceLabel}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-text">Nenhuma magia preparada.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold text-textH">Recursos de magia</div>
              <div className="mt-1 text-xs text-text">Usos gratuitos, slots, pacto e pontos de feitiçaria com os botões de descanso movidos para esta aba.</div>
            </CardHeader>
            <CardContent>
              {freeUseSpells.length ? (
                <div className="mb-3 grid gap-2">
                  {freeUseSpells.map((spell) => (
                    <div key={spell.spellIndex} className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-textH">{spell.name}</div>
                        <div className="mt-1 text-xs text-text">{spell.remaining}/{spell.max} disponíveis</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canEditActions || spell.remaining <= 0}
                          onClick={() => useFreeCast(spell.spellIndex)}
                        >
                          Usar
                        </Button>
                        <Input
                          className="h-9 w-20"
                          type="number"
                          min={0}
                          max={spell.max}
                          disabled={!canEditActions}
                          value={spell.used}
                          onChange={(e) => setFreeCastUsed(spell.spellIndex, Number.parseInt(e.target.value, 10) || 0)}
                          title="Usados"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <SlotsResources
                activeCharacter={activeCharacter}
                slotMeta={slotMeta}
                usedByLevel={usedByLevel}
                pactUsed={pactUsed}
                sorceryPointsMax={sorceryPointsMax}
                sorceryPointsRemaining={sorceryPointsRemaining}
                sorceryPointsUsedClamped={sorceryPointsUsedClamped}
                updateCharacter={updateCharacter}
                onShortRest={performShortRest}
                onLongRest={performLongRest}
                disabled={!canEditActions}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Descanso curto</div>
          <div className="mt-1 text-xs text-text">Informe quantos dados foram gastos e as rolagens para recuperar PV.</div>
        </CardHeader>
        <CardContent>
          {activeCharacter.hitDice.length ? (
            <div className="grid gap-3">
              {activeCharacter.hitDice.map((hitDie, index) => {
                const draft = hitDiceDrafts[index] ?? { spent: '0', rolls: [] }
                const spent = Math.max(0, Math.min(hitDie.current, Number.parseInt(draft.spent, 10) || 0))
                const rolls = Array.from({ length: spent }, (_, rollIndex) => draft.rolls[rollIndex] ?? '')

                return (
                  <div key={`hit-die-${index}`} className="rounded-xl border border-border bg-bg p-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text">
                      <div className="font-semibold text-textH">d{hitDie.diceValue}</div>
                      <div>Disponíveis: {hitDie.current}/{hitDie.max}</div>
                      <div className="flex items-center gap-2">
                        <span>Gastar</span>
                        <Input
                          className="h-8 w-20"
                          type="number"
                          min={0}
                          max={hitDie.current}
                          disabled={!canEditActions}
                          value={draft.spent}
                          onChange={(e) => changeHitDiceDraft(index, e.target.value)}
                        />
                      </div>
                    </div>

                    {spent > 0 ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {rolls.map((rollValue, rollIndex) => (
                          <Input
                            key={`hit-die-${index}-${rollIndex}`}
                            type="number"
                            min={1}
                            className="h-9"
                            disabled={!canEditActions}
                            value={rollValue}
                            onChange={(e) => changeHitDiceRoll(index, rollIndex, e.target.value)}
                            placeholder={`Rolagem ${rollIndex + 1}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-text">Este personagem não possui dados de vida registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
