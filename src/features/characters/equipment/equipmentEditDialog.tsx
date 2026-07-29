import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  Bonus,
  Equipment,
} from "../../../models/items/equipment/EquipmentSlot"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { BonusTarget, NormalBonusKey, ScopedBonusKey } from "../../../models/bonuses/Bonus"
import { attributeShort } from "../../../lib/attributeShorts"

type NormalBonusTarget = NormalBonusKey

type Props<T extends Equipment> = {
  open: boolean
  equipment: T | null
  onClose: () => void
  onSave: (equipment: T) => void
}

const BONUS_TARGETS: Array<{ value: BonusTarget; label: string }> = [
  { value: "armorClass", label: "CA" },
  { value: "initiative", label: "Iniciativa" },
  { value: "maxHp", label: "HP Máx." },
  { value: "temporaryHp", label: "HP Temp." },
  { value: "passivePerception", label: "Percepção Passiva" },
  { value: "attackBonus", label: "Ataque — global" },
  { value: "weaponAttackBonus", label: "Ataque com arma" },
  { value: "spellAttackBonus", label: "Ataque mágico" },
  { value: "saveDcBonus", label: "CD — global" },
  { value: "spellSaveDcBonus", label: "CD de magia" },
  { value: "abilitySaveDcBonus", label: "CD de habilidade" },
  { value: "damageBonus", label: "Dano — global" },
  { value: "weaponDamageBonus", label: "Dano com arma" },
  { value: "spellDamageBonus", label: "Dano mágico" },
  { value: "speed", label: "Velocidade" },
  { value: "attribute", label: "Atributo" },
  { value: "attributeModifier", label: "Modificador de atributo" },
]

const SCOPED_TARGETS = new Set<BonusTarget>([
  "weaponAttackBonus",
  "spellAttackBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",
  "abilitySaveDcBonus",
])

function isScopedTarget(target: BonusTarget): target is ScopedBonusKey {
  return SCOPED_TARGETS.has(target)
}

const ATTRIBUTES: Array<{ key: Attribute; label: string }> = [
  { key: "str", label: "FOR" },
  { key: "dex", label: "DES" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "SAB" },
  { key: "cha", label: "CAR" },
]

function asBonusArray(value: Bonus[] | undefined): Bonus[] {
  return value ?? []
}

function bonusTypeLabel(type: Bonus["type"]) {
  if (type === "add") return "+"
  if (type === "sub") return "-"
  return "fixo"
}

