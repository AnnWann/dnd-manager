import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
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

export function CharacterHpControls({ character, updateCharacter, compact = false }: Props) {
  const [damageText, setDamageText] = useState("")
  const [healingText, setHealingText] = useState("")
  const [healingTarget, setHealingTarget] = useState<"current" | "temporary">("current")
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const hp = character.get("sheet").HP
  const concentration = getConcentrationCondition(character)
  const characterId = character.get("id")

  function parseAmount(value: string): number {
    return Math.max(0, Math.trunc(Number(value) || 0))
  }

  function applyDamage() {
    const damage = parseAmount(damageText)
    if (damage <= 0) return

    const concentrationBeforeDamage = getConcentrationCondition(character)
    updateCharacter(characterId, (current) => current.takeDamage(damage))
    setDamageText("")

    if (concentrationBeforeDamage) {
      setPendingCheck({
        damage,
        dc: Math.max(10, Math.floor(damage / 2)),
        spellName: concentrationBeforeDamage.source || undefined,
      })
    }
  }

  function applyHealing() {
    const amount = parseAmount(healingText)
    if (amount <= 0) return

    updateCharacter(characterId, (current) => {
      if (healingTarget === "temporary") {
        const currentTemporary = current.get("sheet").HP.temporary
        return current.setTemporaryHp(currentTemporary + amount)
      }
      return current.heal(amount)
    })
    setHealingText("")
  }

  function failConcentration() {
    updateCharacter(characterId, endConcentration)
    setPendingCheck(null)
  }

  return (
    <>
      <div className={compact ? "grid gap-2" : "grid gap-3 lg:grid-cols-2"}>
        <div className="rounded-lg border border-border bg-bg-subtle p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Aplicar dano</div>
          <div className="mt-2 flex gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={damageText}
              placeholder="Dano"
              aria-label="Valor de dano"
              onChange={(event) => setDamageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyDamage()
              }}
            />
            <Button variant="primary" onClick={applyDamage} disabled={parseAmount(damageText) <= 0}>
              Dano
            </Button>
          </div>
          <div className="mt-2 text-[10px] leading-4 text-textMuted">
            O dano consome primeiro os PV temporários e depois os PV atuais.
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-subtle p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">Aplicar cura</div>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={healingText}
              placeholder="Cura"
              aria-label="Valor de cura"
              onChange={(event) => setHealingText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyHealing()
              }}
            />
            <Button variant="primary" onClick={applyHealing} disabled={parseAmount(healingText) <= 0}>
              Curar
            </Button>
          </div>
          <label className="mt-2 grid gap-1 text-[10px] text-textMuted">
            Aplicar em
            <select
              className="h-9 rounded-lg border border-border bg-bg px-2 text-xs text-textH"
              value={healingTarget}
              onChange={(event) => setHealingTarget(event.target.value as "current" | "temporary")}
            >
              <option value="current">PV atual</option>
              <option value="temporary">PV temporário</option>
            </select>
          </label>
        </div>
      </div>

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

      <span className="sr-only">PV atual {hp.current}, PV temporário {hp.temporary}</span>
    </>
  )
}
