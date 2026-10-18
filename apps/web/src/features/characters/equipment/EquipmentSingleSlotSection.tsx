import { Scale, Shield } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import { EquipmentItemCard } from "./equipmentItemCard"

type SingleSlot =
  | "armor"
  | "shield"
  | "helmet"
  | "gloves"
  | "boots"
  | "cape"

type Props = {
  title: string
  slot: SingleSlot
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function EquipmentSingleSlotSection({
  title,
  slot,
  character,
  updateCharacter,
}: Props) {
  const item = character.get("equipment")[slot] as Equipment | undefined
  const reference =
    slot === "shield"
      ? ({ type: "shield" } as const)
      : ({ type: "slot", slot } as const)

  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-textH">
          <Shield className="h-4 w-4 text-accent" />
          {title}
        </div>

        <div className="mt-1 text-xs text-textMuted">
          Item atualmente equipado neste espaço.
        </div>
      </div>

      {!item ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhum item equipado.
        </div>
      ) : (
        <EquipmentItemCard
          characterId={character.get("id")}
          reference={reference}
          pocketCount={character.get("equipment").pockets.length}
          item={item}
          fallbackName="Item sem nome"
          badges={[title]}
          stats={[
            {
              icon: <Shield className="h-4 w-4" />,
              label: "Espaço",
              value: title,
            },
            {
              icon: <Scale className="h-4 w-4" />,
              label: "Peso",
              value: String(item.weight ?? 0),
            },
          ]}
          onUpdate={(updater) =>
            updateCharacter(character.get("id"), (current) => {
              const equipment = current.get("equipment")

              return current.with("equipment", {
                ...equipment,
                [slot]: updater(equipment[slot] as Equipment),
              })
            })
          }
        />
      )}
    </section>
  )
}
