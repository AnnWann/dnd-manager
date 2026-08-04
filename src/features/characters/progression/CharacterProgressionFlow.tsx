import { useMemo, useState, type ComponentProps } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionMetadata,
} from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  applyClassProficiencies,
  getClassProficiencyRule,
  validateClassProficiencySelections,
  type ClassProficiencySelection,
} from "../../../models/leveling/ClassProficiencyRules"
import {
  getDynamicSubclassSpellGrants,
} from "../../../models/leveling/DynamicSubclassSpellRules"
import { getClassNamePt } from "../../../models/leveling/ClassLocalization"
import {
  createClassEntry,
  normalizeSpellName,
} from "../../../models/leveling/SpellSelectionRules"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { ClassName } from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import { SKILL_LABELS } from "../creation/phbPresets"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"
import { ProgressionReferencePanel } from "./ProgressionReferencePanel"
import "./progressionDetails.css"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>
type KnownSpell = CharacterSpells["knownSpells"][number]

type PendingMulticlass = {
  character: CharacterTemplate
  newClasses: ClassName[]
}

export function CharacterProgressionFlow({
  onComplete,
  ...props
}: Props) {
  const { spells } = useMagicContext()
  const [pending, setPending] = useState<PendingMulticlass | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<
    Partial<Record<ClassName, Skill[]>>
  >({})
  const [selectedTools, setSelectedTools] = useState<
    Partial<Record<ClassName, string>>
  >({})
  const [validationMessage, setValidationMessage] = useState("")

  const calculationCharacter = useMemo(
    () => createProgressionCalculationCharacter(props.character),
    [props.character],
  )
  const originalClassNames = useMemo(
    () =>
      new Set(
        (props.character.get("sheet").classes ?? []).map(
          (entry) => entry.className,
        ),
      ),
    [props.character],
  )

  function finish(character: CharacterTemplate) {
    onComplete(
      finalizeDynamicSubclassSpells(
        character,
        spells,
        props.mode,
      ),
    )
  }

  function receiveProgression(calculatedCharacter: CharacterTemplate) {
    const character = restoreStoredAttributes(
      calculatedCharacter,
      props.character,
    )
    const newClasses = (character.get("sheet").classes ?? [])
      .map((entry) => entry.className)
      .filter((className) => !originalClassNames.has(className))

    if (!newClasses.length) {
      finish(character)
      return
    }

    setSelectedSkills({})
    setSelectedTools({})
    setValidationMessage("")
    setPending({ character, newClasses })
  }

  function confirmMulticlassProficiencies() {
    if (!pending) return
    const selections: ClassProficiencySelection[] = pending.newClasses.map(
      (className) => ({
        className,
        previousLevel: 0,
        selectedSkills: selectedSkills[className] ?? [],
        selectedToolOrInstrument: selectedTools[className],
      }),
    )
    const error = validateClassProficiencySelections(selections)
    if (error) {
      setValidationMessage(error)
      return
    }

    finish(applyClassProficiencies(pending.character, selections))
  }

  if (pending) {
    const blockedSkills = new Set<Skill>(
      Object.entries(pending.character.get("sheet").skills ?? {})
        .filter(([, level]) => level !== "none")
        .map(([skill]) => skill as Skill),
    )

    return (
      <section className="mx-auto grid w-full max-w-5xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-lg font-semibold text-textH">
            Proficiências da nova classe
          </h1>
          <p className="mt-1 text-sm leading-6 text-textMuted">
            Uma multiclasse não concede salvaguardas nem todo o treinamento da classe inicial. Revise as concessões abaixo e complete somente as escolhas previstas pela regra de multiclasse.
          </p>
        </header>

        {pending.newClasses.map((className) => {
          const rule = getClassProficiencyRule(className)
          const skillRule = rule.multiclassSkills
          const currentSkills = selectedSkills[className] ?? []

          return (
            <article
              key={className}
              className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
            >
              <div>
                <h2 className="font-semibold text-textH">
                  {getClassNamePt(className)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.multiclass.length ? (
                    rule.multiclass.map((proficiency) => (
                      <Badge key={proficiency.id}>
                        {proficiency.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-textMuted">
                      Esta classe não concede proficiências fixas ao entrar por multiclasse.
                    </span>
                  )}
                </div>
              </div>

              {skillRule ? (
                <section>
                  <div className="text-xs font-semibold text-textH">
                    Escolha {skillRule.count}{" "}
                    {skillRule.count === 1 ? "perícia" : "perícias"} ({currentSkills.length}/{skillRule.count})
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {Object.entries(SKILL_LABELS)
                      .filter(([rawSkill]) =>
                        skillRule.options === "any"
                          ? true
                          : skillRule.options.includes(rawSkill as Skill),
                      )
                      .map(([rawSkill, label]) => {
                        const skill = rawSkill as Skill
                        const selected = currentSkills.includes(skill)
                        const blocked = blockedSkills.has(skill)
                        return (
                          <button
                            key={skill}
                            type="button"
                            disabled={
                              blocked ||
                              (!selected &&
                                currentSkills.length >= skillRule.count)
                            }
                            onClick={() =>
                              setSelectedSkills((current) => {
                                const entries = current[className] ?? []
                                return {
                                  ...current,
                                  [className]: entries.includes(skill)
                                    ? entries.filter(
                                        (entry) => entry !== skill,
                                      )
                                    : [...entries, skill],
                                }
                              })
                            }
                            className={
                              selected
                                ? "rounded-lg border border-accentBorder bg-accentBg p-2 text-left text-xs text-textH"
                                : "rounded-lg border border-border bg-bg p-2 text-left text-xs text-textMuted disabled:opacity-50"
                            }
                          >
                            <span className="block font-medium">{label}</span>
                            {blocked ? (
                              <span className="mt-1 block text-[10px]">
                                Já proficiente
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                  </div>
                </section>
              ) : null}

              {rule.multiclassChoiceLabel ? (
                <label className="grid gap-1.5 text-xs text-text">
                  {rule.multiclassChoiceLabel}
                  <Input
                    value={selectedTools[className] ?? ""}
                    placeholder="Digite a escolha"
                    onChange={(event) =>
                      setSelectedTools((current) => ({
                        ...current,
                        [className]: event.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
            </article>
          )
        })}

        {validationMessage ? (
          <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">
            {validationMessage}
          </div>
        ) : null}

        <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button
            variant="secondary"
            onClick={() => {
              setPending(null)
              setValidationMessage("")
            }}
          >
            Voltar à progressão
          </Button>
          <Button onClick={confirmMulticlassProficiencies}>
            Confirmar proficiências e concluir
          </Button>
        </footer>
      </section>
    )
  }

  return (
    <div className="progression-readable-details">
      <CharacterProgressionConfigurator
        {...props}
        character={calculationCharacter}
        onComplete={receiveProgression}
      />
      <ProgressionReferencePanel
        character={props.character}
        spells={spells}
      />
    </div>
  )
}

export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
  spells: Spell[],
  mode: "creation" | "level-up",
): CharacterTemplate {
  const magic = character.get("magic")
  if (!magic) return character

  const spellByName = new Map<string, Spell>()
  for (const spell of spells) {
    spellByName.set(normalizeSpellName(spell.name), spell)
    if (spell.displayName?.trim()) {
      spellByName.set(normalizeSpellName(spell.displayName), spell)
    }
  }

  let knownSpells = [...magic.spells.knownSpells]
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )

  for (const classEntry of character.get("sheet").classes ?? []) {
    const subclassId = classEntry.subclass?.id
    const grants = getDynamicSubclassSpellGrants(
      character,
      classEntry.className,
      subclassId,
      classEntry.level,
    )
    if (!grants.length) continue

    const event = findLatestProgressionEvent(
      character,
      classEntry.className,
      mode,
    )

    for (const grant of grants) {
      const spell = spellByName.get(normalizeSpellName(grant.spellName))
      if (!spell) continue

      const existingIndex = knownSpells.findIndex(
        (entry) => entry.spells.id === spell.index,
      )

      if (grant.mode === "expanded-list") {
        if (existingIndex >= 0) {
          knownSpells[existingIndex] = markAsExtendedList(
            knownSpells[existingIndex],
            classEntry.className,
          )
        }
        continue
      }

      if (existingIndex >= 0) {
        const existing = knownSpells[existingIndex]
        knownSpells[existingIndex] = {
          ...existing,
          source: {
            ...existing.source,
            extendedList: true,
          },
          spells: {
            ...existing.spells,
            prepared:
              grant.mode === "always-prepared"
                ? true
                : existing.spells.prepared,
          },
        }
        continue
      }

      const acquisition = createCharacterAcquisition({
        eventId: event?.eventId,
        addedAt: event?.addedAt,
        reason:
          mode === "creation" ? "character-creation" : "level-up",
        characterLevel: event?.characterLevel ?? totalLevel,
        className: classEntry.className,
        classLevel: grant.classLevel,
        sourceType: "class",
        sourceId: `${classEntry.className}:${grant.subclassId}`,
        sourceName: grant.sourceName,
      })
      const source = createClassEntry(
        classEntry.className,
        classEntry.level,
      )

      knownSpells.push({
        source: {
          type: "class",
          name: classEntry.className,
          sourceId: classEntry.className,
          attribute: source.castingAttribute ?? "int",
          extendedList: true,
        },
        spells: {
          id: spell.index,
          prepared: grant.mode === "always-prepared",
        },
        acquisition,
      })
    }
  }

  return character.with("magic", {
    ...magic,
    spells: {
      ...magic.spells,
      knownSpells,
    },
  })
}

function createProgressionCalculationCharacter(
  character: CharacterTemplate,
): CharacterTemplate {
  const sheet = character.get("sheet")
  const race = sheet.race
  const attributes = Object.fromEntries(
    ATTRIBUTE_KEYS.map((attribute) => [
      attribute,
      sheet.attributes[attribute] + (race.attributeBonus[attribute] ?? 0),
    ]),
  ) as typeof sheet.attributes

  return character.withPatch({
    sheet: {
      ...sheet,
      attributes,
      race: {
        ...race,
        attributeBonus: {},
      },
    },
  })
}

function restoreStoredAttributes(
  character: CharacterTemplate,
  original: CharacterTemplate,
): CharacterTemplate {
  const originalSheet = original.get("sheet")
  const currentSheet = character.get("sheet")

  return character.withPatch({
    sheet: {
      ...currentSheet,
      attributes: { ...originalSheet.attributes },
      race: {
        ...currentSheet.race,
        attributeBonus: { ...originalSheet.race.attributeBonus },
      },
    },
  })
}

function markAsExtendedList(
  entry: KnownSpell,
  className: ClassName,
): KnownSpell {
  if (
    entry.source.type !== "class" ||
    (entry.source.sourceId !== className && entry.source.name !== className)
  ) {
    return entry
  }

  return {
    ...entry,
    source: {
      ...entry.source,
      extendedList: true,
    },
  }
}

function findLatestProgressionEvent(
  character: CharacterTemplate,
  className: ClassName,
  mode: "creation" | "level-up",
): CharacterAcquisitionMetadata | undefined {
  const reason = mode === "creation" ? "character-creation" : "level-up"
  const candidates: CharacterAcquisitionMetadata[] = []

  for (const ability of character.get("abilities") ?? []) {
    if (
      ability.acquisition?.reason === reason &&
      ability.acquisition.className === className
    ) {
      candidates.push(ability.acquisition)
    }
  }

  for (const spell of character.get("magic")?.spells.knownSpells ?? []) {
    if (
      spell.acquisition?.reason === reason &&
      spell.acquisition.className === className
    ) {
      candidates.push(spell.acquisition)
    }
  }

  return candidates.toSorted((left, right) =>
    right.addedAt.localeCompare(left.addedAt),
  )[0]
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}
