import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getCurrentMaxHp,
  restoreCurrentMaxHp,
  setCurrentMaxHp,
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

type HpTarget = "current" | "maximum" | "temporary"

export function CharacterHpControls({ character, updateCharacter, compact = false }: Props) {
  const [target, setTarget] = useState<HpTarget | null>(null)
  const [amountText, setAmountText] = useState("")
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const concentration = getConcentrationCondition(character)
  const characterId = character.get("id")
  const hp = character.get("sheet").HP
  const currentMax = getCurrentMaxHp(character)
  const effectiveMax = character.getEffectiveMaxHp()

  function parseAmount(value: string): number {
    return Math.max(0, Math.trunc(Number(value) || 0))
  }

  function openTarget(nextTarget: HpTarget) {
    setTarget(nextTarget)
    setAmountText("")
  }

  function closeTarget() {
    setTarget(null)
    setAmountText("")
  }

  function reduce() {
    const amount = parseAmount(amountText)
    if (!target || amount <= 0) return

    if (target === "current") {
      const concentrationBeforeDamage = getConcentrationCondition(character)
      updateCharacter(characterId, (current) => current.takeDamage(amount))
      if (concentrationBeforeDamage) {
        setPendingCheck({
          damage: amount,
          dc: Math.max(10, Math.floor(amount / 2)),
          spellName: concentrationBeforeDamage.source || undefined,
        })
      }
    } else if (target === "temporary") {
      updateCharacter(characterId, (current) =>
        current.setTemporaryHp(
          Math.max(0, current.get("sheet").HP.temporary - amount),
        ),
      )
    } else {
      updateCharacter(characterId, (current) =>
        setCurrentMaxHp(current, getCurrentMaxHp(current) - amount),
      )
    }

    closeTarget()
  }

  function increase() {
    const amount = parseAmount(amountText)
    if (!target || amount <= 0) return

    if (target === "current") {
      updateCharacter(characterId, (current) => current.heal(amount))
    } else if (target === "temporary") {
      updateCharacter(characterId, (current) =>
        current.setTemporaryHp(current.get("sheet").HP.temporary + amount),
      )
    } else {
      updateCharacter(characterId, (current) =>
        setCurrentMaxHp(current, getCurrentMaxHp(current) + amount),
      )
    }

    closeTarget()
  }

  function restoreMaximum() {
    updateCharacter(characterId, restoreCurrentMaxHp)
    closeTarget()
  }

  function failConcentration() {
    updateCharacter(characterId, endConcentration)
    setPendingCheck(null)
  }

  const amount = parseAmount(amountText)

  return (
    <>
      <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-3 md:grid-cols-3"}>
        <HpTile
          label="Vida atual"
          value={hp.current}
          onClick={() => openTarget("current")}
        />
        <HpTile
          label="Vida máxima"
          value={effectiveMax}
          reduced={currentMax < hp.max}
          onClick={() => openTarget("maximum")}
        />
        <HpTile
          label="Vida temporária"
          value={hp.temporary}
          onClick={() => openTarget("temporary")}
        />
      </div>

      {target ? (
        <Modal
          title={targetTitle(target)}
          onClose={closeTarget}
          className="max-w-md"
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                Valor atual
              </div>
              <div className="mt-1 text-2xl font-bold text-textH">
                {target === "current"
                  ? hp.current
                  : target === "temporary"
                    ? hp.temporary
                    : effectiveMax}
              </div>
              {target === "maximum" ? (
                <div className="mt-2 grid gap-1 text-xs text-textMuted">
                  <div>
                    Vida máxima atual: <strong className="text-textH">{currentMax}</strong>
                  </div>
                  <div>
                    Vida máxima real: <strong className="text-textH">{hp.max}</strong>
                  </div>
                  {effectiveMax !== currentMax ? (
                    <div>
                      Com bônus e efeitos: <strong className="text-textH">{effectiveMax}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <label className="grid gap-1 text-xs text-textMuted">
              Valor da alteração
              <Input
                autoFocus
                type="number"
                min={0}
                inputMode="numeric"
                value={amountText}
                placeholder="0"
                onChange={(event) => setAmountText(event.target.value)}
              />
            </label>

            {target === "current" ? (
              <p className="text-xs leading-5 text-textMuted">
                Reduzir aplica dano: PV temporários são consumidos primeiro e, se houver concentração, o teste é solicitado depois do dano.
              </p>
            ) : target === "maximum" ? (
              <p className="text-xs leading-5 text-textMuted">
                Alterar aqui muda apenas a vida máxima atual. A vida máxima real permanece salva para permitir restauração posterior.
              </p>
            ) : (
              <p className="text-xs leading-5 text-textMuted">
                Esta alteração afeta somente os PV temporários e não conta como dano recebido.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              {target === "maximum" && currentMax < hp.max ? (
                <Button variant="ghost" onClick={restoreMaximum}>
                  Restaurar
                </Button>
              ) : null}
              <Button variant="secondary" onClick={reduce} disabled={amount <= 0}>
                {target === "current" ? "Dano" : "Reduzir"}
              </Button>
              <Button variant="primary" onClick={increase} disabled={amount <= 0}>
                {target === "current" ? "Curar" : "Aumentar"}
              </Button>
            </div>
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

function HpTile({
  label,
  value,
  reduced = false,
  onClick,
}: {
  label: string
  value: number
  reduced?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-16 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-center transition-colors hover:border-accentBorder hover:bg-accentBg"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{value}</div>
      {reduced ? (
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-danger">
          reduzida
        </div>
      ) : null}
    </button>
  )
}

function targetTitle(target: HpTarget): string {
  if (target === "current") return "Vida atual"
  if (target === "maximum") return "Vida máxima"
  return "Vida temporária"
}
