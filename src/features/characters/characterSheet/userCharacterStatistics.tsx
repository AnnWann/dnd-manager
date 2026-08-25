import { Check, Sparkles } from "lucide-react"

import { Input } from "../../../components/ui/Input"
import { attributeShort } from "../../../lib/attributeShorts"
import { cn } from "../../../lib/cn"
import { formatSigned } from "../../../lib/formatSigned"
import { clampInt } from "../../../lib/numberFormat"
import {
  getCalculatedInitiative,
  getCalculatedMobility,
  getCalculatedPassivePerception,
  getStatAdjustmentKey,
  type CalculatedStatKey,
} from "../../../models/characters/characterStats"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getCalculatedArmorClassWithShield,
  getEffectiveArmorClassWithShield,
} from "../../../models/items/equipment/Shield"
import { ATTRIBUTE_KEYS, type Attribute } from "../../../models/sheet/Attribute"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type CalculatedStatDefinition = {
  key: CalculatedStatKey
  label: string
  getValue: (character: CharacterTemplate) => number
  getCalculatedValue: (character: CharacterTemplate) => number
}

const CALCULATED_STATS: CalculatedStatDefinition[] = [
  {
    key: "armorClass",
    label: "CA",
    getValue: getEffectiveArmorClassWithShield,
    getCalculatedValue: getCalculatedArmorClassWithShield,
  },
  {
    key: "initiative",
    label: "Iniciativa",
    getValue: (character) => character.getEffectiveInitiative(),
    getCalculatedValue: getCalculatedInitiative,
  },
  {
    key: "mobility",
    label: "Deslocamento",
    getValue: (character) => character.getEffectiveMobility(),
    getCalculatedValue: getCalculatedMobility,
  },
  {
    key: "passive_perception",
    label: "Percepção passiva",
    getValue: (character) => character.getEffectivePassivePerception(),
    getCalculatedValue: getCalculatedPassivePerception,
  },
]

const SAVING_THROWS: Array<{ attribute: Attribute; label: string }> = [
  { attribute: "str", label: "FOR" },
  { attribute: "dex", label: "DES" },
  { attribute: "con", label: "CON" },
  { attribute: "int", label: "INT" },
  { attribute: "wis", label: "SAB" },
  { attribute: "cha", label: "CAR" },
]

