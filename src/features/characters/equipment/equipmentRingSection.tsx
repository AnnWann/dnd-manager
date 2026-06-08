import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

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

  function removeRing(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.removeRing(index),
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
                    {ring.name}
                  </div>

                  {ring.desc ? (
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
                  onClick={() => removeRing(index)}
                >
                  Desequipar
                </Button>
              </div>

              {ring.bonuses ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(ring.bonuses).map(([key, value]) => {
                    if (!value) return null

                    return (
                      <span
                        key={key}
                        className="rounded-md border border-border px-2 py-1 text-xs text-text"
                      >
                        {key}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}