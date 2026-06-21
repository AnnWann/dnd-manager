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

type EquipmentAbility = Ability & {
  source: "equipment"
  sourceItemId: string
  sourceItemName: string
  originalAbilityId: string
}

type RaceAbility = Ability & {
  source: "race"
  originalAbilityId: string
}

export function CharacterAbilitiesTab({ character, updateCharacter }: Props) {
  const raceAbilities: RaceAbility[] = (
    character.get("sheet").race.naturalAbilities ?? []
  ).map((ability) => ({
    ...ability,
    id: `race:${ability.id}`,
    source: "race",
    originalAbilityId: ability.id,
  }))

  const abilities = [
    ...(character.getCharacterAbilities() ?? []),
    ...raceAbilities,
  ]

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

      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityUsage(c, ability.originalAbilityId, 1)
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

      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityUsage(c, ability.originalAbilityId, -1)
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
                Gerencie habilidades próprias e acompanhe habilidades raciais e de equipamentos.
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCreating(true)}
            >
              + Adicionar habilidade
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {sortedAbilities.length === 0 ? (
            <p className="text-xs text-text">
              Adicione habilidades livres, raciais ou concedidas por equipamentos.
            </p>
          ) : (
            <div className="grid gap-3">
              {sortedAbilities.map((ability) => {
                const equipmentAbility = isEquipmentAbility(ability)
                const raceAbility = isRaceAbility(ability)
                const grantedAbility = equipmentAbility || raceAbility

                return (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    sourceLabel={
                      equipmentAbility
                        ? `Equipamento: ${ability.sourceItemName}`
                        : raceAbility
                          ? "Raça"
                          : undefined
                    }
                    onEdit={
                      grantedAbility
                        ? undefined
                        : () => setEditingAbility(ability)
                    }
                    onRemove={
                      grantedAbility
                        ? undefined
                        : () => removeAbility(ability.id)
                    }
                    onUse={() => useAbility(ability.id)}
                    onRestore={() => restoreAbility(ability.id)}
                  />
                )
              })}
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

function updateRaceAbilityUsage(
  character: CharacterTemplate,
  abilityId: string,
  delta: 1 | -1,
): CharacterTemplate {
  const race = character.get("sheet").race

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
      if (ability.id !== abilityId || !ability.usage) return ability
      if (ability.usage.reset === "spellSlot") return ability

      return {
        ...ability,
        usage: {
          ...ability.usage,
          used: Math.min(
            ability.usage.max,
            Math.max(0, ability.usage.used + delta),
          ),
        },
      }
    }),
  })
}

function isEquipmentAbility(ability: Ability): ability is EquipmentAbility {
  return "source" in ability && ability.source === "equipment"
}

function isRaceAbility(ability: Ability): ability is RaceAbility {
  return "source" in ability && ability.source === "race"
}
