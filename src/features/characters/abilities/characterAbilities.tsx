import { useState } from "react"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Ability } from "../../../models/abilities/Ability"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { AbilityCard } from "./abilityCard"
import { AbilityDialog } from "./abilityDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function CharacterAbilities({ character, updateCharacter }: Props) {
  const abilities = character.getCharacterAbilities() ?? []
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [creating, setCreating] = useState(false)

  const sortedAbilities = [...abilities].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  )

  function saveAbility(ability: Ability) {
    updateCharacter(character.get("id"), (c) =>
      c.saveAbility(ability)
    )

    setCreating(false)
    setEditingAbility(null)
  }

  function removeAbility(id: string) {
    updateCharacter(character.get("id"), (c) =>
      c.removeAbility(id)
    )
  } 

  function useAbility(id: string) {
    updateCharacter(character.get("id"), (c) => {
      const ability = abilities.find((a) => a.id === id)

      if (ability && isEquipmentAbility(ability)) {
        return c.useEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      return c.useAbility(id)
    })
  }

  function restoreAbility(id: string) {
    updateCharacter(character.get("id"), (c) => {
      const ability = abilities.find((a) => a.id === id)

      if (ability && isEquipmentAbility(ability)) {
        return c.restoreEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      return c.restoreAbility(id)
    })
  }

  const dialogOpen = creating || editingAbility !== null

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">Habilidades</div>
              <div className="mt-1 text-xs text-text">
                Gerencie habilidades e seus usos.
              </div>
            </div>

            <Button size="sm" variant="secondary" onClick={() => {console.log('clicado'); setCreating(true)}}>
              + Adicionar habilidade
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {sortedAbilities.length === 0 ? (
            <p className="text-xs text-text">Adicione habilidades livres da ficha.</p>
          ) : (
            <div className="grid gap-3">
              {sortedAbilities.map((ability) => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  onEdit={
                    isEquipmentAbility(ability)
                      ? undefined
                      : () => setEditingAbility(ability)
                  }
                  onRemove={
                    isEquipmentAbility(ability)
                      ? undefined
                      : () => removeAbility(ability.id)
                  }
                  onUse={() => useAbility(ability.id)}
                  onRestore={() => restoreAbility(ability.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      <AbilityDialog
        open={dialogOpen}
        ability={editingAbility}
        onClose={() => {
          setCreating(false)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />
    </>
  )
}

type EquipmentAbility = Ability & {
  source: "equipment"
  sourceItemId: string
  sourceItemName: string
  originalAbilityId: string
}

function isEquipmentAbility(ability: Ability): ability is EquipmentAbility {
  return "source" in ability && ability.source === "equipment"
}