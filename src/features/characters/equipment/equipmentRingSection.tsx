import { Button } from "../../../components/ui/Button"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "speed"

const NORMAL_BONUS_KEYS: NormalBonusKey[] = [
  "armorClass",
  "initiative",
  "maxHp",
  "temporaryHp",
  "passivePerception",
  "attackBonus",
  "speed",
]

export function EquipmentRingsSection({
  character,
  updateCharacter,
}: Props) {
  const rings = character.get("equipment").rings

  function unequipRing(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.unequipRing(index),
    )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3">
        <div className="text-sm font-medium text-textH">
          Anéis
        </div>

        <div className="text-xs text-text">
          {character.getUsedFingers()}/{character.getTotalFingers()} dedos usados
        </div>
      </div>

      {rings.length === 0 ? (
        <div className="text-xs text-text">
          Nenhum anel equipado.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rings.map((ring, index) => (
            <div
              key={`${ring.id}-${index}`}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-textH">
                    {ring.name || "Anel sem nome"}
                  </div>

                  {ring.desc?.trim() ? (
                    <div className="mt-1 text-xs text-text">
                      {ring.desc}
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-text">
                    Peso: {ring.weight ?? 0}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => unequipRing(index)}
                >
                  Desequipar
                </Button>
              </div>

              <EquipmentBonusList bonuses={ring.bonuses} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type EquipmentBonusListProps = {
  bonuses: Equipment["bonuses"]
}

function EquipmentBonusList({ bonuses }: EquipmentBonusListProps) {
  if (!bonuses) return null

  const rows: string[] = []

  for (const key of NORMAL_BONUS_KEYS) {
    const value = bonuses[key]
    if (!Array.isArray(value)) continue

    for (const bonus of value) {
      rows.push(`${formatBonusName(key)}: ${formatBonusValue(bonus)}`)
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

  if (rows.length === 0) return null

  return (
    <div className="mt-3">
      <div className="mb-2 text-xs font-medium text-textH">
        Bônus
      </div>

      <div className="flex flex-wrap gap-2">
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