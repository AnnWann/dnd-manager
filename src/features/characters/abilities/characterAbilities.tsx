import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { Select } from "../../../components/ui/Select"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import type { SessionAbilitySource } from "../../session-runtime/abilitySessionProtocol"
import type { Ability } from "../../../models/abilities/Ability"
import {
  endAbilityEffect,
  useAbilityEffect,
  getAbilityUsageMax,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"
import { useAbility as useCharacterAbility } from "../../../models/characters/characterAbilities"
import { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
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

type ConditionAbility = Ability & {
  source: "condition"
  sourceConditionId: string
  sourceConditionName: string
  originalAbilityId: string
}

type AbilitySourceFilter =
  | "all"
  | "character"
  | "asi"
  | "race"
  | "condition"
  | "weapon"
  | "equipment"
  | "invocation"
  | "feat"
  | "channelDivinity"
  | "martialArts"

type AbilityKindFilter = "all" | "active" | "passive" | "feature"
type AbilityListViewMode = "detailed" | "compact"

const ABILITY_LIST_VIEW_STORAGE_KEY = "dnd-manager:ability-list-view"

export function CharacterAbilitiesTab({ character, updateCharacter }: Props) {
  const sessionRuntime = useOptionalSessionRuntime()
  const authoritative = sessionRuntime?.abilitiesByCharacterId[character.get("id")]
  const displayCharacter = useMemo(() => {
    if (!authoritative?.initialized) return character
    try {
      return CharacterTemplate.fromJSON(authoritative.character)
    } catch {
      return character
    }
  }, [authoritative, character])

  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [creating, setCreating] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<AbilitySourceFilter>("all")
  const [kindFilter, setKindFilter] = useState<AbilityKindFilter>("all")
  const [search, setSearch] = useState("")
  const [activationChoice, setActivationChoice] = useState<Ability | null>(null)
  const [viewMode, setViewMode] = useState<AbilityListViewMode>(loadAbilityListViewMode)

  useEffect(() => {
    saveAbilityListViewMode(viewMode)
  }, [viewMode])

  const raceAbilities: RaceAbility[] = (
    displayCharacter.get("sheet").race.naturalAbilities ?? []
  ).map((ability) => ({
    ...ability,
    id: `race:${ability.id}`,
    source: "race",
    originalAbilityId: ability.id,
  }))

  const abilities = [
    ...(displayCharacter.getCharacterAbilities() ?? []),
    ...raceAbilities,
  ]

  const weaponIds = new Set(
    displayCharacter.get("equipment").weapons.map((weapon) => weapon.id),
  )

  const filteredAbilities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return abilities
      .filter((ability) => {
        const equipmentAbility = isEquipmentAbility(ability)
        const raceAbility = isRaceAbility(ability)
        const conditionAbility = isConditionAbility(ability)
        const isWeaponAbility = equipmentAbility && weaponIds.has(ability.sourceItemId)

        const matchesSource = (() => {
          switch (sourceFilter) {
            case "character": return !equipmentAbility && !raceAbility && !conditionAbility
            case "asi": return ability.category === "asi" || ability.source === "asi"
            case "race": return raceAbility
            case "condition": return conditionAbility
            case "weapon": return isWeaponAbility
            case "equipment": return equipmentAbility
            case "invocation": return ability.category === "invocation"
            case "feat": return ability.category === "feat"
            case "channelDivinity": return ability.category === "channelDivinity"
            case "martialArts": return ability.category === "martialArts"
            default: return true
          }
        })()

        const matchesKind = kindFilter === "all" || (ability.kind ?? "active") === kindFilter
        const matchesSearch =
          !normalizedSearch ||
          ability.name.toLocaleLowerCase().includes(normalizedSearch) ||
          ability.description?.toLocaleLowerCase().includes(normalizedSearch)

        return matchesSource && matchesKind && matchesSearch
      })
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
  }, [abilities, kindFilter, search, sourceFilter, weaponIds])

  function dispatchSessionAbility(
    operation: Parameters<NonNullable<typeof sessionRuntime>["dispatchAbilityOperation"]>[0],
  ): boolean {
    if (!sessionRuntime) return false
    if (sessionRuntime.status !== "connected") {
      console.warn("[session-runtime] Ability change ignored while the authoritative session server is disconnected.")
      return true
    }
    sessionRuntime.dispatchAbilityOperation(operation)
    return true
  }

  function saveAbility(ability: Ability) {
    if (!dispatchSessionAbility({
      type: "character.ability.save",
      characterId: displayCharacter.get("id"),
      ability,
    })) {
      updateCharacter(displayCharacter.get("id"), (current) => current.saveAbility(ability))
    }
    setCreating(false)
    setEditingAbility(null)
  }

  function removeAbility(id: string) {
    if (dispatchSessionAbility({
      type: "character.ability.remove",
      characterId: displayCharacter.get("id"),
      abilityId: id,
    })) return

    updateCharacter(displayCharacter.get("id"), (current) => current.removeAbility(id))
  }

  function requestUseAbility(ability: Ability) {
    if ((ability.activationOptions?.length ?? 0) > 0) {
      setActivationChoice(ability)
      return
    }
    useAbility(ability.id)
  }

  function useAbility(id: string, optionId?: string) {
    const ability = abilities.find((entry) => entry.id === id)
    if (ability) {
      const source = toSessionAbilitySource(ability)
      if (dispatchSessionAbility({
        type: "character.ability.use",
        characterId: displayCharacter.get("id"),
        source,
        activationOptionId: optionId,
      })) {
        setActivationChoice(null)
        return
      }
    }

    updateCharacter(displayCharacter.get("id"), (current) => {
      if (ability && isEquipmentAbility(ability)) {
        return current.useEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)
      }

      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "use",
          optionId,
        )
      }

      return useCharacterAbility(current, id, optionId)
    })
    setActivationChoice(null)
  }

  function deactivateAbility(id: string) {
    const ability = abilities.find((entry) => entry.id === id)
    if (ability && dispatchSessionAbility({
      type: "character.ability.deactivate",
      characterId: displayCharacter.get("id"),
      source: toSessionAbilitySource(ability),
    })) return

    updateCharacter(displayCharacter.get("id"), (current) => {
      if (!ability) return current

      if (isEquipmentAbility(ability)) {
        return current.deactivateEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)
      }
      if (isRaceAbility(ability)) {
        return updateRaceAbilityState(current, ability.originalAbilityId, "deactivate")
      }
      return current.deactivateAbility(id)
    })
  }

  function restoreAbility(id: string) {
    const ability = abilities.find((entry) => entry.id === id)
    if (ability && dispatchSessionAbility({
      type: "character.ability.restore",
      characterId: displayCharacter.get("id"),
      source: toSessionAbilitySource(ability),
    })) return

    updateCharacter(displayCharacter.get("id"), (current) => {
      if (ability && isEquipmentAbility(ability)) {
        return current.restoreEquipmentAbility(ability.sourceItemId, ability.originalAbilityId)
      }
      if (ability && isRaceAbility(ability)) {
        return updateRaceAbilityState(current, ability.originalAbilityId, "restore")
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
              <div className="text-sm font-semibold text-textH">Habilidades</div>
              <div className="mt-1 text-xs text-text">
                Filtre habilidades próprias, ASIs, temporárias, raciais, de armas, equipamentos, evocações, talentos, Canalizar Divindade e habilidades marciais.
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
              + Adicionar habilidade
            </Button>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_190px_150px]">
            <Input value={search} placeholder="Buscar habilidade..." onChange={(event) => setSearch(event.target.value)} />
            <Select value={viewMode} aria-label="Visualização das habilidades" onChange={(event) => setViewMode(event.target.value as AbilityListViewMode)}>
              <option value="detailed">Completa</option>
              <option value="compact">Simplificada</option>
            </Select>
            <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as AbilitySourceFilter)}>
              <option value="all">Todas as origens</option>
              <option value="character">Habilidades próprias</option>
              <option value="asi">ASI</option>
              <option value="condition">Habilidades temporárias</option>
              <option value="race">Habilidades raciais</option>
              <option value="weapon">Habilidades de armas</option>
              <option value="equipment">Todos os equipamentos</option>
              <option value="invocation">Evocações</option>
              <option value="feat">Talentos</option>
              <option value="channelDivinity">Canalizar Divindade</option>
              <option value="martialArts">Habilidades marciais</option>
            </Select>
            <Select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as AbilityKindFilter)}>
              <option value="all">Ativas, passivas e características</option>
              <option value="active">Somente ativas</option>
              <option value="passive">Somente passivas</option>
              <option value="feature">Somente características</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredAbilities.length === 0 ? (
            <p className="text-xs text-text">Nenhuma habilidade corresponde aos filtros selecionados.</p>
          ) : (
            <div className={viewMode === "compact" ? "grid gap-2" : "grid gap-3"}>
              {filteredAbilities.map((ability) => {
                const equipmentAbility = isEquipmentAbility(ability)
                const raceAbility = isRaceAbility(ability)
                const conditionAbility = isConditionAbility(ability)
                const asiAbility = ability.source === "asi"
                const grantedAbility =
                  equipmentAbility || raceAbility || conditionAbility || asiAbility
                const usageMax = ability.usage ? getAbilityUsageMax(displayCharacter, ability.usage) : undefined
                const sourceLabel = getAbilitySourceLabel(
                  ability,
                  equipmentAbility,
                  raceAbility,
                  conditionAbility,
                  weaponIds,
                )
                const editAbility = grantedAbility ? undefined : () => setEditingAbility(ability)
                const deleteAbility = grantedAbility ? undefined : () => removeAbility(ability.id)
                const onUse = () => requestUseAbility(ability)

                if (viewMode === "compact") {
                  return (
                    <CompactAbilityCard
                      key={ability.id}
                      ability={ability}
                      sourceLabel={sourceLabel}
                      usageMax={usageMax}
                      onEdit={editAbility}
                      onRemove={deleteAbility}
                      onUse={onUse}
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
                    onUse={onUse}
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

      {activationChoice ? (
        <Modal
          title={`Escolher habilidade — ${activationChoice.name}`}
          onClose={() => setActivationChoice(null)}
          className="max-w-lg"
        >
          <div className="grid gap-2">
            <p className="text-xs leading-5 text-textMuted">
              Escolha qual mini-habilidade será concedida. O recurso da habilidade principal só é consumido depois da escolha.
            </p>
            {(activationChoice.activationOptions ?? []).map((option) => {
              const mini = option.ability
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => useAbility(activationChoice.id, option.id)}
                  className="rounded-xl border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg"
                >
                  <div className="text-sm font-semibold text-textH">
                    {mini?.name || option.name}
                  </div>
                  {(mini?.description || option.description) ? (
                    <div className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                      {mini?.description || option.description}
                    </div>
                  ) : null}
                  {mini ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      <span>{mini.kind === "feature" ? "Característica" : mini.kind === "passive" ? "Passiva" : "Ativa"}</span>
                      {mini.usage ? <span>• {Math.max(0, mini.usage.max - mini.usage.used)}/{mini.usage.max} usos</span> : null}
                      {option.duration?.customLabel ? <span>• {option.duration.customLabel}</span> : null}
                    </div>
                  ) : option.condition?.name ? (
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Aplica: {option.condition.name}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function toSessionAbilitySource(ability: Ability): SessionAbilitySource {
  if (isEquipmentAbility(ability)) {
    return {
      type: "equipment",
      itemId: ability.sourceItemId,
      abilityId: ability.originalAbilityId,
    }
  }
  if (isRaceAbility(ability)) {
    return {
      type: "race",
      abilityId: ability.originalAbilityId,
    }
  }
  if (isConditionAbility(ability)) {
    return {
      type: "condition",
      conditionId: ability.sourceConditionId,
      abilityId: ability.originalAbilityId,
    }
  }
  return { type: "character", abilityId: ability.id }
}

function getAbilitySourceLabel(
  ability: Ability,
  equipmentAbility: boolean,
  raceAbility: boolean,
  conditionAbility: boolean,
  weaponIds: Set<string>,
): string | undefined {
  if (equipmentAbility && isEquipmentAbility(ability)) {
    return `${weaponIds.has(ability.sourceItemId) ? "Arma" : "Equipamento"}: ${ability.sourceItemName}`
  }
  if (conditionAbility && isConditionAbility(ability)) {
    return `Condição: ${ability.sourceConditionName}`
  }
  if (raceAbility) return "Raça"
  if (ability.source === "asi") return "ASI"
  return getCategoryLabel(ability)
}

function getCategoryLabel(ability: Ability): string | undefined {
  if (ability.category === "asi") return "ASI"
  if (ability.category === "invocation") return "Evocação"
  if (ability.category === "feat") return "Talento"
  if (ability.category === "channelDivinity") return "Canalizar Divindade"
  if (ability.category === "martialArts") return "Habilidade marcial"
  return undefined
}

function loadAbilityListViewMode(): AbilityListViewMode {
  if (typeof window === "undefined") return "detailed"
  try {
    return window.localStorage.getItem(ABILITY_LIST_VIEW_STORAGE_KEY) === "compact" ? "compact" : "detailed"
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
  optionId?: string,
): CharacterTemplate {
  const race = character.get("sheet").race
  const ability = (race.naturalAbilities ?? []).find((current) => current.id === abilityId)
  if (!ability) return character

  if (action === "use") {
    return useAbilityEffect(character, ability, {
      type: "race",
      sourceLabel: "Raça",
    }, optionId)
  }
  if (action === "deactivate") {
    return endAbilityEffect(character, ability, {
      type: "race",
      sourceLabel: "Raça",
    })
  }

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((current) =>
      current.id === abilityId ? restoreAbilityUse(current) : current,
    ),
  })
}

function isEquipmentAbility(ability: Ability): ability is EquipmentAbility {
  return "source" in ability && ability.source === "equipment"
}

function isRaceAbility(ability: Ability): ability is RaceAbility {
  return "source" in ability && ability.source === "race"
}

function isConditionAbility(ability: Ability): ability is ConditionAbility {
  return "source" in ability && ability.source === "condition"
}
