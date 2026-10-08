import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import {
  getRollVisibility,
  requestActionAnnouncement,
  requestActionRoll,
} from "../../../lib/diceRoller"
import {
  evaluateCustomFormula,
  getCustomAbilityAvailability,
} from "../../../lib/customSystems"
import {
  activateCustomAbilityWithRoll,
  activateCustomSystemActionWithRoll,
  customRollManualDamageCount,
  customRollRequiresManualPrimary,
  type CustomAbilityRollResolution,
} from "../../../lib/customSystems/CustomAbilityRoll"
import {
  getEffectiveCustomAbilityActivation,
} from "../../../lib/customSystems/CustomSystemActions"
import { useCustomSystemDefinitions } from "../../../lib/customSystems/CustomSystemRegistry"
import type {
  Ability,
  AbilityActionKind,
  AbilityResourceSelection,
} from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
  useAbilityEffect,
} from "../../../models/abilities/abilityActivation"
import {
  canPayAbilityResourceCosts,
  hasAbilityResourceCosts,
  spendAbilityResourceCosts,
} from "../../../models/abilities/abilityResourceCosts"
import { useAbility as useCharacterAbility } from "../../../models/characters/characterAbilities"
import { getChannelDivinityPool } from "../../../models/characters/characterChannelDivinity"
import { getKiPool } from "../../../models/characters/characterKi"
import {
  getSorceryPointPool,
  setSorceryPointCurrent,
} from "../../../models/characters/characterSorceryPoints"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { hasManualBonusRolls, listBonusRollRequirements, resolveBonusCollectionRolls } from "../../../models/bonuses/BonusRoll"
import type { CustomAbilityRollDefinition } from "../../../models/customSystems/CustomAbilityDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../models/customSystems/CustomSystemDefinition"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { AbilityResourceActivationModal } from "../abilities/abilityResourceActivationModal"
import { CustomSystemActionResources } from "./CustomSystemActionResources"

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

