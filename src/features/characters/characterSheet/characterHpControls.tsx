import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
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
    updateCharacter(characterId, (current) => current.takeDamage(amount))
    closeModal()

    if (concentrationBeforeDamage) {
      setPendingCheck({
        damage: amount,
        dc: Math.max(10, Math.floor(amount / 2)),
        spellName: concentrationBeforeDamage.source || undefined,
      })
    }
  }

  function applyHealing() {
    const amount = parseAmount(amountText)
    if (amount <= 0) return

    updateCharacter(characterId, (current) => {
      if (healingTarget === "temporary") {
        return current.setTemporaryHp(current.get("sheet").HP.temporary + amount)
      }
      return current.heal(amount)
    })
    closeModal()
  }

  function updateRealMaximum() {
    const nextMax = Math.max(1, Math.trunc(Number(realMaxText) || 0))
    updateCharacter(characterId, (current) => setMaxHp(current, nextMax))
  }

  function changeCurrentMaximum(direction: "increase" | "reduce") {
    const amount = parseAmount(amountText)
    if (amount <= 0) return

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
    updateCharacter(characterId, restoreCurrentMaxHp)
    setAmountText("")
  }

  function failConcentration() {
    updateCharacter(characterId, endConcentration)
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

            <p className="text-xs leading-5 text-textMuted">
              O dano consome primeiro a vida temporária e depois a vida atual. Se o personagem estiver concentrando, o teste de concentração é solicitado após o dano.
            </p>

            <div className="flex justify-end border-t border-border pt-3">
              <Button variant="primary" onClick={applyDamage} disabled={amount <= 0}>
                Aplicar dano
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === "maximum" ? (
        <Modal title="Vida máxima" onClose={closeModal} className="max-w-md">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <HpSummary label="Máxima atual" value={currentMax} />
              <HpSummary label="Máxima real" value={hp.max} />
            </div>
            {effectiveMax !== currentMax ? (
              <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-textH">
                Valor exibido com bônus e efeitos: <strong>{effectiveMax}</strong>
              </div>
            ) : null}

            <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3">
              <div>
                <div className="text-xs font-semibold text-textH">Atualizar vida máxima real</div>
                <p className="mt-1 text-[11px] leading-4 text-textMuted">
                  Altera o valor base permanente do personagem.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={realMaxText}
                  onChange={(event) => setRealMaxText(event.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={updateRealMaximum}
                  disabled={!realMaxText.trim() || realMaxValue === hp.max}
                >
                  Atualizar
                </Button>
              </div>
            </section>

            <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3">
              <div>
                <div className="text-xs font-semibold text-textH">Alterar vida máxima atual</div>
                <p className="mt-1 text-[11px] leading-4 text-textMuted">
                  Use para reduções ou aumentos temporários sem alterar a máxima real.
                </p>
              </div>
              <Input
                autoFocus
                type="number"
                min={0}
                inputMode="numeric"
                value={amountText}
                placeholder="Valor da alteração"
                onChange={(event) => setAmountText(event.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => changeCurrentMaximum("reduce")} disabled={amount <= 0}>
                  Reduzir
                </Button>
                <Button variant="primary" onClick={() => changeCurrentMaximum("increase")} disabled={amount <= 0 || currentMax >= hp.max}>
                  Aumentar
                </Button>
              </div>
            </section>

            <section className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle p-3">
              <div>
                <div className="text-xs font-semibold text-textH">Restaurar vida máxima atual</div>
                <p className="mt-1 text-[11px] leading-4 text-textMuted">
                  Retorna a máxima atual ao valor da máxima real.
                </p>
              </div>
              <Button variant="secondary" onClick={restoreMaximum} disabled={currentMax === hp.max}>
                Restaurar
              </Button>
            </section>
          </div>
        </Modal>
      ) : null}

      {pendingCheck && concentration ? (
        <Modal title="Teste de concentração" onClose={() => setPendingCheck(null)} className="max-w-md">
          <div className="grid gap-3">
            <p className="text-sm leading-6 text-text">
              O personagem sofreu <strong>{pendingCheck.damage} de dano</strong> enquanto estava concentrando{pendingCheck.spellName ? ` em ${pendingCheck.spellName}` : ""}.
            </p>
            <div className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm text-textH">
              Faça um teste de resistência de Constituição com <strong>CD {pendingCheck.dc}</strong>.
            </div>
            <p className="text-xs leading-5 text-textMuted">
              Passar mantém a concentração; falhar encerra a concentração atual.
            </p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button variant="secondary" onClick={() => setPendingCheck(null)}>
                Passar
              </Button>
              <Button variant="primary" onClick={failConcentration}>
                Falhar
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
    <div className="min-h-16 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
    </div>
  )
}

function HpMaximumButton({ value, reduced, onClick }: { value: number; reduced: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-16 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-center transition-colors hover:border-accentBorder hover:bg-accentBg"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Vida máxima</div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
      {reduced ? <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-danger">reduzida</div> : null}
    </button>
  )
}

function HpSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-1 text-xl font-bold text-textH">{value}</div>
    </div>
  )
}
