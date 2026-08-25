import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import type { Ability } from "../../../models/abilities/Ability"
import { getAbilityUsageMax } from "../../../models/abilities/abilityActivation"
import { getCharacterAsis } from "../../../models/characters/CharacterAsi"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { flattenBonuses } from "../inventory/equipmentBonusFields"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { AbilityDialog } from "./abilityDialog"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type RaceAbility = Ability & {
  source: "race"
  originalAbilityId: string
}

type AbilitySourceFilter =
  | "all"
  | "character"
  | "asi"
  | "race"
  | "equipment"
  | "invocation"
  | "feat"
  | "channelDivinity"
  | "martialArts"

type AbilityKindFilter = "all" | "active" | "passive" | "feature"

/**
 * User-context ability library.
 *
 * This screen describes durable character abilities. It intentionally has no
 * activation, deactivation, charge spending, charge restoration, cooldown
 * mutation or other gameplay controls.
 */
export function UserCharacterAbilitiesTab({
  character,
  updateCharacter,
}: Props) {
  const { isEditing = false } = useCharacterWorkspace()
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [creating, setCreating] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<AbilitySourceFilter>("all")
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

  const abilities = useMemo(
    () => [
      ...character
        .getCharacterAbilities()
        .filter((ability) => ability.source !== "condition"),
      ...raceAbilities,
    ],
    [character, raceAbilities],
  )

  const filteredAbilities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR")

    return abilities
      .filter((ability) => {
        const matchesSource = (() => {
          switch (sourceFilter) {
            case "asi":
              return ability.source === "asi" || ability.category === "asi"
            case "race":
              return ability.source === "race"
            case "equipment":
              return ability.source === "equipment"
            case "invocation":
              return ability.category === "invocation"
            case "feat":
              return ability.category === "feat"
            case "channelDivinity":
              return ability.category === "channelDivinity"
            case "martialArts":
              return ability.category === "martialArts"
            case "character":
              return !ability.source || ability.source === "character"
            default:
              return true
          }
        })()

        const matchesKind =
          kindFilter === "all" || (ability.kind ?? "active") === kindFilter
        const matchesSearch =
          !normalizedSearch ||
          ability.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
          ability.description
            ?.toLocaleLowerCase("pt-BR")
            .includes(normalizedSearch)

        return matchesSource && matchesKind && matchesSearch
      })
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
  }, [abilities, kindFilter, search, sourceFilter])

  function saveAbility(ability: Ability) {
    updateCharacter(character.get("id"), (current) => current.saveAbility(ability))
    setCreating(false)
    setEditingAbility(null)
  }

  function removeAbility(ability: Ability) {
    if (!canManageAbility(ability)) return
    updateCharacter(character.get("id"), (current) =>
      current.removeAbility(ability.id),
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">Habilidades</div>
              <div className="mt-1 text-xs text-textMuted">
                Consulte as habilidades e características que fazem parte da ficha.
              </div>
            </div>

            {isEditing ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCreating(true)}
              >
                + Adicionar habilidade
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_190px_180px]">
            <Input
              value={search}
              placeholder="Buscar habilidade..."
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as AbilitySourceFilter)
              }
            >
              <option value="all">Todas as origens</option>
              <option value="character">Habilidades próprias</option>
              <option value="asi">ASI</option>
              <option value="race">Raça</option>
              <option value="equipment">Equipamentos</option>
              <option value="invocation">Evocações</option>
              <option value="feat">Talentos</option>
              <option value="channelDivinity">Canalizar Divindade</option>
              <option value="martialArts">Artes marciais</option>
            </Select>
            <Select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as AbilityKindFilter)
              }
            >
              <option value="all">Todos os tipos</option>
              <option value="active">Ativas</option>
              <option value="passive">Passivas</option>
              <option value="feature">Características</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredAbilities.length === 0 ? (
            <p className="text-xs text-textMuted">
              Nenhuma habilidade corresponde aos filtros selecionados.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredAbilities.map((ability) => (
                <UserAbilityCard
                  key={ability.id}
                  character={character}
                  ability={ability}
                  sourceLabel={getAbilitySourceLabel(ability)}
                  editable={isEditing && canManageAbility(ability)}
                  onEdit={() => setEditingAbility(ability)}
                  onRemove={() => removeAbility(ability)}
                />
              ))}
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

