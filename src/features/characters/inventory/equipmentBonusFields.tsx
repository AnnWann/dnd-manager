import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Bonus, Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../../models/items/item"
import type { Attribute } from "../../../models/sheet/Attribute"

type EquipmentBonuses = NonNullable<Equipment["bonuses"]>

type BonusArrayKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "damageBonus"
  | "speed"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

const BONUS_FIELDS: Array<{ key: BonusArrayKey; label: string }> = [
  { key: "armorClass", label: "CA" },
  { key: "initiative", label: "Iniciativa" },
  { key: "maxHp", label: "HP Máx." },
  { key: "temporaryHp", label: "HP Temp." },
  { key: "passivePerception", label: "Percepção Passiva" },
  { key: "attackBonus", label: "Ataque" },
  { key: "damageBonus", label: "Dano" },
  { key: "speed", label: "Velocidade" },
]

function newBonus(): Bonus {
  return {
    type: "add",
    value: 1,
  }
}

export function EquipmentBonusesFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment
  const bonuses = equipment.bonuses ?? {}

  function patchBonuses(updater: (bonuses: EquipmentBonuses) => EquipmentBonuses) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment

      return {
        ...currentEquipment,
        bonuses: updater(currentEquipment.bonuses ?? {}),
      }
    })
  }

  return (
    <div className="grid gap-3 md:col-span-3">
      <div className="text-xs font-medium text-textH">Modificadores</div>

      <div className="grid gap-3">
        {BONUS_FIELDS.map(({ key, label }) => (
          <BonusArrayEditor
            key={key}
            label={label}
            bonuses={bonuses[key] ?? []}
            onAdd={() =>
              patchBonuses((current) => ({
                ...current,
                [key]: [...(current[key] ?? []), newBonus()],
              }))
            }
            onUpdate={(index, bonus) =>
              patchBonuses((current) => ({
                ...current,
                [key]: (current[key] ?? []).map((entry, currentIndex) =>
                  currentIndex === index ? bonus : entry,
                ),
              }))
            }
            onRemove={(index) =>
              patchBonuses((current) => ({
                ...current,
                [key]: (current[key] ?? []).filter(
                  (_, currentIndex) => currentIndex !== index,
                ),
              }))
            }
          />
        ))}

        <AttributeBonusEditor
          title="Bônus de atributo"
          entries={bonuses.attribute ?? []}
          onAdd={() =>
            patchBonuses((current) => ({
              ...current,
              attribute: [
                ...(current.attribute ?? []),
                { attribute: "str", bonus: newBonus() },
              ],
            }))
          }
          onUpdate={(index, entry) =>
            patchBonuses((current) => ({
              ...current,
              attribute: (current.attribute ?? []).map(
                (currentEntry, currentIndex) =>
                  currentIndex === index ? entry : currentEntry,
              ),
            }))
          }
          onRemove={(index) =>
            patchBonuses((current) => ({
              ...current,
              attribute: (current.attribute ?? []).filter(
                (_, currentIndex) => currentIndex !== index,
              ),
            }))
          }
        />

        <AttributeBonusEditor
          title="Bônus de modificador"
          entries={bonuses.attributeModifier ?? []}
          onAdd={() =>
            patchBonuses((current) => ({
              ...current,
              attributeModifier: [
                ...(current.attributeModifier ?? []),
                { attribute: "str", bonus: newBonus() },
              ],
            }))
          }
          onUpdate={(index, entry) =>
            patchBonuses((current) => ({
              ...current,
              attributeModifier: (current.attributeModifier ?? []).map(
                (currentEntry, currentIndex) =>
                  currentIndex === index ? entry : currentEntry,
              ),
            }))
          }
          onRemove={(index) =>
            patchBonuses((current) => ({
              ...current,
              attributeModifier: (current.attributeModifier ?? []).filter(
                (_, currentIndex) => currentIndex !== index,
              ),
            }))
          }
        />
      </div>
    </div>
  )
}

function BonusArrayEditor({
  label,
  bonuses,
  onAdd,
  onUpdate,
  onRemove,
}: {
  label: string
  bonuses: Bonus[]
  onAdd: () => void
  onUpdate: (index: number, bonus: Bonus) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-textH">{label}</div>

        <Button size="sm" variant="secondary" onClick={onAdd}>
          + Bônus
        </Button>
      </div>

      <div className="grid gap-2">
        {bonuses.map((bonus, index) => (
          <BonusRow
            key={index}
            bonus={bonus}
            onChange={(next) => onUpdate(index, next)}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
    </div>
  )
}

function AttributeBonusEditor({
  title,
  entries,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  entries: { attribute: Attribute; bonus: Bonus }[]
  onAdd: () => void
  onUpdate: (
    index: number,
    entry: { attribute: Attribute; bonus: Bonus },
  ) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-textH">{title}</div>

        <Button size="sm" variant="secondary" onClick={onAdd}>
          + Bônus
        </Button>
      </div>

      <div className="grid gap-2">
        {entries.map((entry, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
            <Select
              value={entry.attribute}
              onChange={(e) =>
                onUpdate(index, {
                  ...entry,
                  attribute: e.target.value as Attribute,
                })
              }
            >
              {ATTRIBUTES.map((attribute) => (
                <option key={attribute.value} value={attribute.value}>
                  {attribute.label}
                </option>
              ))}
            </Select>

            <BonusRow
              bonus={entry.bonus}
              onChange={(bonus) => onUpdate(index, { ...entry, bonus })}
              onRemove={() => onRemove(index)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function BonusRow({
  bonus,
  onChange,
  onRemove,
}: {
  bonus: Bonus
  onChange: (bonus: Bonus) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
      <Select
        value={bonus.type}
        onChange={(e) =>
          onChange({
            ...bonus,
            type: e.target.value as Bonus["type"],
          })
        }
      >
        <option value="add">Somar</option>
        <option value="sub">Subtrair</option>
        <option value="flat">Fixo</option>
      </Select>

      <Input
        type="number"
        value={bonus.value}
        onChange={(e) =>
          onChange({
            ...bonus,
            value: Number(e.target.value) || 0,
          })
        }
      />

      <Button size="sm" variant="secondary" onClick={onRemove}>
        Remover
      </Button>
    </div>
  )
}