export function UserCharacterStatistics({
  character,
  updateCharacter,
}: Props) {
  const { isEditing = false } = useCharacterWorkspace()
  const characterId = character.get("id")
  const exhaustion = character.get("sheet").stats.exhaustion ?? 0
  const inspiration = character.get("sheet").stats.inspiration ?? false
  const proficiency = character.getProficiencyBonus()

  function updateCalculatedStat(definition: CalculatedStatDefinition, value: number) {
    if (!isEditing || !Number.isFinite(value)) return

    updateCharacter(characterId, (current) => {
      const calculated = definition.getCalculatedValue(current)
      const adjustmentKey = getStatAdjustmentKey(definition.key)
      const adjustment = cleanNumber(value - calculated)
      return current.withStat(adjustmentKey, adjustment)
    })
  }

  function updateAttribute(attribute: Attribute, requestedValue: number) {
    if (!isEditing || !Number.isFinite(requestedValue)) return

    updateCharacter(characterId, (current) => {
      const currentBase = current.get("sheet").attributes[attribute]
      const currentEffective = current.getEffectiveAttribute(attribute)
      const nextEffective = clampInt(requestedValue, 1, 30)
      const nextBase = clampInt(
        currentBase + nextEffective - currentEffective,
        1,
        30,
      )

      return current.withSheet("attributes", {
        ...current.get("sheet").attributes,
        [attribute]: nextBase,
      })
    })
  }

  function toggleSavingThrow(attribute: Attribute) {
    if (!isEditing) return
    const proficient = character.isSavingThrowProficient(attribute)
    updateCharacter(characterId, (current) =>
      current.setSavingThrowProficiency(attribute, !proficient),
    )
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-3 text-sm font-semibold text-textH">Estatísticas</div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {CALCULATED_STATS.map((definition) => (
          <StatCell key={definition.key} label={definition.label}>
            {isEditing ? (
              <Input
                type="number"
                step="any"
                className="h-10 text-center text-lg font-semibold"
                value={definition.getValue(character)}
                onChange={(event) =>
                  updateCalculatedStat(definition, Number(event.target.value))
                }
              />
            ) : (
              <StatValue value={formatNumber(definition.getValue(character))} />
            )}
          </StatCell>
        ))}

        <StatCell label="Exaustão">
          {isEditing ? (
            <Input
              type="number"
              min={0}
              max={6}
              className="h-10 text-center text-lg font-semibold"
              value={exhaustion}
              onChange={(event) => {
                const next = clampInt(Number(event.target.value), 0, 6)
                updateCharacter(characterId, (current) =>
                  current.withStat("exhaustion", next),
                )
              }}
            />
          ) : (
            <StatValue value={String(exhaustion)} />
          )}
        </StatCell>

        <StatCell label="Inspiração">
          <button
            type="button"
            disabled={!isEditing}
            aria-pressed={inspiration}
            onClick={() =>
              updateCharacter(characterId, (current) =>
                current.withStat("inspiration", !inspiration),
              )
            }
            className={cn(
              "flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold",
              inspiration
                ? "border-accentBorder bg-accentBg text-textH"
                : "border-border bg-bg-subtle text-textMuted",
              isEditing && "hover:border-accentBorder",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {inspiration ? "Sim" : "Não"}
          </button>
        </StatCell>

        <StatCell label="Proficiência">
          <StatValue value={formatSigned(proficiency)} />
        </StatCell>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => {
            const score = character.getEffectiveAttribute(attribute)
            const modifier = character.getEffectiveAttributeModifier(attribute)

            return (
              <div
                key={attribute}
                className="rounded-lg border border-border bg-bg-subtle p-2 text-center"
              >
                <div className="text-xs font-bold uppercase tracking-wide text-textH">
                  {attributeShort(attribute)}
                </div>

                {isEditing ? (
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    inputMode="numeric"
                    className="mt-1 h-9 px-1 text-center text-lg font-bold"
                    value={score}
                    onChange={(event) =>
                      updateAttribute(attribute, Number(event.target.value))
                    }
                  />
                ) : (
                  <div className="mt-1 text-xl font-bold text-textH">{score}</div>
                )}

                <div className="mt-0.5 text-xs font-semibold text-textMuted">
                  {formatSigned(modifier)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-textMuted">
          Testes de Resistência
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SAVING_THROWS.map(({ attribute, label }) => {
            const proficient = character.isSavingThrowProficient(attribute)
            const bonus = character.getSavingThrowBonus(attribute)

            return (
              <button
                key={attribute}
                type="button"
                disabled={!isEditing}
                aria-pressed={proficient}
                onClick={() => toggleSavingThrow(attribute)}
                className={cn(
                  "flex min-h-12 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left",
                  proficient
                    ? "border-accentBorder bg-accentBg"
                    : "border-border bg-bg-subtle",
                  isEditing && "hover:border-accentBorder",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      proficient
                        ? "border-accent bg-accent text-white"
                        : "border-textMuted",
                    )}
                  >
                    {proficient ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="text-xs font-bold text-textH">{label}</span>
                </span>

                <span className="text-sm font-bold text-textH">
                  {formatSigned(bonus)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StatCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-2 text-center">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-textMuted">
        {label}
      </div>
      {children}
    </div>
  )
}

function StatValue({ value }: { value: string }) {
  return (
    <div className="flex h-10 items-center justify-center text-xl font-bold text-textH">
      {value}
    </div>
  )
}

function cleanNumber(value: number): number {
  return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(4))
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
