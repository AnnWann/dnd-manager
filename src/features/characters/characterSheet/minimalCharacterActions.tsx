import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { useMagicContext } from "../../../contexts/magicContext"
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
import { useAbility as useCharacterAbility } from "../../../models/characters/characterAbilities"
import { getChannelDivinityPool } from "../../../models/characters/characterChannelDivinity"
import { getKiPool } from "../../../models/characters/characterKi"
import {
  getSorceryPointPool,
  setSorceryPointCurrent,
} from "../../../models/characters/characterSorceryPoints"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../models/customSystems/CustomSystemDefinition"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

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
  metamagicCost?: number | "spell-level"
  usageRemaining?: number
  usageMaximum?: number
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
  const sessionRuntime = useOptionalSessionRuntime()
  const { getMetamagicsByIds } = useMagicContext()
  const [filter, setFilter] = useState<ActionFilter>("action")
  const [selected, setSelected] = useState<ActionEntry | null>(null)
  const [error, setError] = useState("")
  const [variableMetamagicCost, setVariableMetamagicCost] = useState(1)
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
  const metamagicActions = useMemo<ActionEntry[]>(() => {
    if (filter !== "free") return []
    const knownIds = character.get("magic")?.metamagic?.metamagics ?? []
    return getMetamagicsByIds(knownIds)
      .map((metamagic) => ({
        id: `metamagic:${metamagic.id}`,
        name: metamagic.name,
        filter: "free" as const,
        source: "Metamagia",
        metamagicCost: metamagic.sorceryPointCost,
        description: [
          ...metamagic.desc,
          `Custo: ${formatMetamagicCost(metamagic.sorceryPointCost)}.`,
          `Momento: ${formatMetamagicTiming(metamagic.timing)}.`,
        ].join("\n"),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
  }, [character, filter, getMetamagicsByIds])
  const channelDivinityActions = abilityActions.filter(
    (entry) => entry.ability?.category === "channelDivinity",
  )
  const martialArtsActions = abilityActions.filter(
    (entry) => entry.ability?.category === "martialArts",
  )
  const regularAbilityActions = abilityActions.filter(
    (entry) =>
      entry.ability?.category !== "channelDivinity" &&
      entry.ability?.category !== "martialArts",
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
    if (entry.metamagicCost === "spell-level") setVariableMetamagicCost(1)
    setSelected(entry)
  }

  function changeAbilityState(
    entry: ActionEntry,
    action: "use" | "deactivate",
    optionId?: string,
  ) {
    const source = entry.abilitySource
    if (!source) return

    if (sessionRuntime) {
      if (sessionRuntime.status !== "connected") {
        setError("A sessão está desconectada. Não foi possível alterar a habilidade.")
        return
      }

      const sent = sessionRuntime.dispatchAbilityOperation({
        type: action === "use"
          ? "character.ability.use"
          : "character.ability.deactivate",
        characterId: character.get("id"),
        source,
        abilityName: entry.ability?.name,
        ...(action === "use" && optionId
          ? { activationOptionId: optionId }
          : {}),
      })

      if (!sent) {
        setError("Não foi possível enviar a alteração da habilidade para a sessão.")
        return
      }

      setSelected(null)
      return
    }

    updateCharacter(character.get("id"), (current) => {
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
          ? useAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" }, optionId)
          : endAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
      }
      return action === "use"
        ? useCharacterAbility(current, source.abilityId, optionId)
        : current.deactivateAbility(source.abilityId)
    })
    setSelected(null)
  }

  function useCustomSystemAction(entry: ActionEntry) {
    const source = entry.customSystemActionSource
    if (!source) return
    try {
      setError("")

      if (sessionRuntime) {
        if (sessionRuntime.status !== "connected") {
          setError("A sessão está desconectada. Não foi possível executar esta ação.")
          return
        }

        const sent = sessionRuntime.dispatchAbilityOperation({
          type: "character.customSystem.action.execute",
          characterId: character.get("id"),
          systemId: source.systemId,
          actionId: source.actionId,
        })
        if (!sent) {
          setError("Não foi possível enviar esta ação para a sessão.")
          return
        }

        setSelected(null)
        return
      }

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

      if (sessionRuntime) {
        if (sessionRuntime.status !== "connected") {
          setError("A sessão está desconectada. Não foi possível usar esta habilidade.")
          return
        }

        const sent = sessionRuntime.dispatchAbilityOperation({
          type: "character.customSystem.ability.activate",
          characterId: character.get("id"),
          systemId: source.systemId,
          abilityId: source.abilityId,
        })
        if (!sent) {
          setError("Não foi possível enviar esta habilidade para a sessão.")
          return
        }

        setSelected(null)
        return
      }

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

  function useMetamagic(entry: ActionEntry) {
    if (entry.metamagicCost === undefined) return
    const cost = entry.metamagicCost === "spell-level"
      ? Math.max(1, Math.trunc(variableMetamagicCost || 1))
      : entry.metamagicCost
    const pool = getSorceryPointPool(character)
    if (pool.current < cost) {
      setError(`Pontos de feitiçaria insuficientes. Necessário: ${cost}; disponível: ${pool.current}.`)
      return
    }

    setError("")

    if (sessionRuntime) {
      if (sessionRuntime.status !== "connected") {
        setError("A sessão está desconectada. Não foi possível gastar pontos de feitiçaria.")
        return
      }

      const sent = Array.from({ length: cost }).every(() =>
        sessionRuntime.dispatchMagicOperation({
          type: "character.sorceryPoint.spend",
          characterId: character.get("id"),
        }),
      )
      if (!sent) {
        setError("Não foi possível enviar o gasto de pontos de feitiçaria para a sessão.")
        return
      }

      setSelected(null)
      return
    }

    updateCharacter(character.get("id"), (current) => {
      const currentPool = getSorceryPointPool(current)
      if (currentPool.current < cost) return current
      return setSorceryPointCurrent(current, currentPool.current - cost)
    })
    setSelected(null)
  }

  const sorceryPoints = getSorceryPointPool(character)

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
      {metamagicActions.length ? (
        <ActionGroup title="Metamagia" entries={metamagicActions} onSelect={open} />
      ) : null}
      {systemActions.length ? (
        <ActionGroup title="Ações de sistemas" entries={systemActions} onSelect={open} />
      ) : null}
      {channelDivinityActions.length ? (
        <ActionGroup title="Canalizar Divindade" entries={channelDivinityActions} onSelect={open} />
      ) : null}
      {martialArtsActions.length ? (
        <ActionGroup title="Artes marciais" entries={martialArtsActions} onSelect={open} />
      ) : null}
      <ActionGroup
        title="Habilidades do personagem"
        entries={regularAbilityActions}
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
              {selected.usageMaximum !== undefined ? (
                <span>• {selected.usageRemaining ?? 0}/{selected.usageMaximum} usos</span>
              ) : null}
              {selected.metamagicCost !== undefined ? (
                <span>• {sorceryPoints.current}/{sorceryPoints.max} pontos de feitiçaria</span>
              ) : null}
              {selected.customAbilitySource || selected.customSystemActionSource ? (
                <span>• Sistema personalizado</span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>
            {selected.metamagicCost === "spell-level" ? (
              <label className="grid gap-1 rounded-xl border border-border bg-bg-subtle p-3">
                <span className="text-xs font-semibold text-textH">Pontos a gastar</span>
                <span className="text-[11px] leading-4 text-textMuted">
                  Informe o custo desta aplicação. Para Feitiço Duplicado, use o nível da magia; truques custam 1.
                </span>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, sorceryPoints.current)}
                  value={variableMetamagicCost}
                  onChange={(event) => setVariableMetamagicCost(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
                />
              </label>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
                {error}
              </div>
            ) : null}
            {selected.metamagicCost !== undefined ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button
                  variant="primary"
                  disabled={
                    sorceryPoints.current <
                    (selected.metamagicCost === "spell-level"
                      ? Math.max(1, variableMetamagicCost)
                      : selected.metamagicCost)
                  }
                  onClick={() => useMetamagic(selected)}
                >
                  Usar
                </Button>
              </div>
            ) : selected.customSystemActionSource ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button variant="primary" onClick={() => useCustomSystemAction(selected)}>Usar</Button>
              </div>
            ) : selected.customAbilitySource ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button variant="primary" onClick={() => useCustomAbility(selected)}>Usar</Button>
              </div>
            ) : selected.ability && abilityRequiresActivation(selected.ability) ? (
              <div className="grid gap-2 border-t border-border pt-3">
                {isAbilityBenefitsActive(selected.ability) ? (
                  <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>Encerrar efeito</Button>
                  </div>
                ) : (selected.ability.activationOptions?.length ?? 0) > 0 ? (
                  <>
                    <div className="text-xs font-semibold text-textH">Escolha o efeito</div>
                    {(selected.ability.activationOptions ?? []).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => changeAbilityState(selected, "use", option.id)}
                        className="rounded-xl border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg"
                      >
                        <div className="text-sm font-semibold text-textH">{option.name}</div>
                        {option.description ? (
                          <div className="mt-1 whitespace-pre-wrap text-xs leading-5 text-textMuted">{option.description}</div>
                        ) : null}
                        {option.condition?.name ? (
                          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-accent">Aplica: {option.condition.name}</div>
                        ) : null}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={() => changeAbilityState(selected, "use")}>
                      {(selected.ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}
                    </Button>
                  </div>
                )}
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
              <span className="block">{entry.name}</span>
              {entry.usageMaximum !== undefined ? (
                <span className="mt-1 block text-[10px] font-medium text-textMuted">
                  {entry.usageRemaining ?? 0}/{entry.usageMaximum} usos
                </span>
              ) : null}
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
        description: action.description?.trim() || "Esta ação não possui uma descrição cadastrada.",
        filter,
        source: definition.name,
        customSystemActionSource: {
          systemId: definition.id,
          actionId: action.id,
        },
      })
    }
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function getAbilityActions(
  character: CharacterTemplate,
  filter: ActionFilter,
  definitions: CustomSystemDefinition[],
): ActionEntry[] {
  const channelDivinity = getChannelDivinityPool(character)
  const ki = getKiPool(character)
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
      sourceLabel:
        ability.category === "channelDivinity"
          ? "Canalizar Divindade"
          : ability.category === "martialArts"
            ? "Artes marciais"
            : ability.category === "feat"
              ? "Talento"
              : "Habilidade",
      source: { type: "character", abilityId: ability.id } as AbilitySource,
    }
  })

  const nativeEntries: ActionEntry[] = [...characterAbilities, ...raceAbilities]
    .filter(({ ability }) =>
      (ability.kind ?? "active") === "active" &&
      normalizeActionKind(ability.actionKind) === filter,
    )
    .map(({ ability, sourceLabel, source }) => {
      const usesChannelDivinity = source.type === "character" && ability.category === "channelDivinity"
      const usesKi = source.type === "character" && ability.category === "martialArts"
      return {
        id: `ability:${source.type}:${ability.id}`,
        name: ability.name || "Habilidade sem nome",
        description: ability.description?.trim() || "Esta habilidade não possui uma descrição cadastrada.",
        filter,
        source: sourceLabel,
        ability,
        abilitySource: source,
        usageMaximum: usesChannelDivinity
          ? channelDivinity?.max
          : usesKi
            ? ki?.max
            : ability.usage
              ? getAbilityUsageMax(character, ability.usage)
              : undefined,
        usageRemaining: usesChannelDivinity
          ? channelDivinity?.current
          : usesKi
            ? ki?.current
            : ability.usage
              ? Math.max(0, getAbilityUsageMax(character, ability.usage) - ability.usage.used)
              : undefined,
      }
    })

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
      sourceLabel:
        ability.category === "martialArts"
          ? "Artes marciais"
          : ability.category === "feat"
            ? "Talento"
            : "Habilidade",
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

function formatMetamagicCost(cost: number | "spell-level"): string {
  if (cost === "spell-level") return "pontos iguais ao nível da magia (truque = 1)"
  return `${cost} ponto${cost === 1 ? "" : "s"} de feitiçaria`
}

function formatMetamagicTiming(timing: string): string {
  if (timing === "on-cast") return "ao conjurar"
  if (timing === "on-damage-roll") return "ao rolar dano"
  if (timing === "on-miss") return "ao errar"
  return timing
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
