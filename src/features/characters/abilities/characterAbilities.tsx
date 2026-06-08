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
  const abilities = character.get("abilities") ?? []
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
    updateCharacter(character.get("id"), (c) =>
      c.useAbility(id)
    )
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
                  onEdit={() => setEditingAbility(ability)}
                  onRemove={() => removeAbility(ability.id)}
                  onUse={() => useAbility(ability.id)}
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