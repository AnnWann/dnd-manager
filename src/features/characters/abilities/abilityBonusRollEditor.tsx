import { Dice5 } from "lucide-react"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"
import type {
  Bonus,
  BonusCollection,
  BonusRollDefinition,
  NormalBonusKey,
  ScopedBonusKey,
} from "../../../models/bonuses/Bonus"
import { validateBonusRollDiceExpression } from "../../../models/bonuses/BonusRoll"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { attributeShort } from "../../../lib/attributeShorts"

const DIRECT_KEYS: Array<{ key: NormalBonusKey; label: string }> = [
  { key: "armorClass", label: "Classe de Armadura" },
  { key: "initiative", label: "Iniciativa" },
  { key: "maxHp", label: "HP máximo" },
  { key: "temporaryHp", label: "HP temporário" },
  { key: "passivePerception", label: "Percepção passiva" },
  { key: "attackBonus", label: "Ataques — global" },
  { key: "savingThrowBonus", label: "Testes de resistência — global" },
  { key: "saveDcBonus", label: "CD — global" },
  { key: "damageBonus", label: "Dano — global" },
  { key: "speed", label: "Velocidade" },
]

const SCOPED_KEYS: Array<{ key: ScopedBonusKey; label: string }> = [
  { key: "weaponAttackBonus", label: "Ataques com arma" },
  { key: "spellAttackBonus", label: "Ataques mágicos" },
  { key: "savingThrowAttributeBonus", label: "Testes de resistência" },
  { key: "weaponDamageBonus", label: "Dano com arma" },
  { key: "spellDamageBonus", label: "Dano mágico" },
  { key: "spellSaveDcBonus", label: "CD de magias" },
  { key: "abilitySaveDcBonus", label: "CD de habilidades" },
]

type Entry = {
  id: string
  label: string
  bonus: Bonus
  update: (bonuses: BonusCollection, next: Bonus) => BonusCollection
}

export function AbilityBonusRollEditor({
  bonuses,
  character,
  onChange,
}: {
  bonuses: BonusCollection
  character?: CharacterTemplate
  onChange: (bonuses: BonusCollection) => void
}) {
  const entries = collectEntries(bonuses)
  if (!entries.length) return null

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-start gap-2">
        <Dice5 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <div className="text-xs font-semibold text-textH">Rolagens dos bônus</div>
          <p className="mt-0.5 text-[11px] leading-5 text-textMuted">
            Um bônus pode rolar dados quando a habilidade é usada. No modo automático o sistema rola; no manual o jogador informa somente o resultado dos dados. A fórmula opcional é somada depois.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {entries.map((entry) => {
          const roll = entry.bonus.roll
          const diceError = roll ? validateBonusRollDiceExpression(roll.dice) : undefined
          const formulaError = roll?.formula?.trim()
            ? validateCharacterSheetFormula(roll.formula, character)
            : undefined

          const patchRoll = (next: BonusRollDefinition | undefined) =>
            onChange(entry.update(bonuses, {
              ...entry.bonus,
              roll: next,
              rollResult: next ? entry.bonus.rollResult : undefined,
            }))

          return (
            <div key={entry.id} className="grid gap-2 rounded-lg border border-border bg-bg p-3">
              <div className="text-xs font-semibold text-textH">{entry.label}</div>
              <div className="grid gap-2 sm:grid-cols-[150px_120px_minmax(0,1fr)]">
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-textMuted">Rolagem</span>
                  <Select
                    value={roll?.mode ?? "none"}
                    onChange={(event) => {
                      const mode = event.target.value
                      if (mode === "none") {
                        patchRoll(undefined)
                        return
                      }
                      patchRoll({
                        mode: mode as BonusRollDefinition["mode"],
                        dice: roll?.dice || "1d6",
                        formula: roll?.formula,
                      })
                    }}
                  >
                    <option value="none">Sem rolagem</option>
                    <option value="automatic">Automática</option>
                    <option value="manual">Manual</option>
                  </Select>
                </label>

                {roll ? (
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-textMuted">Dados</span>
                    <Input
                      value={roll.dice}
                      placeholder="1d6"
                      onChange={(event) => patchRoll({ ...roll, dice: event.target.value })}
                    />
                  </label>
                ) : <div />}

                {roll ? (
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-textMuted">Bônus por fórmula</span>
                    <Input
                      value={roll.formula ?? ""}
                      placeholder="Ex.: character.proficiencyBonus"
                      onChange={(event) => patchRoll({
                        ...roll,
                        formula: event.target.value || undefined,
                      })}
                    />
                  </label>
                ) : null}
              </div>

              {roll ? (
                <div className="text-[10px] leading-4">
                  {diceError ? (
                    <span className="text-danger">{diceError}</span>
                  ) : formulaError ? (
                    <span className="text-danger">{formulaError}</span>
                  ) : (
                    <span className="text-success">
                      {roll.mode === "automatic" ? "O sistema rolará" : "O jogador informará"} {roll.dice}
                      {roll.formula?.trim() ? " e a fórmula será somada ao resultado." : "."}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function collectEntries(bonuses: BonusCollection): Entry[] {
  const result: Entry[] = []

  for (const { key, label } of DIRECT_KEYS) {
    ;(bonuses[key] ?? []).forEach((bonus, index) => {
      result.push({
        id: `${key}:${index}`,
        label,
        bonus,
        update: (current, next) => ({
          ...current,
          [key]: (current[key] ?? []).map((entry, currentIndex) =>
            currentIndex === index ? next : entry,
          ),
        }),
      })
    })
  }

  for (const { key, label } of SCOPED_KEYS) {
    ;(bonuses[key] ?? []).forEach((entry, index) => {
      result.push({
        id: `${key}:${index}`,
        label: `${label}${entry.attribute ? ` · ${attributeShort(entry.attribute)}` : ""}`,
        bonus: entry.bonus,
        update: (current, next) => ({
          ...current,
          [key]: (current[key] ?? []).map((currentEntry, currentIndex) =>
            currentIndex === index ? { ...currentEntry, bonus: next } : currentEntry,
          ),
        }),
      })
    })
  }

  ;(bonuses.attribute ?? []).forEach((entry, index) => {
    result.push({
      id: `attribute:${index}`,
      label: `Valor de atributo · ${attributeShort(entry.attribute)}`,
      bonus: entry.bonus,
      update: (current, next) => ({
        ...current,
        attribute: (current.attribute ?? []).map((currentEntry, currentIndex) =>
          currentIndex === index ? { ...currentEntry, bonus: next } : currentEntry,
        ),
      }),
    })
  })

  ;(bonuses.attributeModifier ?? []).forEach((entry, index) => {
    result.push({
      id: `attributeModifier:${index}`,
      label: `Modificador de atributo · ${attributeShort(entry.attribute)}`,
      bonus: entry.bonus,
      update: (current, next) => ({
        ...current,
        attributeModifier: (current.attributeModifier ?? []).map((currentEntry, currentIndex) =>
          currentIndex === index ? { ...currentEntry, bonus: next } : currentEntry,
        ),
      }),
    })
  })

  return result
}
