import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Ability } from "../../../models/abilities/Ability"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionMetadata,
} from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  ensureCharacterAcquisitionMetadata,
  getCharacterTotalLevel,
} from "../../../models/characters/characterAcquisitionMetadata"
import type { DieSides } from "../../../models/dice/Die"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { Attribute } from "../../../models/sheet/Attribute"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type ClassLevel,
  type ClassName,
} from "../../../models/sheet/Class"
import { AbilityDialog } from "../abilities/abilityDialog"
import { PHB_CLASS_PRESETS } from "../creation/phbPresets"

type Props = {
  character: CharacterTemplate
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = 1 | 2 | 3 | 4 | 5
type LevelMode = "existing" | "multiclass"
type HpMode = "average" | "manual" | "rolled"
type AbilityDialogKind = "class" | "race" | null

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

export function CharacterLevelUpWizard({
  character,
  onCancel,
  onComplete,
}: Props) {
  const { spells } = useMagicContext()
  const classes = character.get("sheet").classes ?? []
  const totalLevel = getCharacterTotalLevel(character)
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<LevelMode>(
    classes.length ? "existing" : "multiclass",
  )
  const [className, setClassName] = useState<ClassName>(
    classes[0]?.className ?? "fighter",
  )
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledHp, setRolledHp] = useState<number | null>(null)
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [spellQuery, setSpellQuery] = useState("")
  const [showAllSpells, setShowAllSpells] = useState(false)
  const [selectedSpellIndexes, setSelectedSpellIndexes] = useState<string[]>([])
  const [preparedSpellIndexes, setPreparedSpellIndexes] = useState<string[]>([])
  const [spellcastingAttribute, setSpellcastingAttribute] =
    useState<Attribute>("cha")
  const [classAbilities, setClassAbilities] = useState<Ability[]>([])
  const [racialFeatures, setRacialFeatures] = useState<Ability[]>([])
  const [abilityDialogKind, setAbilityDialogKind] =
    useState<AbilityDialogKind>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)

  const selectedPreset = useMemo(
    () =>
      PHB_CLASS_PRESETS.find((preset) => preset.id === className) ??
      PHB_CLASS_PRESETS[0],
    [className],
  )
  const existingClass = classes.find(
    (entry) => entry.className === className,
  )
  const nextClassLevel =
    mode === "existing" ? (existingClass?.level ?? 0) + 1 : 1
  const classAlreadyPresent = Boolean(existingClass)
  const maximumReached = totalLevel >= 20 || nextClassLevel > 20
  const invalidMulticlass = mode === "multiclass" && classAlreadyPresent
  const canAdvance = !maximumReached && !invalidMulticlass
  const conModifier = character.getAttributeModifier("con")
  const averageHp = calculateAverageHp(selectedPreset.hitDie, conModifier)
  const hpGain =
    hpMode === "rolled"
      ? rolledHp ?? averageHp
      : hpMode === "manual"
        ? Math.max(1, Math.trunc(Number(manualHp) || 1))
        : averageHp

  const knownSpellIndexes = useMemo(
    () =>
      new Set(
        character
          .ggetSpells()
          .map((entry) => entry.spells.id),
      ),
    [character],
  )

  const visibleSpells = useMemo(() => {
    const normalizedQuery = normalizeSearch(spellQuery)
    return spells
      .filter((spell) => !knownSpellIndexes.has(spell.index))
      .filter((spell) => showAllSpells || spell.classes.includes(className))
      .filter((spell) => {
        if (!normalizedQuery) return true
        return normalizeSearch(
          [spell.displayName, spell.name, spell.description, spell.school]
            .filter(Boolean)
            .join(" "),
        ).includes(normalizedQuery)
      })
      .toSorted((left, right) => {
        const levelDifference = left.slotLevel - right.slotLevel
        if (levelDifference !== 0) return levelDifference
        return spellName(left).localeCompare(spellName(right), "pt-BR")
      })
  }, [className, knownSpellIndexes, showAllSpells, spellQuery, spells])

  useEffect(() => {
    const classEntry =
      existingClass ?? createClass(className)
    setSpellcastingAttribute(classEntry.castingAttribute ?? "cha")
    setSelectedSpellIndexes([])
    setPreparedSpellIndexes([])
  }, [className, existingClass?.castingAttribute, mode])

  function rollHitDie() {
    const sides = dieSidesValue(selectedPreset.hitDie)
    const die = Math.floor(Math.random() * sides) + 1
    setRolledDie(die)
    setRolledHp(Math.max(1, die + conModifier))
    setHpMode("rolled")
  }

  function toggleSpell(spellIndex: string) {
    setSelectedSpellIndexes((current) =>
      current.includes(spellIndex)
        ? current.filter((entry) => entry !== spellIndex)
        : [...current, spellIndex],
    )
    setPreparedSpellIndexes((current) =>
      current.filter((entry) => entry !== spellIndex),
    )
  }

  function saveAbility(ability: Ability) {
    if (!abilityDialogKind) return
    const setter =
      abilityDialogKind === "class" ? setClassAbilities : setRacialFeatures

    setter((current) => {
      const exists = current.some((entry) => entry.id === ability.id)
      return exists
        ? current.map((entry) => (entry.id === ability.id ? ability : entry))
        : [...current, ability]
    })
    setAbilityDialogKind(null)
    setEditingAbility(null)
  }

  function complete() {
    if (!canAdvance) return
    const eventId = crypto.randomUUID()
    const addedAt = new Date().toISOString()
    const nextCharacterLevel = totalLevel + 1
    const classDisplayName = selectedPreset.name
    const race = character.get("sheet").race
    const raceName = race.customName?.trim() || race.subrace?.trim() || race.race

    let updated = applyClassAndHp(
      character,
      className,
      mode,
      hpGain,
      selectedPreset.hitDie,
    )

    const classMetadata = createCharacterAcquisition({
      eventId,
      addedAt,
      reason: "level-up",
      characterLevel: nextCharacterLevel,
      className,
      classLevel: nextClassLevel,
      sourceType: "class",
      sourceId: className,
      sourceName: classDisplayName,
    })
    const raceMetadata = createCharacterAcquisition({
      eventId,
      addedAt,
      reason: "level-up",
      characterLevel: nextCharacterLevel,
      className,
      classLevel: nextClassLevel,
      sourceType: "race",
      sourceId: String(race.race),
      sourceName: raceName,
    })

    updated = updated.with("abilities", [
      ...(updated.get("abilities") ?? []),
      ...classAbilities.map((ability) =>
        stampAbility(ability, classMetadata, "class"),
      ),
    ])
    updated = updated.withSheet("race", {
      ...updated.get("sheet").race,
      naturalAbilities: [
        ...(updated.get("sheet").race.naturalAbilities ?? []),
        ...racialFeatures.map((ability) =>
          stampAbility(ability, raceMetadata, "race"),
        ),
      ],
    })

    for (const spellIndex of selectedSpellIndexes) {
      updated = updated.addSpell({
        source: {
          type: "class",
          name: classDisplayName,
          attribute: spellcastingAttribute,
          sourceId: className,
        },
        spells: {
          id: spellIndex,
          prepared: preparedSpellIndexes.includes(spellIndex),
        },
        acquisition: classMetadata,
      })
    }

    updated = ensureCharacterAcquisitionMetadata(
      updated.syncMagicWithClasses(),
      {
        eventId,
        addedAt,
        reason: "level-up",
        characterLevel: nextCharacterLevel,
        className,
        classLevel: nextClassLevel,
        sourceType: "class",
        sourceId: className,
        sourceName: classDisplayName,
      },
    )

    onComplete(updated)
  }

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">Subir de nível</h1>
            <p className="mt-1 text-sm text-textMuted">
              {character.get("name")} · nível atual {totalLevel} · etapa {step} de 5
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["Classe", "PV", "Magias", "Características", "Revisão"].map(
            (label, index) => (
              <button
                key={label}
                type="button"
                className={
                  step === index + 1
                    ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH"
                    : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-textMuted"
                }
                onClick={() => setStep((index + 1) as Step)}
              >
                {index + 1}. {label}
              </button>
            ),
          )}
        </div>
      </header>

      {step === 1 ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              selected={mode === "existing"}
              disabled={!classes.length}
              title="Avançar classe existente"
              description="Aumenta em um o nível de uma classe já presente."
              onClick={() => {
                setMode("existing")
                setClassName(classes[0]?.className ?? "fighter")
              }}
            />
            <ChoiceCard
              selected={mode === "multiclass"}
              title="Multiclasse"
              description="Adiciona o primeiro nível de uma nova classe."
              onClick={() => setMode("multiclass")}
            />
          </div>

          <label className="grid gap-1.5 text-xs text-text">
            Classe
            <Select
              value={className}
              onChange={(event) => setClassName(event.target.value as ClassName)}
            >
              {PHB_CLASS_PRESETS.filter((preset) =>
                mode === "existing"
                  ? classes.some((entry) => entry.className === preset.id)
                  : !classes.some((entry) => entry.className === preset.id),
              ).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </Select>
          </label>

          <SummaryRow label="Resultado" value={`${selectedPreset.name} ${nextClassLevel}`} />
          <SummaryRow label="Nível total" value={`${totalLevel} → ${totalLevel + 1}`} />

          {invalidMulticlass ? (
            <Notice text="Esta classe já existe na ficha. Use avanço de classe existente." />
          ) : null}
          {maximumReached ? (
            <Notice text="O personagem já atingiu o limite de nível aplicável." />
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-bg-subtle p-4">
            <h2 className="font-semibold text-textH">Pontos de vida</h2>
            <p className="mt-1 text-xs text-textMuted">
              Dado {selectedPreset.hitDie}; Constituição {formatSigned(conModifier)}.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ChoiceCard
                selected={hpMode === "average"}
                title="Média fixa"
                description={`Ganha ${averageHp} PV.`}
                onClick={() => setHpMode("average")}
              />
              <ChoiceCard
                selected={hpMode === "manual"}
                title="Valor manual"
                description="Informe o ganho final, já com Constituição."
                onClick={() => setHpMode("manual")}
              />
              <ChoiceCard
                selected={hpMode === "rolled"}
                title="Rolar dado"
                description={
                  rolledDie === null
                    ? `Rola 1${selectedPreset.hitDie} e soma Constituição.`
                    : `Rolagem ${rolledDie}; ganho final ${rolledHp}.`
                }
                onClick={rollHitDie}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              {hpMode === "manual" ? (
                <label className="grid max-w-xs gap-1.5 text-xs text-text">
                  PV ganhos
                  <Input
                    type="number"
                    min={1}
                    value={manualHp}
                    onChange={(event) => setManualHp(event.target.value)}
                  />
                </label>
              ) : null}
              <Button variant="secondary" onClick={rollHitDie}>
                Rolar 1{selectedPreset.hitDie}
              </Button>
              <Badge label={`Ganho aplicado: ${hpGain} PV`} />
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Input
              value={spellQuery}
              placeholder="Buscar magia"
              onChange={(event) => setSpellQuery(event.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-text">
              <input
                type="checkbox"
                checked={showAllSpells}
                onChange={(event) => setShowAllSpells(event.target.checked)}
              />
              Mostrar todas as classes
            </label>
            <label className="grid gap-1.5 text-xs text-text sm:col-span-2 sm:max-w-xs">
              Atributo de conjuração destas magias
              <Select
                value={spellcastingAttribute}
                onChange={(event) =>
                  setSpellcastingAttribute(event.target.value as Attribute)
                }
              >
                {Object.entries(ATTRIBUTE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid max-h-[38rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {visibleSpells.map((spell) => {
              const selected = selectedSpellIndexes.includes(spell.index)
              return (
                <article
                  key={spell.index}
                  className={
                    selected
                      ? "rounded-xl border border-accentBorder bg-accentBg p-4"
                      : "rounded-xl border border-border bg-bg-subtle p-4"
                  }
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleSpell(spell.index)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-textH">{spellName(spell)}</h3>
                      <Badge label={spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} />
                      {!spell.classes.includes(className) ? <Badge label="Fora da lista da classe" /> : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-textMuted">
                      {spell.description || "Sem descrição."}
                    </p>
                  </button>
                  {selected ? (
                    <label className="mt-3 flex items-center gap-2 text-xs text-text">
                      <input
                        type="checkbox"
                        checked={preparedSpellIndexes.includes(spell.index)}
                        onChange={(event) =>
                          setPreparedSpellIndexes((current) =>
                            event.target.checked
                              ? [...current, spell.index]
                              : current.filter((entry) => entry !== spell.index),
                          )
                        }
                      />
                      Adicionar preparada
                    </label>
                  ) : null}
                </article>
              )
            })}
          </div>
          <Badge label={`${selectedSpellIndexes.length} magias selecionadas`} />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FeatureList
            title={`Características de ${selectedPreset.name}`}
            description="Habilidades, talentos ou recursos concedidos pela classe neste nível."
            entries={classAbilities}
            onAdd={() => {
              setEditingAbility(null)
              setAbilityDialogKind("class")
            }}
            onEdit={(ability) => {
              setEditingAbility(ability)
              setAbilityDialogKind("class")
            }}
            onRemove={(id) =>
              setClassAbilities((current) =>
                current.filter((entry) => entry.id !== id),
              )
            }
          />
          <FeatureList
            title="Características raciais"
            description="Características que passam a estar disponíveis neste nível, como magia racial escalonada."
            entries={racialFeatures}
            onAdd={() => {
              setEditingAbility(null)
              setAbilityDialogKind("race")
            }}
            onEdit={(ability) => {
              setEditingAbility(ability)
              setAbilityDialogKind("race")
            }}
            onRemove={(id) =>
              setRacialFeatures((current) =>
                current.filter((entry) => entry.id !== id),
              )
            }
          />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid gap-4">
          <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
            <SummaryRow label="Classe" value={`${selectedPreset.name} ${nextClassLevel}`} />
            <SummaryRow label="Nível total" value={`${totalLevel} → ${totalLevel + 1}`} />
            <SummaryRow label="Pontos de vida" value={`+${hpGain}`} />
            <SummaryRow label="Dado de vida" value={`+1 ${selectedPreset.hitDie}`} />
            <SummaryRow label="Magias" value={`${selectedSpellIndexes.length}`} />
            <SummaryRow label="Habilidades de classe" value={`${classAbilities.length}`} />
            <SummaryRow label="Características raciais" value={`${racialFeatures.length}`} />
          </section>
          <Notice text="Todas as escolhas serão salvas com data, nível total, classe avançada, nível da classe, origem e um identificador comum deste level-up." />
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            if (step === 1) onCancel()
            else setStep((step - 1) as Step)
          }}
        >
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        {step < 5 ? (
          <Button
            disabled={!canAdvance}
            onClick={() => setStep((step + 1) as Step)}
          >
            Continuar
          </Button>
        ) : (
          <Button disabled={!canAdvance} onClick={complete}>
            Confirmar subida de nível
          </Button>
        )}
      </footer>

      <AbilityDialog
        open={abilityDialogKind !== null}
        ability={editingAbility}
        onClose={() => {
          setAbilityDialogKind(null)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />
    </section>
  )
}

function applyClassAndHp(
  character: CharacterTemplate,
  className: ClassName,
  mode: LevelMode,
  hpGain: number,
  hitDie: DieSides,
): CharacterTemplate {
  const sheet = character.get("sheet")
  const classes = [...(sheet.classes ?? [])]

  if (mode === "existing") {
    const index = classes.findIndex((entry) => entry.className === className)
    if (index < 0) throw new Error("Classe existente não encontrada.")
    classes[index] = {
      ...classes[index],
      level: Math.min(20, classes[index].level + 1) as ClassLevel,
    }
  } else {
    classes.push(createClass(className))
  }

  const currentHp = sheet.HP
  const currentDie = currentHp.hitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }

  return character.withPatch({
    sheet: {
      ...sheet,
      classes,
      HP: {
        ...currentHp,
        max: currentHp.max + hpGain,
        current: currentHp.current + hpGain,
        hitDice: {
          ...currentHp.hitDice,
          [hitDie]: {
            max: {
              quantity: currentDie.max.quantity + 1,
              sides: hitDie,
            },
            current: {
              quantity: currentDie.current.quantity + 1,
              sides: hitDie,
            },
          },
        },
      },
    },
  })
}

function stampAbility(
  ability: Ability,
  acquisition: CharacterAcquisitionMetadata,
  source: "class" | "race",
): Ability {
  return {
    ...ability,
    source,
    acquisition,
    grantedSpells: ability.grantedSpells?.map((grant) => ({
      ...grant,
      acquisition: createCharacterAcquisition({
        ...acquisition,
        sourceType: "ability",
        sourceId: ability.id,
        sourceName: ability.name,
      }),
    })),
  }
}

function createClass(className: ClassName): CharacterClassInterface {
  const builder = new CharacterClassBuilder()
  switch (className) {
    case "artificer": return builder.artificer()
    case "barbarian": return builder.barbarian()
    case "bard": return builder.bard()
    case "cleric": return builder.cleric()
    case "druid": return builder.druid()
    case "fighter": return builder.fighter()
    case "monk": return builder.monk()
    case "paladin": return builder.paladin()
    case "ranger": return builder.ranger()
    case "rogue": return builder.rogue()
    case "sorcerer": return builder.sorcerer()
    case "warlock": return builder.warlock()
    case "wizard": return builder.wizard()
  }
}

function calculateAverageHp(hitDie: DieSides, constitutionModifier: number): number {
  return Math.max(
    1,
    Math.floor(dieSidesValue(hitDie) / 2) + 1 + constitutionModifier,
  )
}

function dieSidesValue(hitDie: DieSides): number {
  return Math.max(1, Number(hitDie.slice(1)) || 1)
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

function ChoiceCard({
  selected,
  disabled = false,
  title,
  description,
  onClick,
}: {
  selected: boolean
  disabled?: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={
        selected
          ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left disabled:opacity-50"
          : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg disabled:opacity-50"
      }
      onClick={onClick}
    >
      <span className="block font-semibold text-textH">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-textMuted">
        {description}
      </span>
    </button>
  )
}

function FeatureList({
  title,
  description,
  entries,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string
  description: string
  entries: Ability[]
  onAdd: () => void
  onEdit: (ability: Ability) => void
  onRemove: (abilityId: string) => void
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-textH">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>Adicionar</Button>
      </div>
      <div className="mt-4 grid gap-2">
        {entries.map((ability) => (
          <article key={ability.id} className="rounded-lg border border-border bg-bg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-textH">{ability.name}</div>
                <p className="mt-1 line-clamp-3 text-xs text-textMuted">
                  {ability.description || "Sem descrição."}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(ability)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => onRemove(ability.id)}>Remover</Button>
              </div>
            </div>
          </article>
        ))}
        {!entries.length ? (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-textMuted">
            Nenhuma característica adicionada.
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-3">
      <span className="text-textMuted">{label}</span>
      <span className="font-medium text-textH">{value}</span>
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-warning bg-warningBg p-4 text-sm leading-6 text-textH">
      {text}
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}