export function EquipmentEditDialog<T extends Equipment>({
  open,
  equipment,
  onClose,
  onSave,
}: Props<T>) {
  const [draft, setDraft] = useState<T | null>(equipment)
  const [bonusTarget, setBonusTarget] = useState<BonusTarget>("armorClass")
  const [bonusType, setBonusType] = useState<Bonus["type"]>("add")
  const [bonusValue, setBonusValue] = useState(0)
  const [bonusAttribute, setBonusAttribute] = useState<Attribute>("str")
  const [bonusScopeAttribute, setBonusScopeAttribute] = useState<"all" | Attribute>("all")

  useEffect(() => {
    if (open) setDraft(equipment)
  }, [open, equipment])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || !draft) return null
  const currentDraft = draft

  function updateDraft(patch: Partial<Equipment>) {
    setDraft((current) => {
      if (!current) return current

      return {
        ...current,
        ...patch,
      } as T
    })
  }

  function addBonus() {
    const nextBonus: Bonus = {
      type: bonusType,
      value: bonusValue,
    }

    if (bonusTarget === "attribute") {
      updateDraft({
        bonuses: {
          ...(currentDraft.bonuses ?? {}),
          attribute: [
            ...(currentDraft.bonuses?.attribute ?? []),
            {
              attribute: bonusAttribute,
              bonus: nextBonus,
            },
          ],
        },
      })

      return
    }

    if (bonusTarget === "attributeModifier") {
      updateDraft({
        bonuses: {
          ...(currentDraft.bonuses ?? {}),
          attributeModifier: [
            ...(currentDraft.bonuses?.attributeModifier ?? []),
            {
              attribute: bonusAttribute,
              bonus: nextBonus,
            },
          ],
        },
      })

      return
    }

    if (isScopedTarget(bonusTarget)) {
      updateDraft({
        bonuses: {
          ...(currentDraft.bonuses ?? {}),
          [bonusTarget]: [
            ...(currentDraft.bonuses?.[bonusTarget] ?? []),
            {
              attribute: bonusScopeAttribute === "all" ? undefined : bonusScopeAttribute,
              bonus: nextBonus,
            },
          ],
        },
      })
      return
    }

    const bonusKey = bonusTarget as NormalBonusTarget

    updateDraft({
      bonuses: {
        ...(currentDraft.bonuses ?? {}),
        [bonusKey]: [
          ...asBonusArray(currentDraft.bonuses?.[bonusKey]),
          nextBonus,
        ],
      },
    })
  }

  function removeBonus(target: BonusTarget, index: number) {
    if (!currentDraft.bonuses) return

    const nextBonuses = { ...currentDraft.bonuses }

    if (target === "attribute") {
      const next = (currentDraft.bonuses.attribute ?? []).filter(
        (_, i) => i !== index,
      )

      if (next.length) nextBonuses.attribute = next
      else delete nextBonuses.attribute

      updateDraft({ bonuses: nextBonuses })
      return
    }

    if (target === "attributeModifier") {
      const next = (currentDraft.bonuses.attributeModifier ?? []).filter(
        (_, i) => i !== index,
      )

      if (next.length) nextBonuses.attributeModifier = next
      else delete nextBonuses.attributeModifier

      updateDraft({ bonuses: nextBonuses })
      return
    }

    if (isScopedTarget(target)) {
      const next = (currentDraft.bonuses[target] ?? []).filter(
        (_, i) => i !== index,
      )
      if (next.length) nextBonuses[target] = next
      else delete nextBonuses[target]
      updateDraft({ bonuses: nextBonuses })
      return
    }

    const bonusKey = target as NormalBonusTarget
    const next = asBonusArray(currentDraft.bonuses[bonusKey]).filter(
      (_, i) => i !== index,
    )

    if (next.length) nextBonuses[bonusKey] = next
    else delete nextBonuses[bonusKey]

    updateDraft({ bonuses: nextBonuses })
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/40 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar equipamento"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border p-4 shadow-xl sm:max-h-[calc(100dvh-2rem)]"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-textH">
              Editar equipamento
            </h2>

            <p className="mt-1 text-xs text-text">
              Configure dados básicos e bônus concedidos pelo item.
            </p>
          </div>

          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-text"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-text">Nome</label>

            <Input
              className="mt-1"
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-text">Peso</label>

            <Input
              type="number"
              className="mt-1"
              value={draft.weight ?? 0}
              onChange={(e) =>
                updateDraft({ weight: Number(e.target.value) || 0 })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-text">Descrição</label>

            <Input
              className="mt-1"
              value={draft.desc ?? ""}
              onChange={(e) => updateDraft({ desc: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 rounded-md border border-border p-3">
          <div className="text-sm font-medium text-textH">Bônus</div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_100px_100px_auto]">
            <Select
              value={bonusTarget}
              onChange={(e) => setBonusTarget(e.target.value as BonusTarget)}
            >
              {BONUS_TARGETS.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </Select>

            <Select
              value={bonusType}
              onChange={(e) => setBonusType(e.target.value as Bonus["type"])}
            >
              <option value="add">+</option>
              <option value="sub">-</option>
              <option value="flat">Fixo</option>
            </Select>

            <Input
              type="number"
              value={bonusValue}
              onChange={(e) => setBonusValue(Number(e.target.value) || 0)}
            />

            <Button size="sm" variant="secondary" onClick={addBonus}>
              + Adicionar
            </Button>
          </div>

          {bonusTarget === "attribute" ||
          bonusTarget === "attributeModifier" ? (
            <div className="mt-3">
              <label className="text-xs text-text">Atributo</label>

              <Select
                className="mt-1"
                value={bonusAttribute}
                onChange={(e) =>
                  setBonusAttribute(e.target.value as Attribute)
                }
              >
                {ATTRIBUTES.map((attribute) => (
                  <option key={attribute.key} value={attribute.key}>
                    {attribute.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {isScopedTarget(bonusTarget) ? (
            <div className="mt-3">
              <label className="text-xs text-text">Limitar ao atributo</label>
              <Select
                className="mt-1"
                value={bonusScopeAttribute}
                onChange={(e) =>
                  setBonusScopeAttribute(e.target.value as "all" | Attribute)
                }
              >
                <option value="all">Todos os atributos</option>
                {ATTRIBUTES.map((attribute) => (
                  <option key={attribute.key} value={attribute.key}>
                    {attribute.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {BONUS_TARGETS.flatMap((target) => {
              if (!draft.bonuses) return []

              if (target.value === "attribute") {
                return (draft.bonuses.attribute ?? []).map((entry, index) => (
                  <div
                    key={`attribute-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"
                  >
                    <span>
                      Atributo {attributeShort(entry.attribute)}{" "}
                      {bonusTypeLabel(entry.bonus.type)} {entry.bonus.value}
                    </span>

                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1"
                      onClick={() => removeBonus("attribute", index)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              }

              if (target.value === "attributeModifier") {
                return (draft.bonuses.attributeModifier ?? []).map(
                  (entry, index) => (
                    <div
                      key={`attributeModifier-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"
                    >
                      <span>
                        Mod. {attributeShort(entry.attribute)}{" "}
                        {bonusTypeLabel(entry.bonus.type)} {entry.bonus.value}
                      </span>

                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1"
                        onClick={() =>
                          removeBonus("attributeModifier", index)
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ),
                )
              }

              if (isScopedTarget(target.value)) {
                return (draft.bonuses[target.value] ?? []).map((entry, index) => (
                  <div
                    key={`${target.value}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"
                  >
                    <span>
                      {target.label}{entry.attribute ? ` ${attributeShort(entry.attribute)}` : " — todos"}{" "}
                      {bonusTypeLabel(entry.bonus.type)} {entry.bonus.value}
                    </span>
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1"
                      onClick={() => removeBonus(target.value, index)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              }

              const bonusKey = target.value as NormalBonusTarget
              const bonuses = asBonusArray(draft.bonuses[bonusKey])

              return bonuses.map((bonus, index) => (
                <div
                  key={`${bonusKey}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"
                >
                  <span>
                    {target.label} {bonusTypeLabel(bonus.type)} {bonus.value}
                  </span>

                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1"
                    onClick={() => removeBonus(bonusKey, index)}
                  >
                    ✕
                  </button>
                </div>
              ))
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" variant="primary" onClick={() => onSave(draft)}>
            Salvar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}