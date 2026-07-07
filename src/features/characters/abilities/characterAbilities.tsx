import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { AbilityCard } from "./abilityCard"
import { AbilityDialog } from "./abilityDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
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

type AbilitySourceFilter =
  | "all"
  | "character"
  | "race"
  | "weapon"
  | "equipment"
  | "invocation"
  | "feat"

type AbilityKindFilter = "all" | "active" | "passive"

export function CharacterAbilitiesTab({ character, updateCharacter }: Props) {
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [creating, setCreating] = useState(false)
  const [sourceFilter, setSourceFilter] =
    useState<AbilitySourceFilter>("all")
  const [kindFilter, setKindFilter] = useState<AbilityKindFilter>("all")
  const [search, setSearch] = useState("")

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

  const weaponIds = new Set(
    character.get("equipment").weapons.map((weapon) => weapon.id),
  )

  const filteredAbilities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return abilities
      .filter((ability) => {
        const equipmentAbility = isEquipmentAbility(ability)
        const raceAbility = isRaceAbility(ability)
        const isWeaponAbility =
          equipmentAbility && weaponIds.has(ability.sourceItemId)

        const matchesSource = (() => {
          switch (sourceFilter) {
            case "character":
              return !equipmentAbility && !raceAbility
            case "race":
              return raceAbility
            case "weapon":
              return isWeaponAbility
            case "equipment":
              return equipmentAbility
            case "invocation":
              return ability.category === "invocation"
            case "feat":
              return ability.category === "feat"
            default:
              return true
          }
        })()

        const matchesKind =
          kindFilter === "all" ||
          (ability.kind ?? "active") === kindFilter

        const matchesSearch =
          !normalizedSearch ||
          ability.name.toLocaleLowerCase().includes(normalizedSearch) ||
          ability.description
            ?.toLocaleLowerCase()
            .includes(normalizedSearch)

        return matchesSource && matchesKind && matchesSearch
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR"),
      )
  }, [abilities, kindFilter, search, sourceFilter, weaponIds])

  function saveAbility(ability: Ability) {
    updateCharacter(character.get("id"), (current) =>
      current.saveAbility(ability),
    )
    setCreating(false)
    setEditingAbility(null)
  }

  function removeAbility(id: string) {
    updateCharacter(character.get("id"), (current) =>
      current.removeAbility(id),
    )
  }

  function useAbility(id: string) {
    updateCharacter(character.get("id"), (current) => {
      const ability = abilities.find((entry) => entry.id === id)

      if (ability && isEquipmentAbility(ability)) {
        return current.useEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityUsage(
          current,
          ability.originalAbilityId,
          1,
        )
      }

      return current.useAbility(id)
    })
  }

  function restoreAbility(id: string) {
    updateCharacter(character.get("id"), (current) => {
      const ability = abilities.find((entry) => entry.id === id)

      if (ability && isEquipmentAbility(ability)) {
        return current.restoreEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityUsage(
          current,
          ability.originalAbilityId,
          -1,
        )
      }

      return current.restoreAbility(id)
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">
                Habilidades
              </div>
              <div className="mt-1 text-xs text-text">
                Filtre habilidades próprias, raciais, de armas, equipamentos,
                evocações e talentos.
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

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_190px_150px]">
            <Input
              value={search}
              placeholder="Buscar habilidade..."
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value as AbilitySourceFilter,
                )
              }
            >
              <option value="all">Todas as origens</option>
              <option value="character">Habilidades próprias</option>
              <option value="race">Habilidades raciais</option>
              <option value="weapon">Habilidades de armas</option>
              <option value="equipment">Todos os equipamentos</option>
              <option value="invocation">Evocações</option>
              <option value="feat">Talentos</option>
            </Select>

            <Select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as AbilityKindFilter)
              }
            >
              <option value="all">Ativas e passivas</option>
              <option value="active">Somente ativas</option>
              <option value="passive">Somente passivas</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredAbilities.length === 0 ? (
            <p className="text-xs text-text">
              Nenhuma habilidade corresponde aos filtros selecionados.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredAbilities.map((ability) => {
                const equipmentAbility = isEquipmentAbility(ability)
                const raceAbility = isRaceAbility(ability)
                const grantedAbility = equipmentAbility || raceAbility
                const categoryLabel = getCategoryLabel(ability)

                return (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    sourceLabel={
                      equipmentAbility
                        ? `${weaponIds.has(ability.sourceItemId) ? "Arma" : "Equipamento"}: ${ability.sourceItemName}`
                        : raceAbility
                          ? "Raça"
                          : categoryLabel
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
        open={creating || editingAbility !== null}
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

function getCategoryLabel(ability: Ability): string | undefined {
  if (ability.category === "invocation") return "Evocação"
  if (ability.category === "feat") return "Talento"
  return undefined
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

function isEquipmentAbility(
  ability: Ability,
): ability is EquipmentAbility {
  return "source" in ability && ability.source === "equipment"
}

function isRaceAbility(ability: Ability): ability is RaceAbility {
  return "source" in ability && ability.source === "race"
}
