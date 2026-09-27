import { FileImage, Shield, Swords } from "lucide-react"
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react"

import { Button } from "../../components/ui/Button"
import { Select } from "../../components/ui/Select"
import { useMagicContext } from "../../contexts/magicContext"
import { damageAffinityLabel, damageTypeLabel, type DamageAffinity } from "../../models/combat/Damage"
import { requestCreatureRoll, rollModeFromEvent, rollModifierHint } from "../../lib/diceRoller"
import { CREATURE_ATTRIBUTE_LABELS, parseCreatureSavingThrows, parseCreatureSkills, type ParsedCreatureSave, type ParsedCreatureSkill } from "../../models/creatures/CreatureRolls"
import { getCreatureEffectiveAbilityModifier, getCreatureEffectiveArmorClass, getCreatureEffectiveInitiative, getCreatureEffectiveSaveBonus, getCreatureEffectiveSkillBonus, getCreatureFeatureEffectiveAttackBonus, getCreatureFeatureEffectiveDamageBonus } from "../../models/creatures/CreatureCombatRuntime"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import {
  getCreatureSpellAttackBonus,
  getCreatureSpellSaveDc,
  type CompendiumCreature,
  type CreatureFeature,
  type CreatureSpellcasting,
} from "../../models/creatures/CompendiumCreature"
import type { Attribute } from "../../models/sheet/Attribute"
import type { Skill } from "../../models/sheet/Skills"
import type {
  InitiativeCreatureSpellResources,
  InitiativeEntry,
  InitiativeSide,
} from "../../models/initiative/Initiative"

export type QuickSheetFeature = CreatureFeature & {
  effectiveAttackBonus?: number
  effectiveDamageBonus?: number
}

export type QuickSheetSection = {
  title: string
  content?: string
  entries?: QuickSheetFeature[]
}

export type CreatureQuickSheetRollContext = {
  creatureId: string
  initiativeEntryId?: string
}

export type CombatQuickSheetData = {
  id: string
  name: string
  subtitle?: string
  side?: InitiativeSide
  sheetImageUrl?: string
  initiativeBonus?: number
  armorClass?: number
  currentHp?: number
  maxHp?: number
  temporaryHp?: number
  speed?: string
  passivePerception?: number
  challengeRating?: string
  abilityScores?: Record<Attribute, number>
  abilityModifiers?: Record<Attribute, number>
  savingThrows?: string
  savingThrowRolls?: ParsedCreatureSave[]
  skills?: string
  skillRolls?: ParsedCreatureSkill[]
  rollContext?: CreatureQuickSheetRollContext
  vulnerabilities?: string
  resistances?: string
  immunities?: string
  conditionImmunities?: string
  damageAffinities?: DamageAffinity[]
  senses?: string
  languages?: string
  conditions?: string[]
  spellcasting?: CreatureSpellcasting
  spellSaveDc?: number
  spellAttackBonus?: number
  spellResources?: InitiativeCreatureSpellResources
  sections: QuickSheetSection[]
}

const ATTRIBUTE_ORDER: Attribute[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
]

type CreatureQuickSheetProps = {
  data: CombatQuickSheetData
  preferImage?: boolean
  compact?: boolean
}

