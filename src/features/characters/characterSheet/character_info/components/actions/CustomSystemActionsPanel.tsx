import { useMemo, useState } from "react"
import { Play } from "lucide-react"

import type { AbilityActionKind } from "../../../../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { CustomAbilityTypeDefinition } from "../../../../../../models/customSystems/CustomAbilityDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../../../../../models/customSystems/CustomSystemDefinition"
import {
  activateCustomAbility,
  evaluateCustomFormula,
  getCustomAbilityAvailability,
} from "../../../../../../lib/customSystems"
import {
  activateCustomSystemAction,
  getEffectiveCustomAbilityActivation,
} from "../../../../../../lib/customSystems/CustomSystemActions"
import { useCustomSystemDefinitions } from "../../../../../../lib/customSystems/CustomSystemRegistry"

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
  activate: (character: CharacterTemplate) => CharacterTemplate
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
  const [error, setError] = useState("")
  const entries = useMemo(
    () => buildEntries(character, definitions),
    [character, definitions],
  )

  if (!entries.length) return null

  function activate(entry: SheetActionEntry) {
    try {
      setError("")
      updateCharacter(character.get("id"), (current) => entry.activate(current))
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
                {categoryEntries.map((entry) => (
                  <article
                    key={entry.key}
                    className="rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
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
                      </div>

                      <button
                        type="button"
                        disabled={entry.disabled}
                        onClick={() => activate(entry)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH hover:bg-bg disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Usar
                      </button>
                    </div>
                  </article>
                ))}
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

  for (const state of states) {
    if (state.enabled === false) continue
    const definition = definitions.find((entry) => entry.id === state.systemId)
    if (!definition) continue

    for (const action of definition.actions ?? []) {
      if (action.enabled === false) continue
      entries.push({
        key: `system:${definition.id}:action:${action.id}`,
        name: action.name,
        description: action.description,
        source: definition.name,
        actionKind: action.actionKind,
        activate: (current) =>
          activateCustomSystemAction(
            current,
            definitions,
            definition.id,
            action.id,
          ),
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
  const usage = resolveUsageDisplay(
    activation.usage,
    type,
    ability,
    definition,
    state,
    character,
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
    disabled: !availability.canUse || usage.remaining === 0,
    status: !availability.canUse
      ? "indisponível"
      : usage.mode === "unlimited"
        ? "usos ilimitados"
        : usage.maximum === undefined
          ? undefined
          : `${usage.remaining}/${usage.maximum} usos`,
    activate: (current) =>
      activateCustomAbility(current, definitions, definition.id, ability.id),
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

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return ""
}
