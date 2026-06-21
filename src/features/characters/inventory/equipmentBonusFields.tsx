import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  Bonus,
  Equipment,
} from "../../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../../models/items/item"
import type { Attribute } from "../../../models/sheet/Attribute"

type EquipmentBonuses = NonNullable<Equipment["bonuses"]>

type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "damageBonus"
  | "speed"

type BonusTarget =
  | NormalBonusKey
  | "attribute"
  | "attributeModifier"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

const TARGET_OPTIONS: Array<{ value: BonusTarget; label: string }> = [
  { value: "armorClass", label: "Classe de Armadura" },
  { value: "initiative", label: "Iniciativa" },
  { value: "maxHp", label: "HP máximo" },
  { value: "temporaryHp", label: "HP temporário" },
  { value: "passivePerception", label: "Percepção passiva" },
  { value: "attackBonus", label: "Ataques" },
  { value: "damageBonus", label: "Dano" },
  { value: "speed", label: "Velocidade" },
  { value: "attribute", label: "Valor de atributo" },
  { value: "attributeModifier", label: "Modificador de atributo" },
]

export function EquipmentBonusesFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment
  const bonuses = equipment.bonuses ?? {}
  const [dialogOpen, setDialogOpen] = useState(false)

  function patchBonuses(
    updater: (bonuses: EquipmentBonuses) => EquipmentBonuses,
  ) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment

      return {
        ...currentEquipment,
        bonuses: updater(currentEquipment.bonuses ?? {}),
      }
    })
  }

  const entries = flattenBonuses(bonuses)

  return (
    <div className="grid gap-3 md:col-span-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-textH">Modificadores</div>
          <div className="mt-0.5 text-[11px] text-textMuted">
            Bônus aplicados enquanto o item estiver equipado.
          </div>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Adicionar bônus
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-4 text-center text-xs text-textMuted">
          Nenhum bônus configurado.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-full border border-border bg-bg-subtle py-1 pl-3 pr-1 text-xs text-textH"
            >
              <span>{entry.label}</span>
              <button
                type="button"
                aria-label={`Remover ${entry.label}`}
                onClick={() => patchBonuses(entry.remove)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-textMuted hover:bg-dangerBg hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddBonusDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={({ target, attribute, bonus }) => {
          patchBonuses((current) => {
            if (target === "attribute" || target === "attributeModifier") {
              return {
                ...current,
                [target]: [
                  ...(current[target] ?? []),
                  {
                    attribute,
                    bonus,
                  },
                ],
              }
            }

            return {
              ...current,
              [target]: [...(current[target] ?? []), bonus],
            }
          })
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

type FlatBonusEntry = {
  id: string
  label: string
  remove: (bonuses: EquipmentBonuses) => EquipmentBonuses
}

function flattenBonuses(bonuses: EquipmentBonuses): FlatBonusEntry[] {
  const entries: FlatBonusEntry[] = []

  for (const option of TARGET_OPTIONS) {
    if (option.value === "attribute" || option.value === "attributeModifier") {
      const values = bonuses[option.value] ?? []

      values.forEach((entry, index) => {
        entries.push({
          id: `${option.value}-${index}`,
          label: `${option.label} ${entry.attribute.toUpperCase()}: ${formatBonus(entry.bonus)}`,
          remove: (current) => ({
            ...current,
            [option.value]: (current[option.value] ?? []).filter(
              (_, currentIndex) => currentIndex !== index,
            ),
          }),
        })
      })
      continue
    }

    const values = bonuses[option.value] ?? []
    values.forEach((bonus, index) => {
      entries.push({
        id: `${option.value}-${index}`,
        label: `${option.label}: ${formatBonus(bonus)}`,
        remove: (current) => ({
          ...current,
          [option.value]: (current[option.value] ?? []).filter(
            (_, currentIndex) => currentIndex !== index,
          ),
        }),
      })
    })
  }

  return entries
}

function formatBonus(bonus: Bonus): string {
  if (bonus.type === "flat") return `fixo ${bonus.value}`
  if (bonus.type === "sub") return `-${Math.abs(bonus.value)}`
  return `+${bonus.value}`
}

function AddBonusDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (entry: {
    target: BonusTarget
    attribute: Attribute
    bonus: Bonus
  }) => void
}) {
  const [target, setTarget] = useState<BonusTarget>("armorClass")
  const [attribute, setAttribute] = useState<Attribute>("str")
  const [type, setType] = useState<Bonus["type"]>("add")
  const [value, setValue] = useState(1)

  if (!open) return null

  const needsAttribute =
    target === "attribute" || target === "attributeModifier"

  function close() {
    setTarget("armorClass")
    setAttribute("str")
    setType("add")
    setValue(1)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">
              Adicionar bônus
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Escolha o valor afetado e como o modificador será aplicado.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 py-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Afeta</span>
            <Select
              value={target}
              onChange={(event) =>
                setTarget(event.target.value as BonusTarget)
              }
            >
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          {needsAttribute ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">
                Atributo
              </span>
              <Select
                value={attribute}
                onChange={(event) =>
                  setAttribute(event.target.value as Attribute)
                }
              >
                {ATTRIBUTES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">
                Operação
              </span>
              <Select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as Bonus["type"])
                }
              >
                <option value="add">Somar</option>
                <option value="sub">Subtrair</option>
                <option value="flat">Definir valor fixo</option>
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Valor</span>
              <Input
                type="number"
                value={value}
                onChange={(event) =>
                  setValue(Number(event.target.value) || 0)
                }
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onAdd({
                target,
                attribute,
                bonus: {
                  type,
                  value: Math.abs(value),
                },
              })
            }
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}
