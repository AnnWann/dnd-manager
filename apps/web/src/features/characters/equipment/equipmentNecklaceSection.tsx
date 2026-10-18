import { Gem, Scale } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { EquipmentItemCard } from "./equipmentItemCard"

const MAX_NECKLACES = 3

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function EquipmentNecklacesSection({
  character,
  updateCharacter,
}: Props) {
  const necklaces = character.get("equipment").necklaces ?? []

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <Gem className="h-4 w-4 text-accent" />
            Colares
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Amuletos, medalhões e outros acessórios usados no pescoço.
          </div>
        </div>

        <div className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-text">
          {necklaces.length}/{MAX_NECKLACES} espaços
        </div>
      </div>

      {necklaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhum colar equipado.
        </div>
      ) : (
        <div className="grid gap-3">
          {necklaces.map((necklace, index) => (
            <EquipmentItemCard
              key={`${necklace.id}-${index}`}
              characterId={character.get("id")}
              reference={{ type: "necklace", itemId: necklace.id }}
              pocketCount={character.get("equipment").pockets.length}
              item={necklace}
              fallbackName="Colar sem nome"
              badges={["Colar"]}
              stats={[
                {
                  icon: <Gem className="h-4 w-4" />,
                  label: "Espaço",
                  value: `Colar ${index + 1}`,
                },
                {
                  icon: <Scale className="h-4 w-4" />,
                  label: "Peso",
                  value: String(necklace.weight ?? 0),
                },
              ]}
              onUpdate={(updater) =>
                updateCharacter(character.get("id"), (current) => {
                  const equipment = current.get("equipment")
                  const nextNecklaces = [...(equipment.necklaces ?? [])]
                  const currentNecklace = nextNecklaces[index]
                  if (!currentNecklace) return current

                  nextNecklaces[index] = updater(currentNecklace)

                  return current.with("equipment", {
                    ...equipment,
                    necklaces: nextNecklaces,
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
