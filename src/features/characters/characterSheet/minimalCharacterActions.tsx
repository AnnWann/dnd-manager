import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { cn } from "../../../lib/cn"
import {
  activateCustomAbility,
  getCustomAbilityAvailability,
} from "../../../lib/customSystems"
import {
  activateCustomSystemAction,
  getEffectiveCustomAbilityActivation,
} from "../../../lib/customSystems/CustomSystemActions"
import { useCustomSystemDefinitions } from "../../../lib/customSystems/CustomSystemRegistry"
import type {
  Ability,
  AbilityActionKind,
} from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
  useAbilityEffect,
} from "../../../models/abilities/abilityActivation"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../models/customSystems/CustomSystemDefinition"

type ActionFilter = "action" | "bonusAction" | "reaction" | "free" | "passive"

type AbilitySource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }

type CustomAbilitySource = {
  systemId: string
  abilityId: string
  canUse: boolean
}

type CustomSystemActionSource = {
  systemId: string
  actionId: string
}

type ActionEntry = {
  id: string
  name: string
  description: string
  filter: ActionFilter
  magic?: boolean
  source?: string
  ability?: Ability
  abilitySource?: AbilitySource
  customAbilitySource?: CustomAbilitySource
  customSystemActionSource?: CustomSystemActionSource
}

const FILTER_OPTIONS: Array<{ value: ActionFilter; label: string }> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "free", label: "Ação livre" },
]

const STANDARD_ACTIONS: ActionEntry[] = [
  { id: "attack", name: "Atacar", filter: "action", description: "Realize um ataque corpo a corpo ou à distância. Recursos como Ataque Extra podem permitir mais de um ataque dentro desta mesma ação." },
  { id: "grapple-shove", name: "Agarrar ou empurrar", filter: "action", description: "Faça um ataque especial corpo a corpo para agarrar uma criatura ou empurrá-la. Quando possuir múltiplos ataques, normalmente substitui um deles." },
  { id: "cast-action", name: "Conjurar magia", filter: "action", magic: true, description: "Conjure uma magia cujo tempo de conjuração seja uma ação, respeitando componentes, alcance, espaços de magia e demais requisitos." },
  { id: "dash", name: "Correr", filter: "action", description: "Ganhe movimento adicional igual ao seu deslocamento atual durante este turno." },
  { id: "disengage", name: "Desengajar", filter: "action", description: "Seu movimento não provoca ataques de oportunidade durante o restante do turno." },
  { id: "dodge", name: "Esquivar", filter: "action", description: "Até o início do seu próximo turno, ataques visíveis contra você têm desvantagem e você tem vantagem em testes de resistência de Destreza, desde que possa agir e se mover." },
  { id: "help", name: "Ajudar", filter: "action", description: "Ajude uma criatura em uma tarefa ou distraia um inimigo próximo, concedendo vantagem ao próximo teste ou ataque apropriado." },
  { id: "hide", name: "Esconder-se", filter: "action", description: "Tente se ocultar realizando um teste de Furtividade quando o ambiente permitir que você não seja claramente visto." },
  { id: "ready", name: "Preparar", filter: "action", description: "Defina um gatilho perceptível e uma ação para executar com sua reação. Preparar uma magia exige concentração até o gatilho ocorrer." },
  { id: "search", name: "Procurar", filter: "action", description: "Procure algo usando um teste apropriado, normalmente Percepção ou Investigação, conforme o que está sendo analisado." },
  { id: "use-object", name: "Usar objeto", filter: "action", description: "Use ou manipule um objeto que exija uma ação além da interação gratuita normalmente disponível no turno." },
  { id: "light-weapon", name: "Ataque com arma leve", filter: "bonusAction", description: "Quando as regras de combate com duas armas forem atendidas, realize o ataque adicional permitido com uma arma leve empunhada." },
  { id: "cast-bonus", name: "Conjurar magia de ação bônus", filter: "bonusAction", magic: true, description: "Conjure uma magia cujo tempo de conjuração seja uma ação bônus, observando as limitações de conjuração no mesmo turno." },
  { id: "opportunity-attack", name: "Ataque de oportunidade", filter: "reaction", description: "Quando uma criatura visível deixa voluntariamente o seu alcance, use sua reação para realizar um ataque corpo a corpo contra ela." },
  { id: "readied-reaction", name: "Executar ação preparada", filter: "reaction", description: "Quando o gatilho definido pela ação Preparar ocorrer, use sua reação para executar a resposta escolhida ou ignore o gatilho." },
  { id: "cast-reaction", name: "Conjurar magia de reação", filter: "reaction", magic: true, description: "Conjure uma magia de reação quando o gatilho específico descrito nela acontecer." },
  { id: "interact-object", name: "Interagir com objeto", filter: "free", description: "Realize uma interação simples durante seu turno, como abrir uma porta destrancada, sacar uma arma ou pegar um objeto acessível. Interações adicionais podem exigir a ação Usar objeto." },
  { id: "speak", name: "Falar brevemente", filter: "free", description: "Comunique uma frase curta ou sinais simples durante seu turno, desde que a situação permita." },
  { id: "drop-item", name: "Soltar item", filter: "free", description: "Solte voluntariamente um item que esteja segurando. O item passa para o Inventário do chão quando esse fluxo for usado na ficha." },
  { id: "end-concentration", name: "Encerrar concentração", filter: "free", description: "Encerre voluntariamente a concentração em uma magia ou efeito a qualquer momento, sem gastar ação." },
]

