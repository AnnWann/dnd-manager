// equipmentSingleSlotSection.tsx

import { Button } from "../../../components/ui/Button"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Bonus, Equipment } from "../../../models/items/equipment/EquipmentSlot"

type SingleSlot =
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"

type Props = {
  title: string
  slot: SingleSlot
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function EquipmentSingleSlotSection({
  title,
  slot,
  character,
  updateCharacter,
}: Props) {
  const item = character.get("equipment")[slot] as Equipment | undefined

  function unequip() {
    updateCharacter(character.get("id"), (c) =>
      c.unequip(slot),
    )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 text-sm font-medium text-textH">
        {title}
      </div>

      {!item ? (
        <div className="text-xs text-text">
          Nenhum item equipado.
        </div>
      ) : (
        <div className="rounded-md border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-textH">
                {item.name}
              </div>

              {item.desc?.trim() ? (
                <div className="mt-1 text-xs text-text">
                  {item.desc}
                </div>
              ) : null}

              <div className="mt-2 text-xs text-text">
                Peso: {item.weight ?? 0}
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={unequip}
            >
              Desequipar
            </Button>
          </div>

          {item.bonuses ? (
            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-textH">
                Bônus
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(item.bonuses).map(([key, value]) => {
                  if (!value) return null

                  if (isAttributeBonus(value)) {
                    return (
                      <span
                        key={key}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        Atributo {value.Attribute.toUpperCase()}
                      </span>
                    )
                  }

                  const bonuses = Array.isArray(value) ? value : [value]

                  return bonuses.map((bonus, index) => (
                    <span
                      key={`${key}-${index}`}
                      className="rounded border border-border px-2 py-1 text-xs"
                    >
                      {formatBonusName(key)}: {formatBonusValue(bonus)}
                    </span>
                  ))
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function isAttributeBonus(
  value: unknown,
): value is { Attribute: string; Bonus: Bonus[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "Attribute" in value &&
    "Bonus" in value
  )
}