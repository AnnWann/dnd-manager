import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Ability } from "../../../models/abilities/Ability"
import {
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { AbilityCard } from "./abilityCard"
import { AbilityDialog } from "./abilityDialog"
import { CompactAbilityCard } from "./compactAbilityCard"

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
  | "channelDivinity"

type AbilityKindFilter = "all" | "active" | "passive" | "feature"
type AbilityListViewMode = "detailed" | "compact"

const ABILITY_LIST_VIEW_STORAGE_KEY = "dnd-manager:ability-list-view"

export function CharacterAbilitiesTab({ character, updateCharacter }: Props) {
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [creating, setCreating] = useState(false)
  const [sourceFilter, setSourceFilter] =
    useState<AbilitySourceFilter>("all")
  const [kindFilter, setKindFilter] = useState<AbilityKindFilter>("all")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<AbilityListViewMode>(
    loadAbilityListViewMode,
  )

  useEffect(() => {
    saveAbilityListViewMode(viewMode)
  }, [viewMode])

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
            case "channelDivinity":
              return ability.category === "channelDivinity"
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
        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "use",
        )
      }

      return current.useAbility(id)
    })
  }

  function deactivateAbility(id: string) {
    updateCharacter(character.get("id"), (current) => {
      const ability = abilities.find((entry) => entry.id === id)
      if (!ability) return current

      if (isEquipmentAbility(ability)) {
        return current.deactivateEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      if (isRaceAbility(ability)) {
        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "deactivate",
        )
      }

      return current.deactivateAbility(id)
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
        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "restore",
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
                evocações, talentos e Canalizar Divindade.
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

          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_190px_150px]">
            <Input
              value={search}
              placeholder="Buscar habilidade..."
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select
              value={viewMode}
              aria-label="Visualização das habilidades"
              onChange={(event) =>
                setViewMode(event.target.value as AbilityListViewMode)
              }
            >
              <option value="detailed">Completa</option>
              <option value="compact">Simplificada</option>
            </Select>

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
              <option value="channelDivinity">Canalizar Divindade</option>
            </Select>

            <Select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as AbilityKindFilter)
              }
            >
              <option value="all">Ativas, passivas e características</option>
              <option value="active">Somente ativas</option>
              <option value="passive">Somente passivas</option>
              <option value="feature">Somente características</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredAbilities.length === 0 ? (
            <p className="text-xs text-text">
              Nenhuma habilidade corresponde aos filtros selecionados.
            </p>
          ) : (
            <div className={viewMode === "compact" ? "grid gap-2" : "grid gap-3"}>
              {filteredAbilities.map((ability) => {
                const equipmentAbility = isEquipmentAbility(ability)
                const raceAbility = isRaceAbility(ability)
                const grantedAbility = equipmentAbility || raceAbility
                 const usageMax = ability.usage
                   ? getAbilityUsageMax(character, ability.usage)
                   : undefined
                 const sourceLabel = getAbilitySourceLabel(
                  ability,
                  equipmentAbility,
                  raceAbility,
                  weaponIds,
                )
                const editAbility = grantedAbility
                  ? undefined
                  : () => setEditingAbility(ability)
                const deleteAbility = grantedAbility
                  ? undefined
                  : () => removeAbility(ability.id)

                if (viewMode === "compact") {
                  return (
                    <CompactAbilityCard
                      key={ability.id}
                      ability={ability}
                      sourceLabel={sourceLabel}
                      usageMax={usageMax}
                      onEdit={editAbility}
                      onRemove={deleteAbility}
                      onUse={() => useAbility(ability.id)}
                      onDeactivate={() => deactivateAbility(ability.id)}
                      onRestore={() => restoreAbility(ability.id)}
                    />
                  )
                }

                return (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    sourceLabel={sourceLabel}
                    usageMax={usageMax}
                    onEdit={editAbility}
                    onRemove={deleteAbility}
                    onUse={() => useAbility(ability.id)}
                    onDeactivate={() => deactivateAbility(ability.id)}
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

function getAbilitySourceLabel(
  ability: Ability,
  equipmentAbility: boolean,
  raceAbility: boolean,
  weaponIds: Set<string>,
): string | undefined {
  if (equipmentAbility && isEquipmentAbility(ability)) {
    return `${weaponIds.has(ability.sourceItemId) ? "Arma" : "Equipamento"}: ${ability.sourceItemName}`
  }

  if (raceAbility) return "Raça"
  return getCategoryLabel(ability)
}

function getCategoryLabel(ability: Ability): string | undefined {
  if (ability.category === "invocation") return "Evocação"
  if (ability.category === "feat") return "Talento"
  if (ability.category === "channelDivinity") return "Canalizar Divindade"
  return undefined
}

function loadAbilityListViewMode(): AbilityListViewMode {
  if (typeof window === "undefined") return "detailed"

  try {
    return window.localStorage.getItem(ABILITY_LIST_VIEW_STORAGE_KEY) === "compact"
      ? "compact"
      : "detailed"
  } catch {
    return "detailed"
  }
}

function saveAbilityListViewMode(viewMode: AbilityListViewMode) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(ABILITY_LIST_VIEW_STORAGE_KEY, viewMode)
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function updateRaceAbilityState(
  character: CharacterTemplate,
  abilityId: string,
  action: "use" | "restore" | "deactivate",
): CharacterTemplate {
  const race = character.get("sheet").race

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
      if (ability.id !== abilityId) return ability
      if (action === "use") return activateAbilityBenefits(character, ability)
      if (action === "restore") return restoreAbilityUse(ability)
      return deactivateAbilityBenefits(ability)
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
