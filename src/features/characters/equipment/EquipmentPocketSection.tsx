import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function EquipmentPocketsSection({
  character,
  updateCharacter,
}: Props) {
  const pockets = character.get("equipment").pockets

  function unequipPocketItem(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.unequipPocketItem(index),
    )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3">
        <div className="text-sm font-medium text-textH">
          Bolsos
        </div>

        <div className="text-xs text-text">
          {pockets.length}/8 bolsos usados
        </div>
      </div>

      {pockets.length === 0 ? (
        <div className="text-xs text-text">
          Nenhum item nos bolsos.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pockets.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-textH">
                    {item.name || "Item sem nome"}
                  </div>

                  <div className="mt-1 text-xs text-text">
                    Qtd: {item.quantity ?? 1} • Peso: {item.weight ?? 0}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => unequipPocketItem(index)}
                >
                  Tirar do bolso
                </Button>
              </div>

              {item.desc?.trim() ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-textH">
                    Descrição
                  </div>

                  <div className="mt-1 whitespace-pre-wrap text-xs text-text">
                    {item.desc}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}