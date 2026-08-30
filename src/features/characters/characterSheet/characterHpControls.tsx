import { Select as SharedSelect } from "../../../components/ui/Select"
import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getCurrentMaxHp,
  restoreCurrentMaxHp,
  setCurrentMaxHp,
  setMaxHp,
} from "../../../models/characters/characterHp"
import {
  endConcentration,
  getConcentrationCondition,
} from "../../../models/characters/characterConcentration"
import { getEffectiveDamageAffinities } from "../../../models/characters/characterDamageAffinities"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  damageTypeLabel,
  resolveDamage,
  type DamageType,
} from "../../../models/combat/Damage"
import { GroupHitDice } from "./character_info/components/hitdice/groupHitDice"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  compact?: boolean
}

type PendingCheck = {
  damage: number
  dc: number
  spellName?: string
}

type CharacterDamagePart = {
  id: string
  amount: number
  damageType?: DamageType
  magical: boolean
}

type HpModal = "heal" | "damage" | "maximum"
type HealingTarget = "current" | "temporary"

let damagePartSequence = 0

function createDamagePart(): CharacterDamagePart {
  damagePartSequence += 1
  return {
    id: `character-damage-part-${damagePartSequence}`,
    amount: 0,
    magical: false,
  }
}

export function CharacterHpControls({ character, updateCharacter, compact = false }: Props) {
  const { dispatchGameOperation, mode } = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()
  const authoritativeHp = mode === "campaign" ? runtime : null
  const [modal, setModal] = useState<HpModal | null>(null)
  const [amountText, setAmountText] = useState("")
  const [realMaxText, setRealMaxText] = useState("")
  const [healingTarget, setHealingTarget] = useState<HealingTarget>("current")
  const [damageParts, setDamageParts] = useState<CharacterDamagePart[]>(() => [createDamagePart()])
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const concentration = getConcentrationCondition(character)
  const characterId = character.get("id")
  const hp = character.get("sheet").HP
  const currentMax = getCurrentMaxHp(character)
  const effectiveMax = character.getEffectiveMaxHp()
  const effectiveDamageAffinities = getEffectiveDamageAffinities(character)
  const damageResolutions = damageParts.map((part) => ({
    part,
    resolution: resolveDamage(
      Math.max(0, Math.trunc(part.amount || 0)),
      part.damageType,
      effectiveDamageAffinities,
      { magical: part.magical },
    ),
  }))
  const requestedDamage = damageResolutions.reduce(
    (total, entry) => total + entry.resolution.requested,
    0,
  )
  const appliedDamage = damageResolutions.reduce(
    (total, entry) => total + entry.resolution.applied,
    0,
  )
  const absorbedTemporaryHp = Math.min(Math.max(0, hp.temporary), appliedDamage)
  const hpDamage = Math.max(0, appliedDamage - absorbedTemporaryHp)
  const resultingTemporaryHp = Math.max(0, hp.temporary - absorbedTemporaryHp)
  const resultingCurrentHp = Math.max(0, hp.current - hpDamage)

  function parseAmount(value: string): number {
    return Math.max(0, Math.trunc(Number(value) || 0))
  }

  function sendAuthoritativeHp(operation: Parameters<NonNullable<typeof runtime>["dispatchHpOperation"]>[0]): boolean {
    if (!authoritativeHp) return false
    if (authoritativeHp.status !== "connected") {
      console.warn("[session-runtime] HP change ignored while the authoritative session server is disconnected.")
      return true
    }
    authoritativeHp.dispatchHpOperation(operation)
    return true
  }

  function openModal(next: HpModal) {
    setModal(next)
    setAmountText("")
    setRealMaxText(next === "maximum" ? String(hp.max) : "")
    setHealingTarget("current")
    if (next === "damage") setDamageParts([createDamagePart()])
  }

  function closeModal() {
    setModal(null)
    setAmountText("")
    setRealMaxText("")
    setDamageParts([createDamagePart()])
  }

  function updateDamagePart(
    partId: string,
    updater: (part: CharacterDamagePart) => CharacterDamagePart,
  ) {
    setDamageParts((current) =>
      current.map((part) => (part.id === partId ? updater(part) : part)),
    )
  }

  function applyDamage() {
    const amount = appliedDamage
    if (requestedDamage <= 0) return

    const concentrationBeforeDamage = getConcentrationCondition(character)
    const concentrationDc = Math.max(10, Math.floor(amount / 2))

    if (amount > 0) {
      const runtimeHandled = sendAuthoritativeHp({
        type: "character.hp.damage",
        characterId,
        amount,
        requiresConcentrationCheck: Boolean(concentrationBeforeDamage),
        concentrationDc: concentrationBeforeDamage ? concentrationDc : undefined,
        concentrationSource: concentrationBeforeDamage?.source || undefined,
      })

      if (!runtimeHandled) {
        if (dispatchGameOperation) {
          dispatchGameOperation({
            type: "character.hp.damage",
            characterId,
            amount,
            requiresConcentrationCheck: Boolean(concentrationBeforeDamage),
            concentrationDc: concentrationBeforeDamage ? concentrationDc : undefined,
            concentrationSource: concentrationBeforeDamage?.source || undefined,
          })
        } else {
          updateCharacter(characterId, (current) => current.takeDamage(amount))
        }
      }
    }
    closeModal()

    if (concentrationBeforeDamage && amount > 0) {
      setPendingCheck({
        damage: amount,
        dc: concentrationDc,
        spellName: concentrationBeforeDamage.source || undefined,
      })
    }
  }

  function applyHealing() {
    const amount = parseAmount(amountText)
    if (amount <= 0) return

    const runtimeHandled = sendAuthoritativeHp(
      healingTarget === "temporary"
        ? { type: "character.hp.temporary.add", characterId, amount }
        : { type: "character.hp.heal", characterId, amount },
    )

    if (!runtimeHandled) {
      updateCharacter(characterId, (current) => {
        if (healingTarget === "temporary") {
          return current.setTemporaryHp(current.get("sheet").HP.temporary + amount)
        }
        return current.heal(amount)
      })
    }
    closeModal()
  }

  function updateRealMaximum() {
    const nextMax = Math.max(1, Math.trunc(Number(realMaxText) || 0))
    if (sendAuthoritativeHp({ type: "character.hp.max.set", characterId, value: nextMax })) return
    updateCharacter(characterId, (current) => setMaxHp(current, nextMax))
  }

  function changeCurrentMaximum(direction: "increase" | "reduce") {
    const amount = parseAmount(amountText)
    if (amount <= 0) return

    if (sendAuthoritativeHp({
      type: "character.hp.currentMax.adjust",
      characterId,
      amount: direction === "increase" ? amount : -amount,
    })) {
      setAmountText("")
      return
    }

    updateCharacter(characterId, (current) => {
      const base = getCurrentMaxHp(current)
      return setCurrentMaxHp(
        current,
        direction === "increase" ? base + amount : base - amount,
      )
    })
    setAmountText("")
  }

  function restoreMaximum() {
    if (!sendAuthoritativeHp({ type: "character.hp.currentMax.restore", characterId })) {
      updateCharacter(characterId, restoreCurrentMaxHp)
    }
    setAmountText("")
  }

  function failConcentration() {
    if (authoritativeHp?.status === "connected") {
      authoritativeHp.dispatchConcentrationOperation({
        type: "character.concentration.end",
        characterId,
        reason: "failed-save",
      })
    } else if (!authoritativeHp) {
      updateCharacter(characterId, endConcentration)
    } else {
      console.warn("[session-runtime] Concentration change ignored while the authoritative session server is disconnected.")
    }
    setPendingCheck(null)
  }

  const amount = parseAmount(amountText)
  const realMaxValue = Math.max(1, Math.trunc(Number(realMaxText) || 0))

  return (
    <>
      <div className="grid gap-2">
        <div className="grid grid-cols-3 gap-2">
          <HpDisplay label="Vida atual" value={hp.current} />
          <HpMaximumButton
            value={effectiveMax}
            reduced={currentMax < hp.max}
            onClick={() => openModal("maximum")}
          />
          <HpDisplay label="Vida temporária" value={hp.temporary} />
        </div>

        <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-3"}>
          <button
            type="button"
            onClick={() => openModal("heal")}
            className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg"
          >
            Curar
          </button>
          <button
            type="button"
            onClick={() => openModal("damage")}
            className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs font-semibold text-textH transition-colors hover:border-danger hover:bg-dangerBg"
          >
            Dano
          </button>
        </div>

        {compact ? (
          <div className="mt-2 border-t border-border pt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Dados de vida
            </div>
            <GroupHitDice
              character={character}
              updateCharacter={updateCharacter}
            />
          </div>
        ) : null}
      </div>

      {modal === "heal" ? (
        <Modal title="Curar" onClose={closeModal} className="max-w-md">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <HpSummary label="Vida atual" value={hp.current} />
              <HpSummary label="Vida temporária" value={hp.temporary} />
            </div>

            <label className="grid gap-1 text-xs text-textMuted">
              Valor da cura
              <Input
                autoFocus
                type="number"
                min={0}
                inputMode="numeric"
                value={amountText}
                placeholder="0"
                onChange={(event) => setAmountText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyHealing()
                }}
              />
            </label>

            <label className="grid gap-1 text-xs text-textMuted">
              Aplicar em
              <SharedSelect
                className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={healingTarget}
                onChange={(event) => setHealingTarget(event.target.value as HealingTarget)}
              >
                <option value="current">Vida atual</option>
                <option value="temporary">Vida temporária</option>
              </SharedSelect>
            </label>

            <div className="flex justify-end border-t border-border pt-3">
              <Button variant="primary" onClick={applyHealing} disabled={amount <= 0}>
                Curar
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === "damage" ? (
        <Modal
          title="Aplicar dano"
          description="Adicione os componentes do dano para aplicar automaticamente resistências, imunidades e vulnerabilidades."
          onClose={closeModal}
          className="max-w-3xl"
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HpSummary label="Vida atual" value={hp.current} />
              <HpSummary label="Vida temporária" value={hp.temporary} />
              <HpSummary label="Dano informado" value={requestedDamage} />
              <HpSummary label="Dano aplicado" value={appliedDamage} />
            </div>

            <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-textH">Componentes do dano</div>
                  <div className="mt-0.5 text-[11px] text-textMuted">
                    Informe o valor, tipo e se o dano é mágico.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDamageParts((current) => [...current, createDamagePart()])}
                >
                  + Componente
                </Button>
              </div>

              <div className="grid gap-2">
                {damageResolutions.map(({ part, resolution }, index) => (
                  <div
                    key={part.id}
                    className="grid gap-2 rounded-lg border border-border bg-bg p-3 md:grid-cols-[110px_minmax(180px,1fr)_auto_auto] md:items-end"
                  >
                    <label className="grid gap-1 text-xs text-textMuted">
                      Dano
                      <Input
                        autoFocus={index === 0}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={part.amount || ""}
                        placeholder="0"
                        onChange={(event) =>
                          updateDamagePart(part.id, (current) => ({
                            ...current,
                            amount: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                          }))
                        }
                      />
                    </label>

                    <label className="grid gap-1 text-xs text-textMuted">
                      Tipo
                      <SharedSelect
                        value={part.damageType ?? ""}
                        onChange={(event) =>
                          updateDamagePart(part.id, (current) => ({
                            ...current,
                            damageType: event.target.value
                              ? event.target.value as DamageType
                              : undefined,
                          }))
                        }
                      >
                        <option value="">Sem tipo</option>
                        {DAMAGE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SharedSelect>
                    </label>

                    <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 text-xs text-textH">
                      <input
                        type="checkbox"
                        checked={part.magical}
                        onChange={(event) =>
                          updateDamagePart(part.id, (current) => ({
                            ...current,
                            magical: event.target.checked,
                          }))
                        }
                      />
                      Mágico
                    </label>

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={damageParts.length === 1}
                      onClick={() =>
                        setDamageParts((current) =>
                          current.filter((currentPart) => currentPart.id !== part.id),
                        )
                      }
                    >
                      Remover
                    </Button>

                    {part.amount > 0 && part.damageType ? (
                      <div className="text-[11px] text-textMuted md:col-span-4">
                        {damageTypeLabel(part.damageType)}: {resolution.requested} → {resolution.applied}
                        {resolution.affinity
                          ? ` (${damageAffinityLabel(resolution.affinity)})`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {effectiveDamageAffinities.length > 0 ? (
              <section className="rounded-xl border border-border bg-bg-subtle p-3">
                <div className="text-xs font-semibold text-textH">Afinidades efetivas</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {effectiveDamageAffinities.map((affinity, index) => (
                    <span
                      key={`${affinity.kind}:${affinity.damageType}:${affinity.qualifier ?? "any"}:${index}`}
                      className="rounded-full border border-border bg-bg px-2 py-1 text-[10px] text-textMuted"
                    >
                      {damageAffinityLabel(affinity.kind)} · {damageTypeLabel(affinity.damageType)}
                      {affinity.qualifier === "nonmagical"
                        ? " · não mágico"
                        : affinity.qualifier === "magical"
                          ? " · mágico"
                          : ""}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <HpSummary label="Vida após" value={resultingCurrentHp} />
              <HpSummary label="Vida temporária após" value={resultingTemporaryHp} />
            </div>

            {concentration && appliedDamage > 0 ? (
              <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-text">
                Este personagem está concentrando{concentration.source ? ` em ${concentration.source}` : ""}. Ao sofrer {appliedDamage} de dano, será solicitado um teste de concentração CD {Math.max(10, Math.floor(appliedDamage / 2))}.
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border pt-3">
              <Button variant="primary" onClick={applyDamage} disabled={requestedDamage <= 0}>
                Aplicar {appliedDamage} de dano
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === "maximum" ? (
        <Modal title="Pontos de vida máximos" onClose={closeModal} className="max-w-md">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <HpSummary label="Máximo real" value={hp.max} />
              <HpSummary label="Máximo atual" value={currentMax} />
            </div>

            <label className="grid gap-1 text-xs text-textMuted">
              Máximo real
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={realMaxText}
                onChange={(event) => setRealMaxText(event.target.value)}
              />
            </label>

            <Button
              variant="secondary"
              onClick={updateRealMaximum}
              disabled={realMaxValue === hp.max}
            >
              Atualizar máximo real
            </Button>

            <div className="border-t border-border pt-4">
              <div className="mb-2 text-xs font-semibold text-textH">
                Alteração temporária do máximo
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={amountText}
                  placeholder="0"
                  onChange={(event) => setAmountText(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => changeCurrentMaximum("increase")}
                  disabled={amount <= 0}
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => changeCurrentMaximum("reduce")}
                  disabled={amount <= 0}
                >
                  −
                </Button>
              </div>
              {currentMax !== hp.max ? (
                <Button className="mt-2 w-full" variant="ghost" onClick={restoreMaximum}>
                  Restaurar máximo real
                </Button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingCheck ? (
        <Modal
          title="Teste de concentração"
          onClose={() => setPendingCheck(null)}
          className="max-w-md"
        >
          <div className="grid gap-4">
            <div className="rounded-lg border border-accentBorder bg-accentBg p-3 text-sm text-text">
              O personagem sofreu {pendingCheck.damage} de dano e precisa realizar um teste de Constituição CD {pendingCheck.dc}{pendingCheck.spellName ? ` para manter ${pendingCheck.spellName}` : ""}.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setPendingCheck(null)}>
                Passou
              </Button>
              <Button variant="primary" onClick={failConcentration}>
                Falhou
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function HpDisplay({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
    </div>
  )
}

function HpMaximumButton({ value, reduced, onClick }: { value: number; reduced: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center transition-colors hover:border-accentBorder hover:bg-accentBg"
    >
      <div className="text-[10px] uppercase tracking-wide text-textMuted">Vida máxima</div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
      {reduced ? <div className="text-[9px] text-danger">reduzida</div> : null}
    </button>
  )
}

function HpSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-textH">{value}</div>
    </div>
  )
}
