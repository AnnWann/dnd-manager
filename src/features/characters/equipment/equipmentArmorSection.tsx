import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Armor } from "../../../models/items/equipment/Armor"
import type { Bonus } from "../../../models/items/equipment/EquipmentSlot"
import { EquipmentFeaturesList } from "./equipmentFeaturesList"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

function armorTypeLabel(type: Armor["armorType"]) {
  if (type === "light") return "Leve"
  if (type === "medium") return "Média"
  return "Pesada"
}

function bonusTypeLabel(type: Bonus["type"]) {
  if (type === "add") return "+"
  if (type === "sub") return "-"
  return "fixo"
}

function formatBonusValue(bonus: Bonus) {
  if (bonus.type === "flat") return `${bonus.value}`
  return `${bonusTypeLabel(bonus.type)}${bonus.value}`
}

export function EquipmentArmorSection({
  character,
  updateCharacter,
}: Props) {
  const armor = character.get("equipment").armor

  function unequipArmor() {
    updateCharacter(character.get("id"), (c) => c.unequipArmor())
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-textH">Armadura</div>

        {armor ? (
          <Button size="sm" variant="secondary" onClick={unequipArmor}>
            Desequipar
          </Button>
        ) : null}
      </div>

      {!armor ? (
        <p className="text-xs text-text">Nenhuma armadura equipada.</p>
      ) : (
        <div className="grid gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">
              {armor.name || "Armadura sem nome"}
            </div>

            <div className="mt-1 text-xs text-text">
              {armorTypeLabel(armor.armorType)} • Peso {armor.weight ?? 0}
            </div>
          </div>

          {armor.desc?.trim() ? (
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium text-textH">Descrição</div>
              <div className="mt-1 whitespace-pre-wrap text-xs text-text">
                {armor.desc}
              </div>
            </div>
          ) : null}

          <EquipmentBonusList bonuses={armor.bonuses} />

          <EquipmentFeaturesList
            equipment={armor}
            onUpdate={(updater) =>
              updateCharacter(character.get("id"), (c) =>
                c.with("equipment", {
                  ...c.get("equipment"),
                  armor: updater(c.get("equipment").armor!),
                }),
              )
            }
          />
        </div>
      )}
    </div>
  )
}

type EquipmentBonusListProps = {
  bonuses: Armor["bonuses"]
}

function EquipmentBonusList({ bonuses }: EquipmentBonusListProps) {
  if (!bonuses) {
    return <p className="text-xs text-text">Sem bônus.</p>
  }

  const rows: string[] = []

  const normalBonusLabels: Array<{
    key:
      | "armorClass"
      | "initiative"
      | "maxHp"
      | "temporaryHp"
      | "passivePerception"
      | "attackBonus"
      | "speed"
    label: string
  }> = [
    { key: "armorClass", label: "CA" },
    { key: "initiative", label: "Iniciativa" },
    { key: "maxHp", label: "HP Máx." },
    { key: "temporaryHp", label: "HP Temp." },
    { key: "passivePerception", label: "Percepção Passiva" },
    { key: "attackBonus", label: "Ataque" },
    { key: "speed", label: "Velocidade" },
  ]

  for (const field of normalBonusLabels) {
    const value = bonuses[field.key]

    if (!Array.isArray(value)) continue

    for (const bonus of value) {
      rows.push(`${field.label}: ${formatBonusValue(bonus)}`)
    }
  }

  for (const entry of bonuses.attribute ?? []) {
    rows.push(
      `Atributo ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  for (const entry of bonuses.attributeModifier ?? []) {
    rows.push(
      `Mod. ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  if (rows.length === 0) {
    return <p className="text-xs text-text">Sem bônus.</p>
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs font-medium text-textH">Bônus</div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row}
            className="rounded-md border border-border px-2 py-1 text-xs text-text"
          >
            {row}
          </span>
        ))}
      </div>
    </div>
  )
}