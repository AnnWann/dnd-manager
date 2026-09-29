import { useMemo, useState } from "react"
import { Play } from "lucide-react"
import { requestActionAnnouncement } from "../../../../../../lib/diceRoller"

import type { AbilityActionKind } from "../../../../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type {
  CustomAbilityRollDefinition,
  CustomAbilityTypeDefinition,
} from "../../../../../../models/customSystems/CustomAbilityDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../../../../models/customSystems/CustomSystemDefinition"
import {
  evaluateCustomFormula,
  getCustomAbilityAvailability,
} from "../../../../../../lib/customSystems"
import {
  activateCustomAbilityWithRoll,
  activateCustomSystemActionWithRoll,
  customRollManualDamageCount,
  customRollRequiresManualPrimary,
} from "../../../../../../lib/customSystems/CustomAbilityRoll"
import {
  getEffectiveCustomAbilityActivation,
} from "../../../../../../lib/customSystems/CustomSystemActions"
import { useCustomSystemDefinitions } from "../../../../../../lib/customSystems/CustomSystemRegistry"
import type { SessionCustomSystemOperation } from "../../../../../session-runtime/customSystemSessionProtocol"
import { useOptionalSessionRuntime } from "../../../../../session-runtime/useSessionRuntime"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type SheetActionEntry = {
  key: string
  name: string
  description?: string
  source: string
  actionKind: AbilityActionKind
  disabled?: boolean
  status?: string
  roll?: CustomAbilityRollDefinition
  minimumActivationLevel?: number
  maximumActivationLevel?: number
  activationLevelLabel?: string
  operation?: SessionCustomSystemOperation
  activate: (
    character: CharacterTemplate,
    rollValue?: number,
    activationLevel?: number,
    damageValues?: number[],
  ) => CharacterTemplate
}

const CATEGORY_ORDER: AbilityActionKind[] = [
  "action",
  "bonusAction",
  "reaction",
  "free",
  "legendaryAction",
  "legendaryReaction",
  "legendaryResistance",
]

const CATEGORY_LABELS: Record<AbilityActionKind, string> = {
  action: "Ações",
  bonusAction: "Ações bônus",
  reaction: "Reações",
  free: "Ações livres",
  legendaryAction: "Ações lendárias",
  legendaryReaction: "Reações lendárias",
  legendaryResistance: "Resistências lendárias",
}

export function hasCustomSystemSheetActions(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
): boolean {
  return buildEntries(character, definitions).length > 0
}