export function MinimalCharacterActions({
  character,
  updateCharacter,
}: {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}) {
  const navigate = useNavigate()
  const definitions = useCustomSystemDefinitions()
  const [filter, setFilter] = useState<ActionFilter>("action")
  const [selected, setSelected] = useState<ActionEntry | null>(null)
  const [error, setError] = useState("")
  const standardActions = useMemo(
    () => getStandardActions(character, filter, definitions),
    [character, filter, definitions],
  )
  const systemActions = useMemo(
    () => getCustomSystemActions(character, filter, definitions),
    [character, filter, definitions],
  )
  const abilityActions = useMemo(
    () => getAbilityActions(character, filter, definitions),
    [character, filter, definitions],
  )
  const passiveAbilities = useMemo(
    () => getPassiveAbilities(character),
    [character],
  )

  function open(entry: ActionEntry) {
    if (entry.magic) {
      navigate(`/character/${encodeURIComponent(character.get("id"))}/spellsList`)
      return
    }
    setError("")
    setSelected(entry)
  }

  function changeAbilityState(entry: ActionEntry, action: "use" | "deactivate") {
    if (!entry.abilitySource) return
    updateCharacter(character.get("id"), (current) => {
      const source = entry.abilitySource!
      if (source.type === "equipment") {
        return action === "use"
          ? current.useEquipmentAbility(source.itemId, source.abilityId)
          : current.deactivateEquipmentAbility(source.itemId, source.abilityId)
      }
      if (source.type === "race") {
        const ability = (current.get("sheet").race.naturalAbilities ?? []).find(
          (item) => item.id === source.abilityId,
        )
        if (!ability) return current
        return action === "use"
          ? useAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
          : endAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
      }
      return action === "use"
        ? current.useAbility(source.abilityId)
        : current.deactivateAbility(source.abilityId)
    })
    setSelected(null)
  }

  function useCustomSystemAction(entry: ActionEntry) {
    const source = entry.customSystemActionSource
    if (!source) return
    try {
      setError("")
      updateCharacter(character.get("id"), (current) =>
        activateCustomSystemAction(
          current,
          definitions,
          source.systemId,
          source.actionId,
        ),
      )
      setSelected(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível executar esta ação.",
      )
    }
  }

  function useCustomAbility(entry: ActionEntry) {
    const source = entry.customAbilitySource
    if (!source) return
    try {
      setError("")
      const next = activateCustomAbility(
        character,
        definitions,
        source.systemId,
        source.abilityId,
      )
      updateCharacter(character.get("id"), () => next)
      setSelected(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível usar esta habilidade.",
      )
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Ações</h2>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4" role="tablist" aria-label="Filtrar ações">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-semibold transition-colors",
              filter === option.value
                ? "bg-accentBg text-textH shadow-theme-sm"
                : "text-textMuted hover:bg-bg hover:text-textH",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ActionGroup title="Ações padrão" entries={standardActions} onSelect={open} />
      {systemActions.length ? (
        <ActionGroup
          title="Ações de sistemas"
          entries={systemActions}
          onSelect={open}
        />
      ) : null}
      <ActionGroup
        title="Habilidades do personagem"
        entries={abilityActions}
        onSelect={open}
        emptyMessage={`Nenhuma habilidade configurada como ${filterLabel(filter).toLocaleLowerCase("pt-BR")}.`}
      />
      <ActionGroup
        title="Passivas"
        entries={passiveAbilities}
        onSelect={open}
        emptyMessage="Nenhuma habilidade passiva cadastrada."
      />

      {selected ? (
        <Modal title={selected.name} onClose={() => setSelected(null)} className="max-w-lg">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              <span>{filterLabel(selected.filter)}</span>
              {selected.source ? <span>• {selected.source}</span> : null}
              {selected.ability && (selected.ability.kind ?? "active") === "passive" ? (
                <span>
                  • {abilityRequiresActivation(selected.ability)
                    ? isAbilityBenefitsActive(selected.ability)
                      ? "Ativa"
                      : "Inativa"
                    : "Sempre ativa"}
                </span>
              ) : null}
              {selected.ability?.usage ? (
                <span>
                  • {Math.max(0, getAbilityUsageMax(character, selected.ability.usage) - selected.ability.usage.used)}/
                  {getAbilityUsageMax(character, selected.ability.usage)} usos
                </span>
              ) : null}
              {selected.customAbilitySource || selected.customSystemActionSource ? (
                <span>• Sistema personalizado</span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>
            {error ? (
              <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
                {error}
              </div>
            ) : null}
            {selected.customSystemActionSource ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button variant="primary" onClick={() => useCustomSystemAction(selected)}>
                  Usar
                </Button>
              </div>
            ) : selected.customAbilitySource ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button
                  variant="primary"
                  onClick={() => useCustomAbility(selected)}
                >
                  Usar
                </Button>
              </div>
            ) : selected.ability && abilityRequiresActivation(selected.ability) ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                {isAbilityBenefitsActive(selected.ability) ? (
                  <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>
                    Encerrar efeito
                  </Button>
                ) : null}
                {!isAbilityBenefitsActive(selected.ability) ? (
                  <Button variant="primary" onClick={() => changeAbilityState(selected, "use")}>
                    {(selected.ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function ActionGroup({
  title,
  entries,
  onSelect,
  emptyMessage,
}: {
  title: string
  entries: ActionEntry[]
  onSelect: (entry: ActionEntry) => void
  emptyMessage?: string
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">{title}</div>
      {entries.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left text-xs font-semibold leading-4 text-textH transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-xs text-textMuted">
          {emptyMessage ?? "Nenhuma ação disponível."}
        </p>
      )}
    </div>
  )
}

function getStandardActions(
  character: CharacterTemplate,
  filter: ActionFilter,
  definitions: CustomSystemDefinition[],
): ActionEntry[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const overrides = states
    .filter((state) => state.enabled !== false)
    .flatMap((state) => {
      const definition = definitions.find((entry) => entry.id === state.systemId)
      return definition?.standardActionOverrides ?? []
    })
    .filter((override) => override.enabled !== false)

  return STANDARD_ACTIONS.map((entry) => {
    const applicable = overrides.filter((override) => override.actionId === entry.id)
    return applicable.reduce<ActionEntry>((current, override) => ({
      ...current,
      filter: normalizeActionKind(override.actionKind) ?? current.filter,
      description: override.description?.trim() || current.description,
    }), entry)
  }).filter((entry) => entry.filter === filter)
}

function getCustomSystemActions(
  character: CharacterTemplate,
  filter: ActionFilter,
  definitions: CustomSystemDefinition[],
): ActionEntry[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const entries: ActionEntry[] = []

  for (const state of states) {
    if (state.enabled === false) continue
    const definition = definitions.find((item) => item.id === state.systemId)
    if (!definition || definition.hiddenFromSheet) continue

    for (const action of definition.actions ?? []) {
      if (action.enabled === false) continue
      if (normalizeActionKind(action.actionKind) !== filter) continue

      entries.push({
        id: `custom-system-action:${definition.id}:${action.id}`,
        name: action.name || "Ação sem nome",
        description:
          action.description?.trim() ||
          "Esta ação não possui uma descrição cadastrada.",
        filter,
        source: definition.name,
        customSystemActionSource: {
          systemId: definition.id,
          actionId: action.id,
        },
      })
    }
  }

  return entries.sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  )
}

function getAbilityActions(
  character: CharacterTemplate,
  filter: ActionFilter,
  definitions: CustomSystemDefinition[],
): ActionEntry[] {
  const raceAbilities = (character.get("sheet").race.naturalAbilities ?? []).map((ability) => ({
    ability,
    sourceLabel: "Raça",
    source: { type: "race", abilityId: ability.id } as AbilitySource,
  }))
  const characterAbilities = (character.getCharacterAbilities() ?? []).map((ability) => {
    if ("source" in ability && ability.source === "equipment") {
      return {
        ability,
        sourceLabel: `Equipamento: ${ability.sourceItemName}`,
        source: {
          type: "equipment",
          itemId: ability.sourceItemId,
          abilityId: ability.originalAbilityId,
        } as AbilitySource,
      }
    }
    return {
      ability,
      sourceLabel: ability.category === "feat" ? "Talento" : "Habilidade",
      source: { type: "character", abilityId: ability.id } as AbilitySource,
    }
  })

  const nativeEntries: ActionEntry[] = [...characterAbilities, ...raceAbilities]
    .filter(({ ability }) =>
      (ability.kind ?? "active") === "active" &&
      normalizeActionKind(ability.actionKind) === filter,
    )
    .map(({ ability, sourceLabel, source }) => ({
      id: `ability:${source.type}:${ability.id}`,
      name: ability.name || "Habilidade sem nome",
      description: ability.description?.trim() || "Esta habilidade não possui uma descrição cadastrada.",
      filter,
      source: sourceLabel,
      ability,
      abilitySource: source,
    }))

  return [...nativeEntries, ...getCustomAbilityActions(character, filter, definitions)]
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function getCustomAbilityActions(
  character: CharacterTemplate,
  filter: ActionFilter,
  definitions: CustomSystemDefinition[],
): ActionEntry[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const entries: ActionEntry[] = []

  for (const state of states) {
    if (state.enabled === false) continue
    const definition = definitions.find((item) => item.id === state.systemId)
    if (!definition || definition.hiddenFromSheet) continue

    for (const ability of state.abilities ?? []) {
      const entry = customAbilityEntry(definition, state, ability, filter)
      if (entry) entries.push(entry)
    }
  }

  return entries
}

function customAbilityEntry(
  definition: CustomSystemDefinition,
  _state: CharacterCustomSystemState,
  ability: CustomAbilityInstance,
  filter: ActionFilter,
): ActionEntry | undefined {
  if (ability.enabled === false) return undefined
  const type = definition.abilityTypes.find((item) => item.id === ability.abilityTypeId)
  if (!type) return undefined

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  if (normalizeActionKind(activation.actionKind) !== filter) return undefined

  const preset = type.predefinedAbilities?.find(
    (item) => item.id === ability.predefinedAbilityId,
  )
  const effectiveType = preset?.acquisition
    ? {
        ...type,
        acquisition: { ...type.acquisition, ...preset.acquisition },
      }
    : type
  const availability = getCustomAbilityAvailability(effectiveType, ability)
  if (!availability.canUse) return undefined

  const title = displayValue(ability.values[type.display.titleFieldId]) || type.name
  const description = type.display.descriptionFieldId
    ? displayValue(ability.values[type.display.descriptionFieldId])
    : preset?.description ?? type.description

  return {
    id: `custom-ability:${definition.id}:${ability.id}`,
    name: title,
    description: description?.trim() || "Esta habilidade não possui uma descrição cadastrada.",
    filter,
    source: `${definition.name} · ${type.name}`,
    customAbilitySource: {
      systemId: definition.id,
      abilityId: ability.id,
      canUse: true,
    },
  }
}

function getPassiveAbilities(character: CharacterTemplate): ActionEntry[] {
  const raceAbilities = (character.get("sheet").race.naturalAbilities ?? []).map((ability) => ({
    ability,
    sourceLabel: "Raça",
    source: { type: "race", abilityId: ability.id } as AbilitySource,
  }))
  const characterAbilities = (character.getCharacterAbilities() ?? []).map((ability) => {
    if ("source" in ability && ability.source === "equipment") {
      return {
        ability,
        sourceLabel: `Equipamento: ${ability.sourceItemName}`,
        source: {
          type: "equipment",
          itemId: ability.sourceItemId,
          abilityId: ability.originalAbilityId,
        } as AbilitySource,
      }
    }
    return {
      ability,
      sourceLabel: ability.category === "feat" ? "Talento" : "Habilidade",
      source: { type: "character", abilityId: ability.id } as AbilitySource,
    }
  })

  return [...characterAbilities, ...raceAbilities]
    .filter(({ ability }) => (ability.kind ?? "active") === "passive")
    .map(({ ability, sourceLabel, source }) => ({
      id: `passive:${source.type}:${ability.id}`,
      name: ability.name || "Habilidade sem nome",
      description: ability.description?.trim() || "Esta habilidade não possui uma descrição cadastrada.",
      filter: "passive" as const,
      source: sourceLabel,
      ability,
      abilitySource: source,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function normalizeActionKind(actionKind: AbilityActionKind | undefined): ActionFilter | undefined {
  if (actionKind === "action") return "action"
  if (actionKind === "bonusAction") return "bonusAction"
  if (actionKind === "reaction") return "reaction"
  if (actionKind === "free") return "free"
  return undefined
}

function filterLabel(filter: ActionFilter): string {
  if (filter === "passive") return "Passiva"
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}
