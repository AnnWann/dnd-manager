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

type HpModal = "heal" | "damage" | "maximum"
type HealingTarget = "current" | "temporary"

export function CharacterHpControls({ character, updateCharacter, compact = false }: Props) {
  const { dispatchGameOperation, mode } = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()
  const authoritativeHp = mode === "campaign" ? runtime : null
  const [modal, setModal] = useState<HpModal | null>(null)
  const [amountText, setAmountText] = useState("")
  const [realMaxText, setRealMaxText] = useState("")
  const [healingTarget, setHealingTarget] = useState<HealingTarget>("current")
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const concentration = getConcentrationCondition(character)
  const characterId = character.get("id")
  const hp = character.get("sheet").HP
  const currentMax = getCurrentMaxHp(character)
  const effectiveMax = character.getEffectiveMaxHp()

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
  }

  function closeModal() {
    setModal(null)
    setAmountText("")
    setRealMaxText("")
  }

  function applyDamage() {
    const amount = parseAmount(amountText)
    if (amount <= 0) return

    const concentrationBeforeDamage = getConcentrationCondition(character)
    const concentrationDc = Math.max(10, Math.floor(amount / 2))
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
    closeModal()

    if (concentrationBeforeDamage) {
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
              <select
                className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={healingTarget}
                onChange={(event) => setHealingTarget(event.target.value as HealingTarget)}
              >
                <option value="current">Vida atual</option>
                <option value="temporary">Vida temporária</option>
              </select>
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
        <Modal title="Aplicar dano" onClose={closeModal} className="max-w-md">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <HpSummary label="Vida atual" value={hp.current} />
              <HpSummary label="Vida temporária" value={hp.temporary} />
            </div>

            <label className="grid gap-1 text-xs text-textMuted">
              Valor do dano
              <Input
                autoFocus
                type="number"
                min={0}
                inputMode="numeric"
                value={amountText}
                placeholder="0"
                onChange={(event) => setAmountText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyDamage()
                }}
              />
            </label>

            {concentration ? (
              <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-text">
                Este personagem está concentrando{concentration.source ? ` em ${concentration.source}` : ""}. Ao sofrer dano, será solicitado um teste de concentração.
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border pt-3">
              <Button variant="primary" onClick={applyDamage} disabled={amount <= 0}>
                Aplicar dano
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