export function CustomSystemActionsPanel({
  character,
  updateCharacter,
}: Props) {
  const definitions = useCustomSystemDefinitions()
  const sessionRuntime = useOptionalSessionRuntime()
  const digitalDiceEnabled =
    sessionRuntime?.runtimeConfigSnapshot?.config.diceRollingEnabled !== false
  const physicalDiceMode = Boolean(sessionRuntime) && !digitalDiceEnabled
  const [error, setError] = useState("")
  const [manualRollValues, setManualRollValues] =
    useState<Record<string, string>>({})
  const [manualDamageValues, setManualDamageValues] =
    useState<Record<string, string[]>>({})
  const [activationLevels, setActivationLevels] = useState<Record<string, string>>({})
  const entries = useMemo(
    () => buildEntries(character, definitions),
    [character, definitions],
  )

  if (!entries.length) return null

  function activate(entry: SheetActionEntry) {
    try {
      setError("")
      let rollValue: number | undefined
      let damageValues: number[] | undefined
      const manualResolution =
        Boolean(entry.roll)
        && (entry.roll!.mode === "manual" || physicalDiceMode)

      if (
        entry.roll
        && manualResolution
        && customRollRequiresManualPrimary(entry.roll)
      ) {
        const raw = manualRollValues[entry.key]?.trim() ?? ""
        if (!raw || !Number.isFinite(Number(raw))) {
          setError(
            `Informe um resultado numérico válido para ${entry.roll.label?.trim() || entry.name}.`,
          )
          return
        }
        rollValue = Number(raw)
      }

      if (entry.roll && manualResolution) {
        const damageCount = customRollManualDamageCount(entry.roll)
        if (damageCount > 0) {
          const rawValues = manualDamageValues[entry.key] ?? []
          if (
            rawValues.length < damageCount
            || rawValues.slice(0, damageCount).some(
              (value) => !value.trim() || !Number.isFinite(Number(value)),
            )
          ) {
            setError(
              `Informe os ${damageCount} resultado(s) de dano para ${entry.name}.`,
            )
            return
          }
          damageValues = rawValues
            .slice(0, damageCount)
            .map((value) => Number(value))
        }
      }

      let activationLevel: number | undefined
      if (entry.minimumActivationLevel !== undefined) {
        const rawLevel = activationLevels[entry.key]?.trim() || String(entry.minimumActivationLevel)
        const parsedLevel = Number(rawLevel)
        if (
          !Number.isInteger(parsedLevel)
          || parsedLevel < entry.minimumActivationLevel
          || (
            entry.maximumActivationLevel !== undefined
            && parsedLevel > entry.maximumActivationLevel
          )
        ) {
          const range =
            entry.maximumActivationLevel === undefined
              ? `igual ou maior que ${entry.minimumActivationLevel}`
              : `entre ${entry.minimumActivationLevel} e ${entry.maximumActivationLevel}`
          setError(
            `Informe um nível de uso inteiro ${range} para ${entry.name}.`,
          )
          return
        }
        activationLevel = parsedLevel
      }

      if (sessionRuntime && entry.operation) {
        let operation: SessionCustomSystemOperation = entry.operation
        if (
          (
            operation.type === "character.customSystem.ability.activate"
            || operation.type === "character.customSystem.action.execute"
          )
          && activationLevel !== undefined
        ) {
          operation = { ...operation, activationLevel }
        }
        if (
          (
            operation.type === "character.customSystem.ability.activate"
            || operation.type === "character.customSystem.action.execute"
          )
          && rollValue !== undefined
        ) {
          operation = { ...operation, rollValue }
        }
        if (
          (
            operation.type === "character.customSystem.ability.activate"
            || operation.type === "character.customSystem.action.execute"
          )
          && damageValues?.length
        ) {
          operation = { ...operation, rollDamageValues: damageValues }
        }
        const sent = sessionRuntime.dispatchAbilityOperation(operation)
        if (!sent) {
          setError("Não foi possível enviar esta ação para a sessão.")
          return
        }
        requestActionAnnouncement({
          characterId: character.get("id"),
          title: entry.name,
          subtitle: `${CATEGORY_LABELS[entry.actionKind]} · ${entry.source}`,
          description: entry.description,
        })
        return
      }
      updateCharacter(
        character.get("id"),
        (current) =>
          entry.activate(
            current,
            rollValue,
            activationLevel,
            damageValues,
          ),
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível executar esta ação.",
      )
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div>
        <h2 className="text-sm font-semibold text-textH">Ações</h2>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Ações e habilidades fornecidas pelos sistemas personalizados ativos.
        </p>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {CATEGORY_ORDER.map((kind) => {
          const categoryEntries = entries.filter(
            (entry) => entry.actionKind === kind,
          )
          if (!categoryEntries.length) return null

          return (
            <div key={kind} className="grid gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
                {CATEGORY_LABELS[kind]}
              </h3>
              <div className="grid gap-2">
                {categoryEntries.map((entry) => {
                  const manualValue =
                    manualRollValues[entry.key] ?? ""
                  const manualResolution =
                    Boolean(entry.roll)
                    && (
                      entry.roll!.mode === "manual"
                      || physicalDiceMode
                    )
                  const primaryRequired =
                    Boolean(entry.roll)
                    && customRollRequiresManualPrimary(entry.roll!)
                  const damageCount = entry.roll
                    ? customRollManualDamageCount(entry.roll)
                    : 0
                  const damageInputs =
                    manualDamageValues[entry.key] ?? []
                  const primaryInvalid =
                    manualResolution
                    && primaryRequired
                    && (
                      !manualValue.trim()
                      || !Number.isFinite(Number(manualValue))
                    )
                  const damagesInvalid =
                    manualResolution
                    && damageCount > 0
                    && (
                      damageInputs.length < damageCount
                      || damageInputs
                        .slice(0, damageCount)
                        .some(
                          (value) =>
                            !value.trim()
                            || !Number.isFinite(Number(value)),
                        )
                    )
                  const manualInvalid =
                    primaryInvalid || damagesInvalid
                  return (
                    <article
                      key={entry.key}
                      className="rounded-xl border border-border bg-bg-subtle p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-semibold text-textH">
                            {entry.name}
                          </div>
                          <div className="mt-1 text-[10px] text-textMuted">
                            {entry.source}
                            {entry.status ? ` · ${entry.status}` : ""}
                          </div>
                          {entry.description ? (
                            <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-textMuted">
                              {entry.description}
                            </p>
                          ) : null}
                          {entry.minimumActivationLevel !== undefined ? (
                            <label className="mt-3 grid gap-1 rounded-lg border border-accentBorder bg-accentBg/30 p-2">
                              <span className="text-[11px] font-semibold text-textH">
                                {entry.activationLevelLabel || "Nível de uso"}
                              </span>
                              <span className="text-[10px] text-textMuted">
                                O nível escolhido fica disponível para fórmulas e custos escaláveis desta ativação.
                              </span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={entry.minimumActivationLevel}
                                max={entry.maximumActivationLevel}
                                step={1}
                                value={activationLevels[entry.key] ?? String(entry.minimumActivationLevel)}
                                onChange={(event) => setActivationLevels((current) => ({ ...current, [entry.key]: event.target.value }))}
                                className="input-base h-8"
                              />
                            </label>
                          ) : null}
                          {entry.roll && manualResolution ? (
                            <div className="mt-3 grid gap-2">
                              {primaryRequired ? (
                                <label className="grid gap-1 rounded-lg border border-accentBorder bg-accentBg/30 p-2">
                                  <span className="text-[11px] font-semibold text-textH">
                                    {entry.roll.label?.trim()
                                      || manualPrimaryLabel(entry.roll)}
                                  </span>
                                  <span className="text-[10px] text-textMuted">
                                    {manualPrimaryInstruction(
                                      entry.roll,
                                      physicalDiceMode,
                                    )}
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={manualValue}
                                    placeholder="Resultado"
                                    onChange={(event) =>
                                      setManualRollValues((current) => ({
                                        ...current,
                                        [entry.key]: event.target.value,
                                      }))
                                    }
                                    className="input-base h-8"
                                  />
                                </label>
                              ) : null}

                              {(entry.roll.damage ?? []).map(
                                (damage, damageIndex) => (
                                  <label
                                    key={damage.id}
                                    className="grid gap-1 rounded-lg border border-border bg-bg p-2"
                                  >
                                    <span className="text-[11px] font-semibold text-textH">
                                      {damage.label?.trim()
                                        || damage.damageType?.trim()
                                        || `Dano ${damageIndex + 1}`}
                                    </span>
                                    <span className="text-[10px] text-textMuted">
                                      Role {damage.dice}
                                      {physicalDiceMode
                                        ? " com seus dados físicos"
                                        : ""}
                                      {" "}e informe o resultado apenas dos dados.
                                    </span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={damageInputs[damageIndex] ?? ""}
                                      placeholder="Dano rolado"
                                      onChange={(event) =>
                                        setManualDamageValues((current) => {
                                          const next = [
                                            ...(current[entry.key] ?? []),
                                          ]
                                          next[damageIndex] =
                                            event.target.value
                                          return {
                                            ...current,
                                            [entry.key]: next,
                                          }
                                        })
                                      }
                                      className="input-base h-8"
                                    />
                                  </label>
                                ),
                              )}
                            </div>
                          ) : entry.roll?.mode === "automatic" && digitalDiceEnabled ? (
                            <div className="mt-2 text-[10px] font-medium text-accent">
                              {automaticRollSummary(entry.roll)}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              requestActionAnnouncement({
                                characterId: character.get("id"),
                                title: entry.name,
                                subtitle: `${CATEGORY_LABELS[entry.actionKind]} · ${entry.source}`,
                                description: entry.description,
                              })
                            }
                            className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-textH hover:border-accentBorder hover:bg-accentBg"
                          >
                            Mostrar
                          </button>
                          <button
                            type="button"
                            disabled={entry.disabled || manualInvalid}
                            onClick={() => activate(entry)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH hover:bg-bg disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Usar
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function buildEntries(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
): SheetActionEntry[] {
  const states = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const entries: SheetActionEntry[] = []
  const characterId = character.get("id")

  for (const state of states) {
    if (state.enabled === false) continue
    const definition = definitions.find((entry) => entry.id === state.systemId)
    if (!definition || definition.hiddenFromSheet) continue

    for (const action of definition.actions ?? []) {
      if (action.enabled === false) continue
      entries.push({
        key: `system:${definition.id}:action:${action.id}`,
        name: action.name,
        description: action.description,
        source: definition.name,
        actionKind: action.actionKind,
        roll: action.roll,
        minimumActivationLevel: action.level
          ? Math.max(1, Math.floor(action.level.baseLevel))
          : undefined,
        maximumActivationLevel: action.level?.maximumLevel === undefined
          ? undefined
          : Math.max(
              Math.max(1, Math.floor(action.level.baseLevel)),
              Math.floor(action.level.maximumLevel),
            ),
        activationLevelLabel: action.level?.label,
        operation: {
          type: "character.customSystem.action.execute",
          characterId,
          systemId: definition.id,
          actionId: action.id,
        },
        activate: (
          current,
          rollValue,
          activationLevel,
          damageValues,
        ) =>
          activateCustomSystemActionWithRoll(
            current,
            definitions,
            definition.id,
            action.id,
            rollValue,
            activationLevel,
            damageValues,
          ).character,
      })
    }

    for (const ability of state.abilities) {
      const entry = abilityEntry(character, definitions, definition, state, ability)
      if (entry) entries.push(entry)
    }
  }

  return entries.sort(
    (left, right) =>
      CATEGORY_ORDER.indexOf(left.actionKind) -
        CATEGORY_ORDER.indexOf(right.actionKind) ||
      left.name.localeCompare(right.name, "pt-BR"),
  )
}

function abilityEntry(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  ability: CustomAbilityInstance,
): SheetActionEntry | undefined {
  if (ability.enabled === false) return undefined
  const type = definition.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!type) return undefined

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  if (!activation.actionKind) return undefined

  const preset = type.predefinedAbilities?.find(
    (entry) => entry.id === ability.predefinedAbilityId,
  )
  const effectiveType = preset?.acquisition
    ? {
        ...type,
        acquisition: { ...type.acquisition, ...preset.acquisition },
      }
    : type
  const availability = getCustomAbilityAvailability(effectiveType, ability)
  if (!availability.canUse) return undefined

  const usage = resolveUsageDisplay(
    activation.usage,
    type,
    ability,
    definition,
    state,
    character,
  )
  const scalableCosts = (activation.resourceChanges ?? []).filter(
    (change) =>
      change.operation === "spend"
      && (change.upcastAmountPerLevel ?? 0) > 0,
  )
  const legacyMinimumActivationLevel =
    scalableCosts.length > 0
      ? Math.min(
          ...scalableCosts.map((change) =>
            Math.max(1, Math.floor(change.upcastBaseLevel ?? 1)),
          ),
        )
      : undefined
  const minimumActivationLevel = activation.level
    ? Math.max(1, Math.floor(activation.level.baseLevel))
    : legacyMinimumActivationLevel
  const maximumActivationLevel =
    activation.level?.maximumLevel === undefined
      ? undefined
      : Math.max(
          Math.max(1, Math.floor(activation.level.baseLevel)),
          Math.floor(activation.level.maximumLevel),
        )
  const title = displayValue(ability.values[type.display.titleFieldId]) || type.name
  const description = type.display.descriptionFieldId
    ? displayValue(ability.values[type.display.descriptionFieldId])
    : preset?.description ?? type.description

  return {
    key: `system:${definition.id}:ability:${ability.id}`,
    name: title,
    description,
    source: `${definition.name} · ${type.name}`,
    actionKind: activation.actionKind,
    disabled: usage.remaining === 0,
    status: usage.mode === "unlimited"
      ? "usos ilimitados"
      : usage.maximum === undefined
        ? undefined
        : `${usage.remaining}/${usage.maximum} usos`,
    roll: activation.roll,
    minimumActivationLevel,
    maximumActivationLevel,
    activationLevelLabel: activation.level?.label,
    operation: {
      type: "character.customSystem.ability.activate",
      characterId: character.get("id"),
      systemId: definition.id,
      abilityId: ability.id,
    },
    activate: (
      current,
      rollValue,
      activationLevel,
      damageValues,
    ) =>
      activateCustomAbilityWithRoll(
        current,
        definitions,
        definition.id,
        ability.id,
        rollValue,
        activationLevel,
        damageValues,
      ).character,
  }
}

function resolveUsageDisplay(
  usage: ReturnType<typeof getEffectiveCustomAbilityActivation>["usage"],
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): {
  mode: "unlimited" | "limited"
  maximum?: number
  remaining?: number
} {
  if (!usage || (usage.mode ?? "limited") === "unlimited") {
    return { mode: "unlimited" }
  }

  let maximum = usage.maximum
  if (usage.maximumFormula?.trim()) {
    const result = evaluateCustomFormula(
      usage.maximumFormula,
      definition,
      state,
      character,
      { type, values: ability.values },
    )
    if (
      result.ok &&
      typeof result.value === "number" &&
      Number.isFinite(result.value)
    ) {
      maximum = Math.max(0, Math.floor(result.value))
    }
  } else if (ability.usage?.maximum !== undefined) {
    maximum = ability.usage.maximum
  }

  const used = ability.usage?.used ?? 0
  return {
    mode: "limited",
    maximum,
    remaining:
      maximum === undefined ? undefined : Math.max(0, maximum - used),
  }
}

function manualPrimaryLabel(
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

function manualPrimaryInstruction(
  roll: CustomAbilityRollDefinition,
  physicalDiceMode: boolean,
): string {
  const suffix = physicalDiceMode ? " com seus dados físicos" : ""
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
    return `Role 1d20${mode}${suffix} e informe o valor mantido do dado. O sistema soma os modificadores.`
  }
  return roll.dice?.trim()
    ? `Role ${roll.dice}${suffix} e informe o resultado dos dados.`
    : "Informe o resultado obtido antes de usar."
}

function automaticRollSummary(
  roll: CustomAbilityRollDefinition,
): string {
  const kind = roll.kind ?? "generic"
  const damageCount = roll.damage?.length ?? 0
  const base =
    kind === "attack"
      ? "Ataque automático · 1d20"
      : kind === "abilityCheck"
        ? "Teste automático · 1d20"
        : kind === "savingThrow"
          ? "Resistência automática · 1d20"
          : kind === "targetSave"
            ? "CD de resistência do alvo"
            : kind === "damage"
              ? "Dano automático"
              : `Rolagem automática${roll.dice?.trim() ? ` · ${roll.dice}` : ""}`
  return damageCount > 0
    ? `${base} · ${damageCount} componente(s) de dano`
    : base
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return ""
}