export function CreatureQuickSheet({
  data,
  preferImage = false,
  compact = false,
}: CreatureQuickSheetProps) {
  const [mode, setMode] = useState<"summary" | "image">(
    preferImage && data.sheetImageUrl ? "image" : "summary",
  )

  useEffect(() => {
    setMode(preferImage && data.sheetImageUrl ? "image" : "summary")
  }, [data.id, data.sheetImageUrl, preferImage])

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-heading font-semibold text-textH ${compact ? "text-lg" : "text-2xl"}`}>
              {data.name}
            </h3>
            {data.side ? (
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${sideClassName(data.side)}`}
              >
                {sideLabel(data.side)}
              </span>
            ) : null}
          </div>
          {data.subtitle ? (
            <p className="mt-1 text-sm text-textMuted">{data.subtitle}</p>
          ) : null}
        </div>

        {data.sheetImageUrl ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "summary" ? "primary" : "secondary"}
              onClick={() => setMode("summary")}
            >
              <Swords className="h-4 w-4" />
              Resumo
            </Button>
            <Button
              size="sm"
              variant={mode === "image" ? "primary" : "secondary"}
              onClick={() => setMode("image")}
            >
              <FileImage className="h-4 w-4" />
              Imagem da ficha
            </Button>
          </div>
        ) : null}
      </div>

      {mode === "image" && data.sheetImageUrl ? (
        <div className="overflow-auto rounded-xl border border-border bg-black/15 p-2">
          <img
            src={data.sheetImageUrl}
            alt={`Ficha de ${data.name}`}
            className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain"
          />
        </div>
      ) : (
        <QuickSheetSummary data={data} compact={compact} />
      )}
    </div>
  )
}