type CustomAbilityCostPreview = {
  key: string
  name: string
  amount?: number
  current?: number
  sufficient?: boolean
  unavailable?: boolean
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
  customAbilityRoll?: CustomAbilityRollDefinition
  customSystemActionSource?: CustomSystemActionSource
  activationLevelBase?: number
  activationLevelMaximum?: number
  activationLevelLabel?: string
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
  const digitalDiceEnabled =
    sessionRuntime?.runtimeConfigSnapshot?.config.diceRollingEnabled !== false
  const physicalDiceMode = Boolean(sessionRuntime) && !digitalDiceEnabled
  const { getMetamagicsByIds } = useMagicContext()
  const [filter, setFilter] = useState<ActionFilter>("action")
  const [selected, setSelected] = useState<ActionEntry | null>(null)
  const [abilityResourceEntry, setAbilityResourceEntry] = useState<ActionEntry | null>(null)
  const [error, setError] = useState("")
  const [variableMetamagicCost, setVariableMetamagicCost] = useState(1)
  const [manualRollValue, setManualRollValue] = useState("")
  const [manualDamageValues, setManualDamageValues] = useState<string[]>([])
  const [customActivationLevel, setCustomActivationLevel] = useState(1)
  const [rollFeedback, setRollFeedback] = useState<Array<{
    label: string
    dice?: string
    diceValue: number
    formulaBonus?: number
    total: number
  }>>([])
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
  const selectedCustomAbilityCosts = useMemo(() => {
    if (!selected?.customAbilitySource) return []
    const previewRollValue =
      selected.customAbilityRoll
      && (selected.customAbilityRoll.mode === "manual" || physicalDiceMode)
      && isFiniteInput(manualRollValue)
        ? Number(manualRollValue)
        : undefined
    return resolveCustomAbilityCosts(
      character,
      definitions,
      selected.customAbilitySource,
      previewRollValue,
      selected.activationLevelBase === undefined
        ? undefined
        : customActivationLevel,
    )
  }, [
    character,
    customActivationLevel,
    definitions,
    manualRollValue,
    physicalDiceMode,
    selected,
  ])
  const selectedCustomAbilityCostError = customAbilityCostError(
    selectedCustomAbilityCosts,
  )

  function announce(entry: ActionEntry) {
    if (entry.ability) {
      requestActionRoll({
        characterId: character.get("id"),
        source: {
          type: "ability",
          abilityId: entry.abilitySource?.abilityId ?? entry.ability.id,
        },
      })
      return
    }

    requestActionAnnouncement({
      characterId: character.get("id"),
      title: entry.name,
      subtitle: entry.source
        ? `${filterLabel(entry.filter)} · ${entry.source}`
        : filterLabel(entry.filter),
      description: entry.description,
    })
  }

  function open(entry: ActionEntry) {
    if (entry.magic) {
      navigate(`/character/${encodeURIComponent(character.get("id"))}/spellsList`)
      return
    }
    setError("")
    setManualRollValue("")
    setManualDamageValues([])
    setRollFeedback([])
    setCustomActivationLevel(entry.activationLevelBase ?? 1)
    if (entry.metamagicCost === "spell-level") setVariableMetamagicCost(1)
    setSelected(entry)
  }

  function changeAbilityState(
    entry: ActionEntry,
    action: "use" | "deactivate",
    optionId?: string,
    resourceSelection?: AbilityResourceSelection,
    bonusRollValues?: Record<string, number>,
  ) {
    const source = entry.abilitySource
    if (!source) return

    if (
      action === "use" &&
      entry.ability &&
      (hasAbilityResourceCosts(entry.ability) || entry.ability.resourceUpcast?.enabled)
    ) {
      const payment = canPayAbilityResourceCosts(character, entry.ability, resourceSelection)
      if (!payment.ok) {
        setError(payment.reason)
        return
      }
    }

    let resolvedBonusRollValues = bonusRollValues
    let hasResolvedRolls = false
    if (action === "use" && entry.ability) {
      const requirements = listBonusRollRequirements(entry.ability.bonuses)
      if (
        physicalDiceMode
        && requirements.some((requirement) => {
          const value = bonusRollValues?.[requirement.key]
          return typeof value !== "number" || !Number.isFinite(value)
        })
      ) {
        setAbilityResourceEntry(entry)
        return
      }
      try {
        const resolved = resolveBonusCollectionRolls(
          character,
          entry.ability.bonuses,
          bonusRollValues,
        )
        if (resolved.results.length > 0) {
          hasResolvedRolls = true
          resolvedBonusRollValues = Object.fromEntries(
            resolved.results.map((result) => [result.key, result.diceValue]),
          )
          setRollFeedback(resolved.results.map((result) => ({
            label: result.label,
            dice: result.dice,
            diceValue: result.diceValue,
            formulaBonus: result.formulaBonus,
            total: result.total,
          })))
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível resolver a rolagem da habilidade.")
        return
      }
    }

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
        ...(action === "use" && resourceSelection
          ? { resourceSelection }
          : {}),
        ...(action === "use" && resolvedBonusRollValues
          ? { bonusRollValues: resolvedBonusRollValues }
          : {}),
      })

      if (!sent) {
        setError("Não foi possível enviar a alteração da habilidade para a sessão.")
        return
      }

      if (action === "use") announce(entry)
      setAbilityResourceEntry(null)
      if (!hasResolvedRolls) setSelected(null)
      return
    }

    updateCharacter(character.get("id"), (current) => {
      let paidCurrent = current
      if (action === "use" && entry.ability) {
        const payment = spendAbilityResourceCosts(current, entry.ability, resourceSelection)
        if (!payment.ok) return current
        paidCurrent = payment.character
      }

      if (source.type === "equipment") {
        return action === "use"
          ? paidCurrent.useEquipmentAbility(source.itemId, source.abilityId, resolvedBonusRollValues)
          : current.deactivateEquipmentAbility(source.itemId, source.abilityId)
      }
      if (source.type === "race") {
        const ability = (current.get("sheet").race.naturalAbilities ?? []).find(
          (item) => item.id === source.abilityId,
        )
        if (!ability) return current
        return action === "use"
          ? useAbilityEffect(paidCurrent, ability, { type: "race", sourceLabel: "Raça" }, optionId, resolvedBonusRollValues)
          : endAbilityEffect(current, ability, { type: "race", sourceLabel: "Raça" })
      }
      return action === "use"
        ? useCharacterAbility(paidCurrent, source.abilityId, optionId, resolvedBonusRollValues)
        : current.deactivateAbility(source.abilityId)
    })
    setAbilityResourceEntry(null)
    if (!hasResolvedRolls) setSelected(null)
  }

  function useCustomSystemAction(entry: ActionEntry) {
    const source = entry.customSystemActionSource
    if (!source) return

    try {
      setError("")
      const activationLevel = resolveEntryActivationLevel(
        entry,
        customActivationLevel,
      )
      const manual = isManualCustomRoll(
        entry.customAbilityRoll,
        physicalDiceMode,
      )
      const inputs = readCustomRollInputs(
        entry.customAbilityRoll,
        manual,
        manualRollValue,
        manualDamageValues,
      )
      if (!inputs.ok) {
        setError(inputs.error)
        return
      }

      if (sessionRuntime) {
        if (sessionRuntime.status !== "connected") {
          setError(
            "A sessão está desconectada. Não foi possível executar esta ação.",
          )
          return
        }

        const sent = sessionRuntime.dispatchAbilityOperation({
          type: "character.customSystem.action.execute",
          characterId: character.get("id"),
          systemId: source.systemId,
          actionId: source.actionId,
          ...(inputs.rollValue !== undefined
            ? { rollValue: inputs.rollValue }
            : {}),
          ...(inputs.damageValues?.length
            ? { rollDamageValues: inputs.damageValues }
            : {}),
          ...(activationLevel !== undefined
            ? { activationLevel }
            : {}),
          ...(entry.customAbilityRoll
            ? { visibility: getRollVisibility() }
            : {}),
        })
        if (!sent) {
          setError("Não foi possível enviar esta ação para a sessão.")
          return
        }

        if (!entry.customAbilityRoll) {
          announce(entry)
        }
        setSelected(null)
        return
      }

      const resolved = activateCustomSystemActionWithRoll(
        character,
        definitions,
        source.systemId,
        source.actionId,
        inputs.rollValue,
        activationLevel,
        inputs.damageValues,
      )
      if (resolved.roll) {
        setRollFeedback(customRollFeedback(resolved.roll, entry.name))
      }

      updateCharacter(
        character.get("id"),
        () => resolved.character,
      )
      if (!resolved.roll) setSelected(null)
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
      const activationLevel = resolveEntryActivationLevel(
        entry,
        customActivationLevel,
      )
      const manual = isManualCustomRoll(
        entry.customAbilityRoll,
        physicalDiceMode,
      )
      const inputs = readCustomRollInputs(
        entry.customAbilityRoll,
        manual,
        manualRollValue,
        manualDamageValues,
      )
      if (!inputs.ok) {
        setError(inputs.error)
        return
      }

      const costError = customAbilityCostError(
        resolveCustomAbilityCosts(
          character,
          definitions,
          source,
          inputs.rollValue,
          activationLevel,
        ),
      )
      if (costError) {
        setError(costError)
        return
      }

      if (sessionRuntime) {
        if (sessionRuntime.status !== "connected") {
          setError(
            "A sessão está desconectada. Não foi possível usar esta habilidade.",
          )
          return
        }

        const sent = sessionRuntime.dispatchAbilityOperation({
          type: "character.customSystem.ability.activate",
          characterId: character.get("id"),
          systemId: source.systemId,
          abilityId: source.abilityId,
          ...(inputs.rollValue !== undefined
            ? { rollValue: inputs.rollValue }
            : {}),
          ...(inputs.damageValues?.length
            ? { rollDamageValues: inputs.damageValues }
            : {}),
          ...(activationLevel !== undefined
            ? { activationLevel }
            : {}),
          ...(entry.customAbilityRoll
            ? { visibility: getRollVisibility() }
            : {}),
        })
        if (!sent) {
          setError("Não foi possível enviar esta habilidade para a sessão.")
          return
        }

        setSelected(null)
        return
      }

      const resolved = activateCustomAbilityWithRoll(
        character,
        definitions,
        source.systemId,
        source.abilityId,
        inputs.rollValue,
        activationLevel,
        inputs.damageValues,
      )
      if (resolved.roll) {
        setRollFeedback(customRollFeedback(resolved.roll, entry.name))
      }

      updateCharacter(
        character.get("id"),
        () => resolved.character,
      )
      if (!resolved.roll) setSelected(null)
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

      announce(entry)
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

      <CustomSystemActionResources character={character} updateCharacter={updateCharacter} />

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
        <Modal
          title={selected.name}
          onClose={() => {
            setAbilityResourceEntry(null)
            setSelected(null)
          }}
          className="max-w-lg"
        >
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
              {selectedCustomAbilityCosts.map((cost) => (
                <span key={cost.key}>
                  • Custo: {formatCustomAbilityCost(cost)}
                </span>
              ))}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>
            {rollFeedback.length > 0 ? (
              <div className="grid gap-2 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
                <div className="text-xs font-semibold text-textH">Resultado da rolagem</div>
                {rollFeedback.map((result, index) => (
                  <div key={`${result.label}-${index}`} className="rounded-lg border border-border bg-bg px-3 py-2 text-xs">
                    <div className="font-semibold text-textH">{result.label}</div>
                    <div className="mt-1 text-textMuted">
                      {result.dice ? `${result.dice} = ` : "Dado = "}
                      <span className="font-semibold text-textH">{result.diceValue}</span>
                      {result.formulaBonus ? (
                        <> {result.formulaBonus > 0 ? "+" : "−"} {Math.abs(result.formulaBonus)} de fórmula</>
                      ) : null}
                    </div>
                    <div className="mt-1 font-semibold text-accent">Total: {result.total}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {selected.activationLevelBase !== undefined ? (
              <label className="grid gap-1 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
                <span className="text-xs font-semibold text-textH">
                  {selected.activationLevelLabel?.trim() || "Nível de uso"}
                </span>
                <span className="text-[11px] leading-4 text-textMuted">
                  Escolha o nível desta ativação. Custos e fórmulas podem
                  escalar com esse valor.
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={selected.activationLevelBase}
                  max={selected.activationLevelMaximum}
                  step={1}
                  value={customActivationLevel}
                  onChange={(event) =>
                    setCustomActivationLevel(
                      clampActivationLevel(
                        Number(event.target.value),
                        selected.activationLevelBase!,
                        selected.activationLevelMaximum,
                      ),
                    )
                  }
                />
              </label>
            ) : null}
            {selected.customAbilityRoll
              && isManualCustomRoll(
                selected.customAbilityRoll,
                physicalDiceMode,
              ) ? (
              <div className="grid gap-2">
                {customRollRequiresManualPrimary(
                  selected.customAbilityRoll,
                ) ? (
                  <label className="grid gap-1 rounded-xl border border-accentBorder bg-accentBg/30 p-3">
                    <span className="text-xs font-semibold text-textH">
                      {selected.customAbilityRoll.label?.trim()
                        || customRollPrimaryLabel(
                          selected.customAbilityRoll,
                        )}
                    </span>
                    <span className="text-[11px] leading-4 text-textMuted">
                      {customRollPrimaryInstruction(
                        selected.customAbilityRoll,
                        physicalDiceMode,
                      )}
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={manualRollValue}
                      placeholder="Resultado"
                      onChange={(event) =>
                        setManualRollValue(event.target.value)
                      }
                    />
                  </label>
                ) : null}

                {(selected.customAbilityRoll.damage ?? []).map(
                  (damage, damageIndex) => (
                    <label
                      key={damage.id}
                      className="grid gap-1 rounded-xl border border-border bg-bg-subtle p-3"
                    >
                      <span className="text-xs font-semibold text-textH">
                        {damage.label?.trim()
                          || damage.damageType?.trim()
                          || `Dano ${damageIndex + 1}`}
                      </span>
                      <span className="text-[11px] leading-4 text-textMuted">
                        Role {damage.dice}
                        {physicalDiceMode
                          ? " com seus dados físicos"
                          : ""}
                        {" "}e informe o resultado somente dos dados.
                        {(selected.customAbilityRoll?.kind ?? "generic")
                          === "attack"
                          && damage.critical !== false
                          ? " Em um 20 natural, dobre os dados deste componente."
                          : ""}
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={manualDamageValues[damageIndex] ?? ""}
                        placeholder="Dano rolado"
                        onChange={(event) =>
                          setManualDamageValues((current) => {
                            const next = [...current]
                            next[damageIndex] = event.target.value
                            return next
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            ) : selected.customAbilityRoll?.mode === "automatic"
                && digitalDiceEnabled ? (
              <div className="rounded-xl border border-accentBorder bg-accentBg/30 p-3 text-xs leading-5 text-textMuted">
                <span className="font-semibold text-textH">
                  {customRollAutomaticSummary(
                    selected.customAbilityRoll,
                  )}
                </span>
                <div>
                  O servidor resolve esta rolagem ao confirmar o uso.
                </div>
              </div>
            ) : null}
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
            {error || selectedCustomAbilityCostError ? (
              <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
                {error || selectedCustomAbilityCostError}
              </div>
            ) : null}

            <div className="flex justify-end border-t border-border pt-3">
              <Button variant="secondary" onClick={() => announce(selected)}>
                Mostrar
              </Button>
            </div>
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
                <Button
                  variant="primary"
                  disabled={
                    !areCustomRollInputsReady(
                      selected.customAbilityRoll,
                      physicalDiceMode,
                      manualRollValue,
                      manualDamageValues,
                    )
                  }
                  onClick={() => useCustomSystemAction(selected)}
                >Usar</Button>
              </div>
            ) : selected.customAbilitySource ? (
              <div className="flex justify-end border-t border-border pt-3">
                <Button
                  variant="primary"
                  disabled={
                    Boolean(selectedCustomAbilityCostError)
                    || !areCustomRollInputsReady(
                      selected.customAbilityRoll,
                      physicalDiceMode,
                      manualRollValue,
                      manualDamageValues,
                    )
                  }
                  onClick={() => useCustomAbility(selected)}
                >
                  Usar
                </Button>
              </div>
            ) : selected.ability && abilityRequiresActivation(selected.ability) ? (
              <div className="grid gap-2 border-t border-border pt-3">
                {isAbilityBenefitsActive(selected.ability) && !selected.ability.allowOptionSwitching ? (
                  <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>Encerrar efeito</Button>
                  </div>
                ) : hasAbilityResourceCosts(selected.ability)
                    || selected.ability.resourceUpcast?.enabled
                    || hasManualBonusRolls(selected.ability.bonuses)
                    || (
                      physicalDiceMode
                      && listBonusRollRequirements(selected.ability.bonuses).length > 0
                    ) ? (
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={() => setAbilityResourceEntry(selected)}>
                      Configurar e usar
                    </Button>
                  </div>
                ) : (selected.ability.activationOptions?.length ?? 0) > 0 ? (
                  <>
                    <div className="text-xs font-semibold text-textH">Escolha o efeito</div>
                    {isAbilityBenefitsActive(selected.ability) ? (
                      <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>Encerrar efeito</Button>
                      </div>
                    ) : null}
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

      {abilityResourceEntry?.ability ? (
        <AbilityResourceActivationModal
          key={abilityResourceEntry.id}
          ability={abilityResourceEntry.ability}
          character={character}
          forceManualRolls={physicalDiceMode}
          onClose={() => setAbilityResourceEntry(null)}
          onConfirm={(optionId, resourceSelection, bonusRollValues) =>
            changeAbilityState(abilityResourceEntry, "use", optionId, resourceSelection, bonusRollValues)
          }
        />
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
              {entry.customAbilityRoll ? (
                <span className="mt-1 block text-[10px] font-medium text-accent">
                  {entry.customAbilityRoll.mode === "automatic" ? "rolagem automática" : "rolagem manual"}
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
        customAbilityRoll: action.roll,
        activationLevelBase: action.level
          ? Math.max(1, Math.floor(action.level.baseLevel))
          : undefined,
        activationLevelMaximum:
          action.level?.maximumLevel === undefined
            ? undefined
            : Math.max(
                Math.max(1, Math.floor(action.level.baseLevel)),
                Math.floor(action.level.maximumLevel),
              ),
        activationLevelLabel: action.level?.label,
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

  const scalableCosts = (activation.resourceChanges ?? []).filter(
    (change) =>
      change.operation === "spend"
      && (change.upcastAmountPerLevel ?? 0) > 0,
  )
  const legacyBase =
    scalableCosts.length > 0
      ? Math.min(
          ...scalableCosts.map((change) =>
            Math.max(1, Math.floor(change.upcastBaseLevel ?? 1)),
          ),
        )
      : undefined
  const activationLevelBase = activation.level
    ? Math.max(1, Math.floor(activation.level.baseLevel))
    : legacyBase
  const activationLevelMaximum =
    activation.level?.maximumLevel === undefined
      ? undefined
      : Math.max(
          Math.max(1, Math.floor(activation.level.baseLevel)),
          Math.floor(activation.level.maximumLevel),
        )

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
    customAbilityRoll: activation.roll,
    activationLevelBase,
    activationLevelMaximum,
    activationLevelLabel: activation.level?.label,
  }
}

function resolveCustomAbilityCosts(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  source: CustomAbilitySource,
  rollValue?: number,
  activationLevel?: number,
): CustomAbilityCostPreview[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const state = states.find((entry) => entry.systemId === source.systemId)
  const definition = definitions.find((entry) => entry.id === source.systemId)
  const ability = state?.abilities.find((entry) => entry.id === source.abilityId)
  const type = ability && definition?.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!state || !definition || !ability || !type) return []

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  return (activation.resourceChanges ?? [])
    .filter((change) => change.operation === "spend")
    .map((change) => {
      const amount = resolveCustomAbilityCostAmount(
        change,
        definition,
        state,
        type,
        ability,
        character,
        rollValue,
        activationLevel,
        activation.level?.baseLevel ?? 1,
      )

      if (change.target.source === "native") {
        const current = nativeResourcePreviewValue(character, change.target.resource)
        const sufficient = amount === undefined
          ? undefined
          : change.target.resource === "hitPoints" || current >= amount
        return {
          key: change.id,
          name: nativeResourcePreviewName(change.target.resource),
          amount,
          current,
          sufficient,
        }
      }

      const targetState = states.find(
        (entry) => entry.systemId === change.target.systemId,
      )
      const targetDefinition = definitions.find(
        (entry) => entry.id === change.target.systemId,
      )
      const resource = targetDefinition?.resources.find(
        (entry) => entry.id === change.target.resourceId,
      )
      const resourceState = targetState?.resources[change.target.resourceId]
      if (!resource || !resourceState) {
        return {
          key: change.id,
          name: resource?.name || change.target.resourceId,
          amount,
          sufficient: false,
          unavailable: true,
        }
      }

      const minimum = resource.minimum ?? 0
      return {
        key: change.id,
        name: resource.name,
        amount,
        current: resourceState.current,
        sufficient: amount === undefined
          ? undefined
          : resourceState.current - amount >= minimum,
      }
    })
}

function resolveCustomAbilityCostAmount(
  change: NonNullable<ReturnType<typeof getEffectiveCustomAbilityActivation>["resourceChanges"]>[number],
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: NonNullable<CustomSystemDefinition["abilityTypes"]>[number],
  ability: CustomAbilityInstance,
  character: CharacterTemplate,
  rollValue?: number,
  activationLevel?: number,
  activationBaseLevel = 1,
): number | undefined {
  const applyUpcast = (baseAmount: number) => {
    if (change.operation !== "spend") return baseAmount
    const perLevel = Math.max(0, change.upcastAmountPerLevel ?? 0)
    if (perLevel <= 0) return baseAmount
    const baseLevel = Math.max(
      1,
      Math.floor(change.upcastBaseLevel ?? activationBaseLevel),
    )
    const resolvedLevel = Math.max(
      baseLevel,
      Math.floor(activationLevel ?? baseLevel),
    )
    return baseAmount + (resolvedLevel - baseLevel) * perLevel
  }

  if (!change.formula?.trim()) {
    return applyUpcast(Math.max(0, change.amount ?? 0))
  }

  let formula = change.formula
  if (formula.includes("roll.value")) {
    if (rollValue === undefined) return undefined
    formula = formula.replace(
      /(^|[^A-Za-z0-9_.-])roll\.value(?=$|[^A-Za-z0-9_.-])/g,
      (_match, prefix: string) => `${prefix}(${rollValue})`,
    )
  }

  const result = evaluateCustomFormula(
    formula,
    definition,
    state,
    character,
    { type, values: ability.values },
    {
      level: activationLevel ?? activationBaseLevel,
      baseLevel: activationBaseLevel,
      scope: "ability",
    },
  )
  if (!result.ok || typeof result.value !== "number" || !Number.isFinite(result.value)) {
    return undefined
  }
  return applyUpcast(Math.max(0, result.value))
}

function customAbilityCostError(costs: CustomAbilityCostPreview[]): string {
  const unavailable = costs.find((cost) => cost.unavailable)
  if (unavailable) return `O recurso “${unavailable.name}” não está disponível.`
  const insufficient = costs.find((cost) => cost.sufficient === false)
  return insufficient ? `Não há ${insufficient.name} suficiente.` : ""
}

function formatCustomAbilityCost(cost: CustomAbilityCostPreview): string {
  if (cost.amount === undefined) return `variável de ${cost.name}`
  return `${formatResourceAmount(cost.amount)} ${cost.name}`
}

function formatResourceAmount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function nativeResourcePreviewName(
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
): string {
  if (resource === "hitPoints") return "Pontos de Vida"
  if (resource === "temporaryHitPoints") return "Pontos de Vida temporários"
  if (resource === "inspiration") return "Inspiração"
  return "Exaustão"
}

function nativeResourcePreviewValue(
  character: CharacterTemplate,
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
): number {
  if (resource === "hitPoints") return character.get("sheet").HP.current
  if (resource === "temporaryHitPoints") return character.get("sheet").HP.temporary ?? 0
  if (resource === "inspiration") return character.get("sheet").stats.inspiration ? 1 : 0
  return character.get("sheet").stats.exhaustion ?? 0
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

function isManualCustomRoll(
  roll: CustomAbilityRollDefinition | undefined,
  physicalDiceMode: boolean,
): boolean {
  return Boolean(
    roll
    && (roll.mode === "manual" || physicalDiceMode),
  )
}

function readCustomRollInputs(
  roll: CustomAbilityRollDefinition | undefined,
  manual: boolean,
  primaryInput: string,
  damageInputs: string[],
):
  | {
      ok: true
      rollValue?: number
      damageValues?: number[]
    }
  | { ok: false; error: string } {
  if (!roll || !manual) return { ok: true }

  let rollValue: number | undefined
  if (customRollRequiresManualPrimary(roll)) {
    if (!isFiniteInput(primaryInput)) {
      return {
        ok: false,
        error: "Informe um resultado numérico válido para a rolagem principal.",
      }
    }
    rollValue = Number(primaryInput)
  }

  const damageCount = customRollManualDamageCount(roll)
  let damageValues: number[] | undefined
  if (damageCount > 0) {
    const values = damageInputs.slice(0, damageCount)
    if (
      values.length < damageCount
      || values.some((value) => !isFiniteInput(value))
    ) {
      return {
        ok: false,
        error: `Informe os ${damageCount} resultado(s) de dano antes de usar.`,
      }
    }
    damageValues = values.map(Number)
  }

  return { ok: true, rollValue, damageValues }
}

function areCustomRollInputsReady(
  roll: CustomAbilityRollDefinition | undefined,
  physicalDiceMode: boolean,
  primaryInput: string,
  damageInputs: string[],
): boolean {
  if (!roll || !isManualCustomRoll(roll, physicalDiceMode)) {
    return true
  }
  return readCustomRollInputs(
    roll,
    true,
    primaryInput,
    damageInputs,
  ).ok
}

function customRollFeedback(
  roll: CustomAbilityRollResolution,
  fallbackLabel: string,
): Array<{
  label: string
  dice?: string
  diceValue: number
  formulaBonus?: number
  total: number
}> {
  const feedback: Array<{
    label: string
    dice?: string
    diceValue: number
    formulaBonus?: number
    total: number
  }> = []

  if (
    roll.kind === "attack"
    || roll.kind === "abilityCheck"
    || roll.kind === "savingThrow"
    || roll.kind === "generic"
  ) {
    feedback.push({
      label:
        roll.kind === "attack"
          ? "Ataque"
          : roll.kind === "abilityCheck"
            ? "Teste"
            : roll.kind === "savingThrow"
              ? "Resistência"
              : fallbackLabel,
      dice: roll.dice,
      diceValue: roll.natural ?? roll.value,
      formulaBonus: roll.modifier ?? (
        (roll.total ?? roll.value) - roll.value
      ),
      total: roll.total ?? roll.value,
    })
  } else if (roll.kind === "targetSave") {
    feedback.push({
      label: `CD ${roll.saveAttribute?.toUpperCase() ?? ""}`.trim(),
      diceValue: roll.dc ?? roll.value,
      total: roll.dc ?? roll.value,
    })
  }

  for (const damage of roll.damages ?? []) {
    feedback.push({
      label:
        damage.label?.trim()
        || damage.damageType?.trim()
        || "Dano",
      dice: damage.dice,
      diceValue: damage.value,
      formulaBonus: damage.modifier,
      total: damage.total,
    })
  }

  return feedback
}

function customRollPrimaryLabel(
  roll: CustomAbilityRollDefinition,
): string {
  switch (roll.kind ?? "generic") {
    case "attack":
      return "Resultado do d20 do ataque"
    case "abilityCheck":
      return "Resultado do d20 do teste"
    case "savingThrow":
      return "Resultado do d20 da resistência"
    default:
      return "Resultado da rolagem"
  }
}

function customRollPrimaryInstruction(
  roll: CustomAbilityRollDefinition,
  physicalDiceMode: boolean,
): string {
  const physical = physicalDiceMode
    ? " com seus dados físicos"
    : ""
  const kind = roll.kind ?? "generic"

  if (
    kind === "attack"
    || kind === "abilityCheck"
    || kind === "savingThrow"
  ) {
    const mode =
      roll.d20Mode === "advantage"
        ? " com vantagem"
        : roll.d20Mode === "disadvantage"
          ? " com desvantagem"
          : ""
    return `Role 1d20${mode}${physical} e informe o valor mantido. O sistema soma os modificadores configurados.`
  }

  return roll.dice?.trim()
    ? `Role ${roll.dice}${physical} e informe o resultado.`
    : "Informe o resultado obtido."
}

function customRollAutomaticSummary(
  roll: CustomAbilityRollDefinition,
): string {
  const kind = roll.kind ?? "generic"
  const damageCount = roll.damage?.length ?? 0
  const base =
    kind === "attack"
      ? "Ataque automático"
      : kind === "abilityCheck"
        ? "Teste automático"
        : kind === "savingThrow"
          ? "Resistência automática"
          : kind === "targetSave"
            ? "CD de resistência do alvo"
            : kind === "damage"
              ? "Dano automático"
              : "Rolagem automática"
  return damageCount > 0
    ? `${base} · ${damageCount} componente(s) de dano`
    : base
}

function resolveEntryActivationLevel(
  entry: ActionEntry,
  requested: number,
): number | undefined {
  if (entry.activationLevelBase === undefined) return undefined
  const level = clampActivationLevel(
    requested,
    entry.activationLevelBase,
    entry.activationLevelMaximum,
  )
  if (!Number.isInteger(level)) {
    throw new Error("O nível de uso precisa ser um número inteiro.")
  }
  return level
}

function clampActivationLevel(
  value: number,
  base: number,
  maximum?: number,
): number {
  const normalizedBase = Math.max(1, Math.floor(base))
  const finite = Number.isFinite(value) ? Math.floor(value) : normalizedBase
  const atLeastBase = Math.max(normalizedBase, finite)
  return maximum === undefined
    ? atLeastBase
    : Math.min(Math.max(normalizedBase, Math.floor(maximum)), atLeastBase)
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

function isFiniteInput(value: string): boolean {
  if (!value.trim()) return false
  return Number.isFinite(Number(value))
}