function UserAbilityCard({
  character,
  ability,
  sourceLabel,
  editable,
  onEdit,
  onRemove,
}: {
  character: CharacterTemplate
  ability: Ability
  sourceLabel?: string
  editable: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { getSpellByIndex } = useMagicContext()
  const [expanded, setExpanded] = useState(false)
  const description = ability.description?.trim() ?? ""
  const bonuses = flattenBonuses(ability.bonuses ?? {})
  const grants = (ability.grantedSpells ?? []).map((grant) => ({
    grant,
    spell: getSpellByIndex(grant.index),
  }))
  const proficiencies = ability.grantedProficiencies ?? []

  return (
    <article className="rounded-2xl border border-border bg-bg p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-sm font-semibold text-textH">
              {ability.name || "Habilidade sem nome"}
            </h3>
            <DefinitionPill>{formatAbilityKind(ability)}</DefinitionPill>
            <DefinitionPill>{formatAbilityTiming(ability)}</DefinitionPill>
            {sourceLabel ? <DefinitionPill>{sourceLabel}</DefinitionPill> : null}
            {formatConfiguredUsage(character, ability) ? (
              <DefinitionPill>{formatConfiguredUsage(character, ability)!}</DefinitionPill>
            ) : null}
          </div>

          {description ? (
            <div className="mt-3">
              <p
                className={cn(
                  "whitespace-pre-wrap text-xs leading-5 text-text",
                  !expanded && "line-clamp-4",
                )}
              >
                {description}
              </p>
              {description.length > 180 ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-textH hover:opacity-80"
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? "Ver menos" : "Ver mais"}
                </button>
              ) : null}
            </div>
          ) : null}

          {bonuses.length > 0 ? (
            <DefinitionSection title="Bônus">
              {bonuses.map((entry) => (
                <DefinitionPill key={entry.id}>{entry.label}</DefinitionPill>
              ))}
            </DefinitionSection>
          ) : null}

          {grants.length > 0 ? (
            <DefinitionSection title="Magias concedidas">
              {grants.map(({ grant, spell }) => (
                <DefinitionPill key={grant.index}>
                  {spell?.displayName || spell?.name || grant.index}
                </DefinitionPill>
              ))}
            </DefinitionSection>
          ) : null}

          {proficiencies.length > 0 ? (
            <DefinitionSection title="Proficiências concedidas">
              {proficiencies.map((proficiency) => (
                <DefinitionPill key={proficiency.id}>
                  {proficiency.name}
                </DefinitionPill>
              ))}
            </DefinitionSection>
          ) : null}
        </div>

        {editable ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              Remover
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function DefinitionSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function DefinitionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-medium text-text">
      {children}
    </span>
  )
}

function formatAbilityKind(ability: Ability): string {
  if (ability.kind === "passive") return "Passiva"
  if (ability.kind === "feature") return "Característica"
  return "Ativa"
}

function formatAbilityTiming(ability: Ability): string {
  if ((ability.kind ?? "active") === "active") {
    return (
      ABILITY_ACTION_OPTIONS.find(
        (option) => option.value === (ability.actionKind ?? "action"),
      )?.label ?? "Ação"
    )
  }

  return (
    ABILITY_TRIGGER_OPTIONS.find(
      (option) => option.value === (ability.trigger ?? "always"),
    )?.label ??
    ability.trigger ??
    "Sempre"
  )
}

function formatConfiguredUsage(
  character: CharacterTemplate,
  ability: Ability,
): string | undefined {
  if (!ability.usage) return undefined

  const maximum = getAbilityUsageMax(character, ability.usage)
  if (ability.usage.reset === "cooldown") {
    const amount = Math.max(1, Math.trunc(ability.usage.cooldownAmount ?? 1))
    const unit =
      COOLDOWN_UNIT_OPTIONS.find(
        (option) => option.value === (ability.usage?.cooldownUnit ?? "turns"),
      )?.label ?? "Turnos"
    return `${maximum} uso(s) • cooldown ${amount} ${unit.toLocaleLowerCase("pt-BR")}`
  }

  const reset =
    USAGE_OPTIONS.find((option) => option.value === ability.usage?.reset)?.label
  return reset ? `${maximum} uso(s) • ${reset}` : `${maximum} uso(s)`
}

function canManageAbility(ability: Ability): boolean {
  return !ability.source || ability.source === "character"
}

function getAbilitySourceLabel(ability: Ability): string | undefined {
  if (ability.source === "asi") return "ASI"
  if (ability.source === "race") return "Raça"
  if (ability.source === "equipment") {
    return ability.sourceItemName
      ? `Equipamento: ${ability.sourceItemName}`
      : "Equipamento"
  }
  if (ability.category === "asi") return "ASI"
  if (ability.category === "invocation") return "Evocação"
  if (ability.category === "feat") return "Talento"
  if (ability.category === "channelDivinity") return "Canalizar Divindade"
  if (ability.category === "martialArts") return "Artes marciais"
  return undefined
}

/** Retained to document that ASI-owned abilities are projected by the model. */
void getCharacterAsis