function QuickSheetSummary({ data, compact = false }: { data: CombatQuickSheetData; compact?: boolean }) {
  return (
    <div className="grid gap-4">
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
        <StatCard
          label="Iniciativa"
          value={signed(data.initiativeBonus)}
          rollable={Boolean(data.rollContext)}
          onRoll={(event) =>
            data.rollContext && requestCreatureRoll({
              ...data.rollContext,
              source: { type: "initiative" },
              mode: rollModeFromEvent(event.nativeEvent),
            })
          }
        />
        <StatCard label="CA" value={displayNumber(data.armorClass)} />
        <StatCard
          label="PV"
          value={
            data.currentHp === undefined && data.maxHp === undefined
              ? "—"
              : `${data.currentHp ?? "—"}/${data.maxHp ?? "—"}`
          }
          detail={
            data.temporaryHp ? `+${data.temporaryHp} temporários` : undefined
          }
        />
        <StatCard label="Deslocamento" value={data.speed || "—"} />
        <StatCard
          label="Percepção passiva"
          value={displayNumber(data.passivePerception)}
        />
        <StatCard label="ND" value={data.challengeRating || "—"} />
      </div>

      {data.abilityScores ? (
        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>
          {ATTRIBUTE_ORDER.map((attribute) => {
            const score = data.abilityScores![attribute]
            const modifier = data.abilityModifiers?.[attribute] ?? Math.floor((score - 10) / 2)
            const content = (
              <>
                <div className="text-[10px] font-bold uppercase text-textMuted">
                  {CREATURE_ATTRIBUTE_LABELS[attribute]}
                </div>
                <div className="mt-1 text-lg font-semibold text-textH">
                  {score}
                </div>
                <div className="text-xs text-textMuted">
                  {signed(modifier)}
                </div>
              </>
            )
            return data.rollContext ? (
              <button
                key={attribute}
                type="button"
                className="rounded-lg border border-border bg-bg-subtle p-3 text-center transition-colors hover:border-accentBorder hover:bg-accentBg"
                title={rollModifierHint()}
                onClick={(event) =>
                  requestCreatureRoll({
                    ...data.rollContext!,
                    source: { type: "ability", attribute },
                    mode: rollModeFromEvent(event.nativeEvent),
                  })
                }
              >
                {content}
              </button>
            ) : (
              <div
                key={attribute}
                className="rounded-lg border border-border bg-bg-subtle p-3 text-center"
              >
                {content}
              </div>
            )
          })}
        </div>
      ) : null}

      {data.conditions && data.conditions.length > 0 ? (
        <InfoBlock
          title="Condições atuais"
          content={data.conditions.join(", ")}
          emphasized
        />
      ) : null}

      {data.damageAffinities?.length ? (
        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="mb-2 text-sm font-semibold text-textH">Defesas de dano</div>
          <div className="flex flex-wrap gap-2">
            {data.damageAffinities.map((rule, index) => (
              <span key={`${rule.damageType}:${rule.kind}:${index}`} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-textH">
                {damageAffinityLabel(rule.kind)} • {damageTypeLabel(rule.damageType)}{rule.qualifier && rule.qualifier !== "any" ? ` • ${rule.qualifier === "magical" ? "mágico" : "não mágico"}` : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {data.rollContext && data.savingThrowRolls?.length ? (
          <CreatureRollList
            title="Testes de resistência"
            entries={data.savingThrowRolls.map((entry) => ({
              key: entry.attribute,
              label: entry.label,
              bonus: entry.bonus,
              source: { type: "save" as const, attribute: entry.attribute },
            }))}
            rollContext={data.rollContext}
          />
        ) : (
          <OptionalInfo title="Testes de resistência" content={data.savingThrows} />
        )}
        {data.rollContext && data.skillRolls?.length ? (
          <CreatureRollList
            title="Perícias"
            entries={data.skillRolls.map((entry) => ({
              key: entry.skill,
              label: entry.label,
              bonus: entry.bonus,
              source: { type: "skill" as const, skill: entry.skill },
            }))}
            rollContext={data.rollContext}
          />
        ) : (
          <OptionalInfo title="Perícias" content={data.skills} />
        )}
        <OptionalInfo title="Vulnerabilidades" content={data.vulnerabilities} />
        <OptionalInfo title="Resistências" content={data.resistances} />
        <OptionalInfo title="Imunidades" content={data.immunities} />
        <OptionalInfo
          title="Imunidades a condições"
          content={data.conditionImmunities}
        />
        <OptionalInfo title="Sentidos" content={data.senses} />
        <OptionalInfo title="Idiomas" content={data.languages} />
      </div>

      {data.spellcasting ? (
        <CreatureSpellcastingSection
          spellcasting={data.spellcasting}
          saveDc={data.spellSaveDc}
          attackBonus={data.spellAttackBonus}
          resources={data.spellResources}
          rollContext={data.rollContext}
        />
      ) : null}

      {data.sections
        .filter(sectionHasContent)
        .map((section) =>
          section.entries?.length ? (
            <FeatureSection
              key={section.title}
              title={section.title}
              entries={section.entries}
              rollContext={data.rollContext}
            />
          ) : (
            <InfoBlock
              key={section.title}
              title={section.title}
              content={section.content ?? ""}
            />
          ),
        )}
    </div>
  )
}

function CreatureSpellcastingSection({
  spellcasting,
  saveDc,
  attackBonus,
  resources,
  rollContext,
}: {
  spellcasting: CreatureSpellcasting
  saveDc?: number
  attackBonus?: number
  resources?: InitiativeCreatureSpellResources
  rollContext?: CreatureQuickSheetRollContext
}) {
  const { getSpellByIndex, ensureOfficialSpells } = useMagicContext()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [castLevels, setCastLevels] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!spellcasting.spells.length) return
    void ensureOfficialSpells(
      spellcasting.spells.map((entry) => entry.spellIndex),
    )
  }, [ensureOfficialSpells, spellcasting.spells])

  const slots = Object.entries(spellcasting.slots)
    .filter(([, amount]) => Boolean(amount))
    .sort(([left], [right]) => Number(left) - Number(right))

  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-textH">Conjuração</h4>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-border bg-bg px-2 py-1 text-textH">
              {CREATURE_ATTRIBUTE_LABELS[spellcasting.ability]}
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-1 text-textH">
              CD {saveDc ?? "—"}
            </span>
            <span className="rounded-full border border-border bg-bg px-2 py-1 text-textH">
              Ataque {signed(attackBonus)}
            </span>
          </div>
        </div>

        {slots.length ? (
          <div className="flex max-w-full flex-wrap justify-end gap-1.5 text-[10px] text-textMuted">
            {slots.map(([level, amount]) => (
              <span
                key={level}
                className="rounded-full border border-border bg-bg px-2 py-1"
              >
                {level}º: {resources?.slots?.[
                  Number(level) as keyof InitiativeCreatureSpellResources["slots"]
                ]?.current ?? amount}/{resources?.slots?.[
                  Number(level) as keyof InitiativeCreatureSpellResources["slots"]
                ]?.max ?? amount}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {spellcasting.spells.length ? (
        <div className="mt-3 grid gap-2">
          {spellcasting.spells.map((entry) => {
            const spell = getSpellByIndex(entry.spellIndex)
            const isExpanded = expanded.has(entry.spellIndex)
            const usage =
              entry.usage.type === "atWill"
                ? "À vontade"
                : entry.usage.type === "perDay"
                  ? `${entry.usage.uses}/dia`
                  : "Usa espaços"
            const castLevel =
              entry.usage.type !== "slots" &&
              entry.castLevel !== undefined &&
              spell &&
              entry.castLevel > spell.slotLevel
                ? ` · conjura no ${entry.castLevel}º`
                : ""
            const dailyPool =
              entry.usage.type === "perDay"
                ? resources?.perDay?.[entry.spellIndex]
                : undefined
            const remainingDaily =
              entry.usage.type === "perDay"
                ? Math.max(
                    0,
                    (dailyPool?.max ?? entry.usage.uses) -
                      (dailyPool?.used ?? 0),
                  )
                : undefined
            const availableSlotLevels =
              entry.usage.type === "slots" && spell
                ? Object.entries(spellcasting.slots)
                    .flatMap(([levelText, maximum]) => {
                      const level = Number(levelText)
                      const current =
                        resources?.slots?.[
                          level as keyof InitiativeCreatureSpellResources["slots"]
                        ]?.current ?? maximum ?? 0
                      return level >= spell.slotLevel && current > 0
                        ? [level]
                        : []
                    })
                    .sort((left, right) => left - right)
                : []
            const selectedCastLevel =
              entry.usage.type === "slots"
                ? (
                    availableSlotLevels.includes(castLevels[entry.spellIndex])
                      ? castLevels[entry.spellIndex]
                      : availableSlotLevels[0] ?? spell?.slotLevel ?? 0
                  )
                : entry.castLevel ?? spell?.slotLevel ?? 0
            const canCast =
              Boolean(rollContext && spell) &&
              (
                entry.usage.type === "atWill" ||
                (entry.usage.type === "perDay" && (remainingDaily ?? 0) > 0) ||
                (entry.usage.type === "slots" && (
                  (spell?.slotLevel ?? 0) === 0 ||
                  availableSlotLevels.length > 0
                ))
              )

            return (
              <article
                key={entry.spellIndex}
                className="rounded-lg border border-border bg-bg px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-textH">
                      {spell?.displayName || spell?.name || entry.spellIndex}
                    </div>
                    <div className="mt-0.5 text-[11px] text-textMuted">
                      {spell
                        ? spell.slotLevel === 0
                          ? "Truque"
                          : `${spell.slotLevel}º círculo`
                        : "Magia do compêndio"}
                      {" · "}
                      {usage}
                      {entry.usage.type === "perDay" && remainingDaily !== undefined
                        ? ` · ${remainingDaily} restante${remainingDaily === 1 ? "" : "s"}`
                        : ""}
                      {castLevel}
                      {spell?.concentration ? " · concentração" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-textH hover:border-accentBorder hover:bg-accentBg"
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current)
                        if (next.has(entry.spellIndex)) {
                          next.delete(entry.spellIndex)
                        } else {
                          next.add(entry.spellIndex)
                        }
                        return next
                      })
                    }
                  >
                    {isExpanded ? "Ocultar" : "Mostrar"}
                  </button>
                </div>

                {rollContext && spell ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                    {entry.usage.type === "slots" && spell.slotLevel > 0 ? (
                      <label className="grid min-w-32 gap-1 text-[10px] font-medium text-textMuted">
                        Espaço
                        <Select
                          value={String(selectedCastLevel)}
                          disabled={availableSlotLevels.length === 0}
                          onChange={(event) =>
                            setCastLevels((current) => ({
                              ...current,
                              [entry.spellIndex]: Number(event.target.value),
                            }))
                          }
                        >
                          {availableSlotLevels.length ? (
                            availableSlotLevels.map((level) => (
                              <option key={level} value={level}>
                                {level}º círculo
                              </option>
                            ))
                          ) : (
                            <option value={spell.slotLevel}>Sem espaços</option>
                          )}
                        </Select>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      disabled={!canCast}
                      className="h-10 rounded-lg border border-accentBorder bg-accentBg px-3 text-xs font-semibold text-accent transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                      title={canCast ? rollModifierHint() : "Sem usos disponíveis."}
                      onClick={(event) =>
                        requestCreatureRoll({
                          ...rollContext,
                          source: {
                            type: "spell",
                            spellIndex: entry.spellIndex,
                            castLevel: selectedCastLevel,
                            intent: "resolve",
                          },
                          mode: rollModeFromEvent(event.nativeEvent),
                        })
                      }
                    >
                      Conjurar
                    </button>
                  </div>
                ) : null}

                {isExpanded ? (
                  spell ? (
                    <div className="mt-3 grid gap-2 border-t border-border pt-3 text-xs leading-5 text-text">
                      <div className="flex flex-wrap gap-2 text-[11px] text-textMuted">
                        <span>{formatSpellCastingTime(spell.castingTime)}</span>
                        <span>•</span>
                        <span>{formatSpellRange(spell)}</span>
                        {spell.components.length ? (
                          <>
                            <span>•</span>
                            <span>{spell.components.join(", ")}</span>
                          </>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap">{spell.description}</p>
                      {spell.higherLevelText?.trim() ? (
                        <p className="whitespace-pre-wrap text-textMuted">
                          <span className="font-semibold text-textH">Em círculos superiores: </span>
                          {spell.higherLevelText}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 border-t border-border pt-3 text-xs text-textMuted">
                      Carregando detalhes da magia…
                    </div>
                  )
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 text-xs text-textMuted">
          Nenhuma magia configurada.
        </div>
      )}
    </section>
  )
}

function formatSpellCastingTime(
  castingTime: { value: number; type: string; reactionWhen?: string; special?: string },
): string {
  if (castingTime.type === "reaction") {
    return castingTime.reactionWhen?.trim()
      ? `Reação — ${castingTime.reactionWhen}`
      : "Reação"
  }
  if (castingTime.type === "special") {
    return castingTime.special?.trim() || "Especial"
  }

  const label =
    castingTime.type === "action"
      ? "ação"
      : castingTime.type === "bonusAction"
        ? "ação bônus"
        : castingTime.type === "minute"
          ? "minuto"
          : castingTime.type === "hour"
            ? "hora"
            : castingTime.type
  return `${castingTime.value} ${label}${castingTime.value === 1 ? "" : "s"}`
}

function formatSpellRange(spell: {
  range: { origin: string; distance: number; area?: { shape: string; size: number } }
}): string {
  if (spell.range.origin === "self") {
    return spell.range.area
      ? `Pessoal · ${spell.range.area.size} m`
      : "Pessoal"
  }
  if (spell.range.origin === "touch") return "Toque"
  return spell.range.distance > 0
    ? `${spell.range.distance} m`
    : spell.range.origin
}

function FeatureSection({
  title,
  entries,
  rollContext,
}: {
  title: string
  entries: QuickSheetFeature[]
  rollContext?: CreatureQuickSheetRollContext
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <h4 className="text-sm font-semibold text-textH">{title}</h4>
      <div className="mt-3 grid gap-2">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-lg border border-border bg-bg px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h5 className="min-w-0 flex-1 text-sm font-semibold text-textH">{entry.name}</h5>
              {rollContext ? (
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg"
                  onClick={() =>
                    requestCreatureRoll({
                      ...rollContext,
                      source: {
                        type: "feature",
                        featureId: entry.id,
                        intent: "announce",
                      },
                    })
                  }
                >
                  Mostrar
                </button>
              ) : null}
            </div>
            {entry.mechanics ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {rollContext ? (
                  <button
                    type="button"
                    className="rounded-full border border-accentBorder bg-accentBg px-2 py-1 font-semibold text-accent transition-colors hover:bg-bg-subtle"
                    title={rollModifierHint()}
                    onClick={(event) =>
                      requestCreatureRoll({
                        ...rollContext,
                        source: {
                          type: "feature",
                          featureId: entry.id,
                          intent: "resolve",
                        },
                        mode: rollModeFromEvent(event.nativeEvent),
                      })
                    }
                  >
                    Ataque {signed(entry.effectiveAttackBonus ?? entry.mechanics.attackBonus)}
                  </button>
                ) : (
                  <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-1 font-semibold text-accent">
                    Ataque {signed(entry.effectiveAttackBonus ?? entry.mechanics.attackBonus)}
                  </span>
                )}
                {entry.mechanics.reach ? <span className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-textMuted">{entry.mechanics.reach}</span> : null}
                {entry.mechanics.damage.map((part, index) => (
                  <span key={`${part.damageType}:${index}`} className="rounded-full border border-border bg-bg-subtle px-2 py-1 text-textH">
                    {part.formula}{entry.effectiveDamageBonus ? ` ${entry.effectiveDamageBonus > 0 ? "+" : ""}${entry.effectiveDamageBonus}` : ""} {damageTypeLabel(part.damageType)}
                  </span>
                ))}
              </div>
            ) : null}
            {entry.description.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
                {entry.description}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  detail,
  rollable = false,
  onRoll,
}: {
  label: string
  value: string
  detail?: string
  rollable?: boolean
  onRoll?: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  const content = (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
      {detail ? <div className="text-xs text-accent">{detail}</div> : null}
    </>
  )
  return rollable && onRoll ? (
    <button
      type="button"
      className="rounded-lg border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg"
      title={rollModifierHint()}
      onClick={onRoll}
    >
      {content}
    </button>
  ) : (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">{content}</div>
  )
}

function CreatureRollList({
  title,
  entries,
  rollContext,
}: {
  title: string
  entries: Array<{
    key: string
    label: string
    bonus: number
    source:
      | { type: "save"; attribute: Attribute }
      | { type: "skill"; skill: Skill }
  }>
  rollContext: CreatureQuickSheetRollContext
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="mb-2 text-sm font-semibold text-textH">{title}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-textH transition-colors hover:border-accentBorder hover:bg-accentBg"
            title={rollModifierHint()}
            onClick={(event) =>
              requestCreatureRoll({
                ...rollContext,
                source: entry.source,
                mode: rollModeFromEvent(event.nativeEvent),
              })
            }
          >
            {entry.label} {signed(entry.bonus)}
          </button>
        ))}
      </div>
    </section>
  )
}

function OptionalInfo({ title, content }: { title: string; content?: string }) {
  if (!content?.trim()) return null
  return <InfoBlock title={title} content={content} />
}

function InfoBlock({
  title,
  content,
  emphasized = false,
}: {
  title: string
  content: string
  emphasized?: boolean
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        emphasized
          ? "border-accentBorder bg-accentBg"
          : "border-border bg-bg-subtle"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-textH">
        {emphasized ? <Shield className="h-4 w-4 text-accent" /> : null}
        {title}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-text">
        {content}
      </div>
    </section>
  )
}

export function quickSheetFromCompendiumCreature(
  creature: CompendiumCreature,
  entry?: InitiativeEntry,
  options: { enableRolls?: boolean } = {},
): CombatQuickSheetData {
  const conditions = entry?.conditions ?? []
  const enrich = (features: CreatureFeature[]): QuickSheetFeature[] =>
    features.map((feature) => {
      const resolvedFeature: CreatureFeature = feature
      return {
        ...resolvedFeature,
        effectiveAttackBonus: getCreatureFeatureEffectiveAttackBonus(
          creature,
          resolvedFeature,
          conditions,
          entry,
        ),
        effectiveDamageBonus: getCreatureFeatureEffectiveDamageBonus(
          creature,
          resolvedFeature,
          conditions,
          entry,
        ),
      }
    })
  const abilityModifiers = Object.fromEntries(
    (Object.keys(creature.abilityScores) as Attribute[]).map((attribute) => [
      attribute,
      getCreatureEffectiveAbilityModifier(creature, attribute, conditions, entry),
    ]),
  ) as Record<Attribute, number>
  const savingThrowRolls = parseCreatureSavingThrows(creature.savingThrows).map((save) => ({
    ...save,
    bonus: getCreatureEffectiveSaveBonus(creature, save.attribute, conditions, entry),
  }))
  const skillRolls = parseCreatureSkills(creature.skills).map((skill) => ({
    ...skill,
    bonus: getCreatureEffectiveSkillBonus(creature, skill.skill, conditions, entry) ?? skill.bonus,
  }))

  return {
    id: creature.id,
    name: creature.name,
    subtitle: [creature.size, creature.category]
      .filter(Boolean)
      .join(" • "),
    side: entry?.side ?? creature.defaultSide,
    sheetImageUrl: creature.sheetImageUrl,
    initiativeBonus: getCreatureEffectiveInitiative(creature, conditions, entry),
    armorClass: getCreatureEffectiveArmorClass(creature, conditions, entry),
    currentHp: entry?.currentHp ?? creature.maxHp,
    maxHp: entry?.maxHp ?? creature.maxHp,
    temporaryHp: entry?.temporaryHp,
    speed: creature.speed,
    passivePerception: creature.passivePerception,
    challengeRating: creature.challengeRating,
    abilityScores: creature.abilityScores,
    abilityModifiers,
    savingThrows: creature.savingThrows,
    savingThrowRolls,
    skills: creature.skills,
    skillRolls,
    rollContext: options.enableRolls
      ? { creatureId: creature.id, initiativeEntryId: entry?.id }
      : undefined,
    vulnerabilities: creature.vulnerabilities,
    resistances: creature.resistances,
    immunities: creature.immunities,
    conditionImmunities: creature.conditionImmunities,
    damageAffinities: creature.damageAffinities,
    senses: creature.senses,
    languages: creature.languages,
    conditions: entry?.conditions.map((condition) => condition.name),
    spellcasting: creature.spellcasting,
    spellSaveDc: getCreatureSpellSaveDc(creature),
    spellAttackBonus: getCreatureSpellAttackBonus(creature),
    spellResources: entry?.creatureSpellResources,
    sections: [
      { title: "Traços e habilidades", entries: enrich(creature.traits) },
      { title: "Ações", entries: enrich(creature.actions) },
      { title: "Ações bônus", entries: enrich(creature.bonusActions) },
      { title: "Reações", entries: enrich(creature.reactions) },
      { title: "Ações lendárias", entries: enrich(creature.legendaryActions) },
      { title: "Notas de combate", content: creature.combatNotes },
    ],
  }
}

export function quickSheetFromCharacter(
  character: CharacterTemplate,
  entry?: InitiativeEntry,
): CombatQuickSheetData {
  const sheet = character.get("sheet")
  const attributes = {
    str: character.getEffectiveAttribute("str"),
    dex: character.getEffectiveAttribute("dex"),
    con: character.getEffectiveAttribute("con"),
    int: character.getEffectiveAttribute("int"),
    wis: character.getEffectiveAttribute("wis"),
    cha: character.getEffectiveAttribute("cha"),
  }
  const savingThrows = (
    Object.keys(attributes) as Array<keyof typeof attributes>
  )
    .filter((attribute) => character.isSavingThrowProficient(attribute))
    .map(
      (attribute) =>
        `${CREATURE_ATTRIBUTE_LABELS[attribute]} ${signed(character.getSavingThrowBonus(attribute))}`,
    )
    .join(", ")
  const abilities = character.getCharacterAbilities()
  const passiveAbilities = abilities.filter(
    (ability) => ability.kind === "passive",
  )
  const actionAbilities = abilities.filter(
    (ability) =>
      ability.kind !== "passive" &&
      (!ability.actionKind || ability.actionKind === "action"),
  )
  const bonusActions = abilities.filter(
    (ability) => ability.actionKind === "bonusAction",
  )
  const reactions = abilities.filter(
    (ability) => ability.actionKind === "reaction",
  )
  const legendaryActions = abilities.filter((ability) =>
    ability.actionKind?.startsWith("legendary"),
  )

  return {
    id: character.get("id"),
    name: character.get("name"),
    subtitle: sheet.classes
      ?.map((classData) => `${classData.className} ${classData.level}`)
      .join(" • "),
    side: entry?.side ?? "ally",
    initiativeBonus: character.getEffectiveInitiative(),
    armorClass: entry?.armorClass ?? character.getEffectiveArmorClass(),
    currentHp: entry?.currentHp ?? sheet.HP.current,
    maxHp: entry?.maxHp ?? character.getEffectiveMaxHp(),
    temporaryHp:
      entry?.temporaryHp ?? character.getEffectiveTemporaryHp(),
    speed: `${character.getEffectiveMobility()} m`,
    passivePerception: character.getEffectivePassivePerception(),
    abilityScores: attributes,
    savingThrows,
    damageAffinities: sheet.damageAffinities ?? [],
    conditions: entry?.conditions.map((condition) => condition.name),
    sections: [
      { title: "Traços e passivas", content: formatAbilities(passiveAbilities) },
      { title: "Ações", content: formatAbilities(actionAbilities) },
      { title: "Ações bônus", content: formatAbilities(bonusActions) },
      { title: "Reações", content: formatAbilities(reactions) },
      {
        title: "Ações e resistências lendárias",
        content: formatAbilities(legendaryActions),
      },
    ],
  }
}

export function quickSheetFromInitiativeEntry(
  entry: InitiativeEntry,
): CombatQuickSheetData {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: "Entrada rápida de iniciativa",
    side: entry.side,
    initiativeBonus: entry.initiativeBonus,
    armorClass: entry.armorClass,
    currentHp: entry.currentHp,
    maxHp: entry.maxHp,
    temporaryHp: entry.temporaryHp,
    conditions: entry.conditions.map((condition) => condition.name),
    sections: [],
  }
}

function sectionHasContent(section: QuickSheetSection): boolean {
  return Boolean(section.content?.trim() || section.entries?.length)
}

function formatAbilities(
  abilities: Array<{ name: string; description?: string }>,
): string {
  return abilities
    .map((ability) =>
      ability.description?.trim()
        ? `${ability.name}. ${ability.description}`
        : ability.name,
    )
    .join("\n\n")
}

function displayNumber(value: number | undefined): string {
  return value === undefined ? "—" : String(value)
}

function signed(value: number | undefined): string {
  if (value === undefined) return "—"
  return value >= 0 ? `+${value}` : String(value)
}

function sideLabel(side: InitiativeSide): string {
  if (side === "ally") return "Aliado"
  if (side === "enemy") return "Inimigo"
  return "Neutro"
}

function sideClassName(side: InitiativeSide): string {
  if (side === "ally") {
    return "border-accentBorder bg-accentBg text-accent"
  }
  if (side === "enemy") {
    return "border-danger bg-transparent text-danger"
  }
  return "border-border bg-bg-subtle text-textMuted"
}
