import { Circle, Scale } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { EquipmentItemCard } from "./equipmentItemCard"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function EquipmentRingsSection({
  character,
  updateCharacter,
}: Props) {
  const rings = character.get("equipment").rings

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <Circle className="h-4 w-4 text-accent" />
            Anéis
          </div>

          <div className="mt-1 text-xs text-textMuted">
            Itens mágicos ou acessórios usados nos dedos.
          </div>
        </div>

        <div className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-text">
          {character.getUsedFingers()}/{character.getTotalFingers()} dedos
        </div>
      </div>

      {rings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhum anel equipado.
        </div>
      ) : (
        <div className="grid gap-3">
          {rings.map((ring, index) => (
            <EquipmentItemCard
              key={`${ring.id}-${index}`}
              characterId={character.get("id")}
              reference={{ type: "ring", itemId: ring.id }}
              pocketCount={character.get("equipment").pockets.length}
              item={ring}
              fallbackName="Anel sem nome"
              badges={["Anel"]}
              stats={[
                {
                  icon: <Circle className="h-4 w-4" />,
                  label: "Espaço",
                  value: "Anel",
                },
                {
                  icon: <Scale className="h-4 w-4" />,
                  label: "Peso",
                  value: String(ring.weight ?? 0),
                },
              ]}
              onUpdate={(updater) =>
                updateCharacter(character.get("id"), (current) => {
                  const equipment = current.get("equipment")
                  const nextRings = [...equipment.rings]

                  nextRings[index] = updater(nextRings[index])

                  return current.with("equipment", {
                    ...equipment,
                    rings: nextRings,
                  })
                })
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
