import { Blocks, Scale } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { EquipmentItemCard } from "./equipmentItemCard"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

/** Each body-part item occupies its own entry; prostheses are not limited by anatomy. */
export function EquipmentBodyPartsSection({ character, updateCharacter }: Props) {
  const parts = character.get("equipment").bodyParts ?? []
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <Blocks className="h-4 w-4 text-accent" />
            Partes Corporais
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Próteses, implantes e artefatos como o Olho de Vecna. Sem limite de espaços.
          </div>
        </div>
        <div className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-text">
          {parts.length} equipado(s) · ilimitado
        </div>
      </div>
      {parts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhuma parte corporal equipada. Crie um item com o slot “Partes Corporais” e equipe-o pelo inventário.
        </div>
      ) : (
        <div className="grid gap-3">
          {parts.map((item, index) => (
            <EquipmentItemCard
              key={item.id}
              characterId={character.get("id")}
              reference={{ type: "body-part", itemId: item.id }}
              pocketCount={character.get("equipment").pockets.length}
              item={item}
              fallbackName="Parte corporal sem nome"
              badges={["Parte corporal"]}
              stats={[
                { icon: <Blocks className="h-4 w-4" />, label: "Espaço", value: `Parte corporal ${index + 1}` },
                { icon: <Scale className="h-4 w-4" />, label: "Peso", value: String(item.weight ?? 0) },
              ]}
              onUpdate={updater => updateCharacter(character.get("id"), current => {
                const equipment = current.get("equipment")
                return current.with("equipment", {
                  ...equipment,
                  bodyParts: (equipment.bodyParts ?? []).map(entry =>
                    entry.id === item.id ? updater(entry) : entry,
                  ),
                })
              })}
            />
          ))}
        </div>
      )}
    </section>
  )
}
