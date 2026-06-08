import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function EquipmentWeaponsSection({
  character,
  updateCharacter,
}: Props) {
  const weapons = character.get("equipment").weapons

  function unequipWeapon(index: number) {
    updateCharacter(
      character.get("id"),
      (c) => c.unequipWeapon(index),
    )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3">
        <div className="text-sm font-medium text-textH">
          Armas
        </div>

        <div className="text-xs text-text">
          {character.getUsedArms()}/{character.get("sheet").arms} braços usados
        </div>
      </div>

      {weapons.length === 0 ? (
        <div className="text-xs text-text">
          Nenhuma arma equipada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {weapons.map((weapon, index) => (
            <div
              key={`${weapon.id}-${index}`}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-textH">
                    {weapon.name || "Arma sem nome"}
                  </div>

                  <div className="mt-1 text-xs text-text">
                    Peso: {weapon.weight ?? 0}
                    {" • "}
                    {weapon.twoHanded
                      ? "Duas mãos"
                      : "Uma mão"}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => unequipWeapon(index)}
                >
                  Desequipar
                </Button>
              </div>

              {weapon.desc?.trim() ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-textH">
                    Descrição
                  </div>

                  <div className="mt-1 whitespace-pre-wrap text-xs text-text">
                    {weapon.desc}
                  </div>
                </div>
              ) : null}

              {weapon.properties.map((property) => (
                <span
                  key={property.id}
                  title={property.desc}
                  className="rounded-md border border-border px-2 py-1 text-xs text-text"
                >
                  {property.name}
                </span>
              ))}

              {"bonuses" in weapon &&
              weapon.bonuses ? (
                <div className="mt-3">
                  <div className="text-xs font-medium text-textH">
                    Bônus
                  </div>

                  <pre className="mt-1 text-xs text-text">
                    {JSON.stringify(
                      weapon.bonuses,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}