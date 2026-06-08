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

type BonusTarget =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "speed"
  | "attribute"

type NormalBonusTarget = Exclude<BonusTarget, "attribute">

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
  { value: "attackBonus", label: "Ataque" },
  { value: "speed", label: "Velocidade" },
  { value: "attribute", label: "Atributo" },
]

const ATTRIBUTES: Array<{ key: Attribute; label: string }> = [
  { key: "str", label: "FOR" },
  { key: "dex", label: "DES" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "SAB" },
  { key: "cha", label: "CAR" },
]

function asBonusArray(value: Bonus[] | Bonus | undefined): Bonus[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
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
    if (bonusTarget === "attribute") {
      updateDraft({
        bonuses: {
          ...(draft?.bonuses ?? {}),
          attribute: {
            Attribute: bonusAttribute,
            Bonus: [
              ...(draft?.bonuses?.attribute?.Bonus ?? []),
              { type: bonusType, value: bonusValue },
            ],
          },
        },
      })

      return
    }

    const bonusKey = bonusTarget as NormalBonusTarget

    updateDraft({
      bonuses: {
        ...(draft?.bonuses ?? {}),
        [bonusKey]: [
          ...asBonusArray(draft?.bonuses?.[bonusKey]),
          { type: bonusType, value: bonusValue },
        ],
      },
    })
  }

  function removeBonus(target: BonusTarget, index: number) {
    if (!draft?.bonuses) return

    if (target === "attribute") {
      const current = draft?.bonuses.attribute
      if (!current) return

      const next = current.Bonus.filter((_, i) => i !== index)
      const nextBonuses = { ...draft?.bonuses }

      if (next.length) {
        nextBonuses.attribute = {
          ...current,
          Bonus: next,
        }
      } else {
        delete nextBonuses.attribute
      }

      updateDraft({ bonuses: nextBonuses })
      return
    }

    const bonusKey = target as NormalBonusTarget
    const current = asBonusArray(draft?.bonuses[bonusKey])
    const next = current.filter((_, i) => i !== index)
    const nextBonuses = { ...draft?.bonuses }

    if (next.length) {
      nextBonuses[bonusKey] = next
    } else {
      delete nextBonuses[bonusKey]
    }

    updateDraft({ bonuses: nextBonuses })
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div
        className="w-full max-w-2xl rounded-lg border border-border p-4 shadow-xl"
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

          {bonusTarget === "attribute" ? (
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

          <div className="mt-4 grid gap-2">
            {BONUS_TARGETS.flatMap((target) => {
              if (!draft.bonuses) return []

              if (target.value === "attribute") {
                const attributeBonus = draft.bonuses.attribute
                if (!attributeBonus) return []

                return attributeBonus.Bonus.map((bonus, index) => (
                  <div
                    key={`attribute-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"
                  >
                    <span>
                      Atributo {attributeBonus.Attribute.toUpperCase()}{" "}
                      {bonusTypeLabel(bonus.type)} {bonus.value}
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