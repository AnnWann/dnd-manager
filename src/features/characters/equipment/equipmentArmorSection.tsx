import { Scale, Shield } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Armor } from "../../../models/items/equipment/Armor"
import { EquipmentItemCard } from "./equipmentItemCard"

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

export function EquipmentArmorSection({
  character,
  updateCharacter,
}: Props) {
  const armor = character.get("equipment").armor

  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-textH">
          <Shield className="h-4 w-4 text-accent" />
          Armadura
        </div>

        <div className="mt-1 text-xs text-textMuted">
          Proteção principal equipada pelo personagem.
        </div>
      </div>

      {!armor ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhuma armadura equipada.
        </div>
      ) : (
        <EquipmentItemCard
          item={armor}
          fallbackName="Armadura sem nome"
          badges={[armorTypeLabel(armor.armorType)]}
          stats={[
            {
              icon: <Shield className="h-4 w-4" />,
              label: "Tipo",
              value: armorTypeLabel(armor.armorType),
            },
            {
              icon: <Scale className="h-4 w-4" />,
              label: "Peso",
              value: String(armor.weight ?? 0),
            },
          ]}
          onUnequip={() =>
            updateCharacter(character.get("id"), (current) =>
              current.unequipArmor(),
            )
          }
          onUpdate={(updater) =>
            updateCharacter(character.get("id"), (current) =>
              current.with("equipment", {
                ...current.get("equipment"),
                armor: updater(current.get("equipment").armor!),
              }),
            )
          }
        />
      )}
    </section>
  )
}
