import { useEffect, useMemo, useState } from "react"
import { Check, Plus, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  PHB_RACE_PRESETS,
  SKILL_LABELS,
  racePresetToCharacterRace,
  type RacePreset,
} from "../../../data/characterCreation/phbPresets"
import { RACIAL_SPELLCASTING_PRESETS } from "../../../data/characterCreation/racialSpellcastingPresets"
import { attributeShort } from "../../../lib/attributeShorts"
import type { Ability } from "../../../models/abilities/Ability"
import {
  endAbilityEffect,
  useAbilityEffect,
  getAbilityUsageMax,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterRace,
  CreatureSize,
} from "../../../models/races/CharacterRace"
import type { Race } from "../../../models/races/Race"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import { AbilityCard } from "../abilities/abilityCard"
import { AbilityDialog } from "../abilities/abilityDialog"
import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"
import {
  RacialSpellSelectionModal,
  type RacialSpellSelectionKind,
} from "../progression/RacialSpellSelectionModal"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const RACE_OPTIONS: Array<{ value: Race; label: string }> = [
  { value: "custom", label: "Personalizada" },
  { value: "aarakocra", label: "Aarakocra" },
  { value: "aasimar", label: "Aasimar" },
  { value: "bugbear", label: "Bugbear" },
  { value: "centaur", label: "Centauro" },
  { value: "changeling", label: "Changeling" },
  { value: "dragonborn", label: "Draconato" },
  { value: "dwarf", label: "Anão" },
  { value: "duergar", label: "Duergar" },
  { value: "elf", label: "Elfo" },
  { value: "eladrin", label: "Eladrin" },
  { value: "fairy", label: "Fada" },
  { value: "firbolg", label: "Firbolg" },
  { value: "genasi", label: "Genasi" },
  { value: "giff", label: "Giff" },
  { value: "githyanki", label: "Githyanki" },
  { value: "githzerai", label: "Githzerai" },
  { value: "gnome", label: "Gnomo" },
  { value: "deep-gnome", label: "Gnomo das Profundezas" },
  { value: "goblin", label: "Goblin" },
  { value: "goliath", label: "Golias" },
  { value: "half-elf", label: "Meio-elfo" },
  { value: "half-orc", label: "Meio-orc" },
  { value: "halfling", label: "Halfling" },
  { value: "harengon", label: "Harengon" },
  { value: "hobgoblin", label: "Hobgoblin" },
  { value: "human", label: "Humano" },
  { value: "kenku", label: "Kenku" },
  { value: "kobold", label: "Kobold" },
  { value: "leonin", label: "Leonin" },
  { value: "lizardfolk", label: "Povo-lagarto" },
  { value: "loxodon", label: "Loxodon" },
  { value: "minotaur", label: "Minotauro" },
  { value: "orc", label: "Orc" },
  { value: "owlin", label: "Owlin" },
  { value: "satyr", label: "Sátiro" },
  { value: "shadar-kai", label: "Shadar-kai" },
  { value: "shifter", label: "Shifter" },
  { value: "tabaxi", label: "Tabaxi" },
  { value: "thri-kreen", label: "Thri-kreen" },
  { value: "tiefling", label: "Tiefling" },
  { value: "tortle", label: "Tortle" },
  { value: "triton", label: "Tritão" },
  { value: "vedalken", label: "Vedalken" },
  { value: "verdan", label: "Verdan" },
  { value: "warforged", label: "Forjado Bélico" },
  { value: "yuan-ti", label: "Yuan-ti" },
]

const SIZE_OPTIONS: Array<{ value: CreatureSize; label: string }> = [
  { value: "tiny", label: "Minúsculo" },
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
  { value: "huge", label: "Enorme" },
  { value: "gargantuan", label: "Colossal" },
]

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

export function CharacterRaceTab({
  character,
  updateCharacter,
}: Props) {
  const { spells, getSpellByIndex } = useMagicContext()
  const { updateCharacterDomain } = useCharacterWorkspace()
  const [creatingAbility, setCreatingAbility] = useState(false)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [racialSpellModalKind, setRacialSpellModalKind] =
    useState<RacialSpellSelectionKind | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState(
    detectRacePresetId(character.get("sheet").race),
  )

  const race = character.get("sheet").race
  const naturalAbilities = race.naturalAbilities ?? []
  const selectedPreset = useMemo(
    () => PHB_RACE_PRESETS.find((preset) => preset.id === selectedPresetId),
    [selectedPresetId],
  )
  const racialSpellcastingPreset = RACIAL_SPELLCASTING_PRESETS[selectedPresetId]
  const raceName =
    race.customName?.trim() ||
    race.subrace?.trim() ||
    selectedPreset?.name ||
    String(race.race)
  const racialSpellEntries = (character.get("magic")?.spells.knownSpells ?? []).filter(
    (entry) => entry.source.type === "race",
  )
  const racialCantripIndexes = racialSpellEntries
    .filter((entry) => getSpellByIndex(entry.spells.id)?.slotLevel === 0)
    .map((entry) => entry.spells.id)
  const racialLeveledSpellIndexes = racialSpellEntries
    .filter((entry) => (getSpellByIndex(entry.spells.id)?.slotLevel ?? 0) > 0)
    .map((entry) => entry.spells.id)
  const [racialCastingAttribute, setRacialCastingAttribute] = useState<Attribute>(
    racialSpellEntries[0]?.source.attribute ??
      racialSpellcastingPreset?.defaultAttribute ??
      "cha",
  )

  useEffect(() => {
    setSelectedPresetId(detectRacePresetId(character.get("sheet").race))
  }, [character])

  useEffect(() => {
    const existing = racialSpellEntries[0]?.source.attribute
    setRacialCastingAttribute(
      existing ?? racialSpellcastingPreset?.defaultAttribute ?? "cha",
    )
  }, [racialSpellcastingPreset?.defaultAttribute, selectedPresetId])

  function updateRace(updater: (race: CharacterRace) => CharacterRace) {
    updateCharacterDomain(character.get("id"), "sheet", (current) =>
      current.withSheet("race", updater(current.get("sheet").race)),
    )
  }

  function setRaceField<K extends keyof CharacterRace>(
    key: K,
    value: CharacterRace[K],
  ) {
    updateRace((currentRace) => ({
      ...currentRace,
      [key]: value,
    }))
    setSelectedPresetId("custom")
  }

  function setAttributeBonus(attribute: Attribute, value: number) {
    updateRace((currentRace) => ({
      ...currentRace,
      attributeBonus: {
        ...(currentRace.attributeBonus ?? {}),
        [attribute]: value,
      },
    }))
    setSelectedPresetId("custom")
  }

  function applyPreset(preset: RacePreset) {
    updateCharacterDomain(character.get("id"), "sheet", (current) => {
      const sheet = current.get("sheet")
      const currentRace = sheet.race
      const presetRace = racePresetToCharacterRace(preset)
      const skills = { ...sheet.skills }
      const savingThrowProficiencies = {
        ...sheet.savingThrowProficiencies,
      }

      for (const proficiency of presetRace.proficiencies) {
        if (proficiency.category === "skill") {
          const skill = getSkillFromName(proficiency.name)
          if (skill && skills[skill] !== "expertise") {
            skills[skill] = "proficient"
          }
        }

        if (proficiency.category === "saving-throw") {
          const attribute = getAttributeFromName(proficiency.name)
          if (attribute) savingThrowProficiencies[attribute] = true
        }
      }

      return current.withPatch({
        sheet: {
          ...sheet,
          skills,
          savingThrowProficiencies,
          race: {
            ...currentRace,
            ...presetRace,
            supplyConsumption: currentRace.supplyConsumption,
            supplyConsumptionCustomized:
              currentRace.supplyConsumptionCustomized,
          },
        },
      })
    })
    setSelectedPresetId(preset.id)
    setRacialCastingAttribute(
      RACIAL_SPELLCASTING_PRESETS[preset.id]?.defaultAttribute ?? "cha",
    )
  }

  function saveAbility(ability: Ability) {
    updateRace((currentRace) => {
      const abilities = currentRace.naturalAbilities ?? []
      const alreadyExists = abilities.some(
        (currentAbility) => currentAbility.id === ability.id,
      )

      return {
        ...currentRace,
        naturalAbilities: alreadyExists
          ? abilities.map((currentAbility) =>
              currentAbility.id === ability.id ? ability : currentAbility,
            )
          : [...abilities, ability],
      }
    })

    setCreatingAbility(false)
    setEditingAbility(null)
  }

  function removeAbility(abilityId: string) {
    updateRace((currentRace) => ({
      ...currentRace,
      naturalAbilities: (currentRace.naturalAbilities ?? []).filter(
        (ability) => ability.id !== abilityId,
      ),
    }))
    setSelectedPresetId("custom")
  }

  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    updateCharacter(character.get("id"), (current) => {
      const currentRace = current.get("sheet").race
      const ability = (currentRace.naturalAbilities ?? []).find(
        (entry) => entry.id === abilityId,
      )
      if (!ability) return current
      if (action === "use") {
        return useAbilityEffect(current, ability, {
          type: "race",
          sourceLabel: "Raça",
        })
      }
      if (action === "deactivate") {
        return endAbilityEffect(current, ability, {
          type: "race",
          sourceLabel: "Raça",
        })
      }
      return current.withSheet("race", {
        ...currentRace,
        naturalAbilities: (currentRace.naturalAbilities ?? []).map((entry) =>
          entry.id === abilityId ? restoreAbilityUse(entry) : entry,
        ),
      })
    })
  }

  function setRaceProficiencies(proficiencies: Proficiency[]) {
    updateCharacterDomain(character.get("id"), "sheet", (current) => {
      const sheet = current.get("sheet")
      const skills = { ...sheet.skills }
      const savingThrowProficiencies = {
        ...sheet.savingThrowProficiencies,
      }

      for (const proficiency of proficiencies) {
        if (proficiency.category === "skill") {
          const skill = getSkillFromName(proficiency.name)
          if (skill && skills[skill] !== "expertise") {
            skills[skill] = "proficient"
          }
        }

        if (proficiency.category === "saving-throw") {
          const attribute = getAttributeFromName(proficiency.name)
          if (attribute) savingThrowProficiencies[attribute] = true
        }
      }

      return current.withPatch({
        sheet: {
          ...sheet,
          skills,
          savingThrowProficiencies,
          race: {
            ...sheet.race,
            proficiencies,
          },
        },
      })
    })
    setSelectedPresetId("custom")
  }

  function changeRacialCastingAttribute(attribute: Attribute) {
    setRacialCastingAttribute(attribute)
    updateCharacterDomain(character.get("id"), "magic", (current) => {
      const magic = current.getOrCreateMagic()
      return current.with("magic", {
        ...magic,
        spells: {
          ...magic.spells,
          knownSpells: magic.spells.knownSpells.map((entry) =>
            entry.source.type === "race"
              ? {
                  ...entry,
                  source: { ...entry.source, attribute },
                }
              : entry,
          ),
        },
      })
    })
  }

  function setRacialSpells(
    kind: RacialSpellSelectionKind,
    selected: string[],
  ) {
    updateCharacterDomain(character.get("id"), "magic", (current) => {
      const magic = current.getOrCreateMagic()
      const existingRaceEntries = magic.spells.knownSpells.filter(
        (entry) => entry.source.type === "race",
      )
      const existingByIndex = new Map(
        existingRaceEntries.map((entry) => [entry.spells.id, entry]),
      )
      const retained = magic.spells.knownSpells.filter((entry) => {
        if (entry.source.type !== "race") return true
        const spell = getSpellByIndex(entry.spells.id)
        if (!spell) return true
        return kind === "cantrip" ? spell.slotLevel > 0 : spell.slotLevel === 0
      })
      const characterLevel = (current.get("sheet").classes ?? []).reduce(
        (total, entry) => total + entry.level,
        0,
      )
      const acquisition = createCharacterAcquisition({
        reason: "manual",
        characterLevel,
        sourceType: "race",
        sourceId: String(race.race),
        sourceName: raceName,
        notes: "Magia racial configurada manualmente conforme a referência do jogador.",
      })
      const raceEntries = Array.from(new Set(selected)).map((spellIndex) => {
        const existing = existingByIndex.get(spellIndex)
        return {
          source: {
            type: "race" as const,
            name: raceName,
            sourceId: `race:${String(race.race)}`,
            attribute: racialCastingAttribute,
          },
          spells: {
            id: spellIndex,
            prepared: true,
          },
          acquisition: existing?.acquisition ?? acquisition,
        }
      })

      return current.with("magic", {
        ...magic,
        spells: {
          ...magic.spells,
          knownSpells: [...retained, ...raceEntries],
        },
      })
    })
  }

  function removeRacialSpell(spellIndex: string) {
    updateCharacterDomain(character.get("id"), "magic", (current) => {
      const magic = current.getOrCreateMagic()
      return current.with("magic", {
        ...magic,
        spells: {
          ...magic.spells,
          knownSpells: magic.spells.knownSpells.filter(
            (entry) =>
              !(
                entry.source.type === "race" && entry.spells.id === spellIndex
              ),
          ),
        },
      })
    })
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-textH">Preset racial</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Aplique um dos presets usados na criação de personagens. Isso
            substitui identidade, bônus, habilidades e proficiências raciais,
            preservando a configuração de suprimentos e as magias raciais já
            escolhidas.
          </p>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Select
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            <option value="custom">Personalizada / sem preset correspondente</option>
            {PHB_RACE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            disabled={!selectedPreset}
            onClick={() => selectedPreset && applyPreset(selectedPreset)}
          >
            <Check className="h-4 w-4" />
            Aplicar preset
          </Button>
        </div>

        {selectedPreset ? (
          <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-text">
            <span className="font-semibold text-textH">{selectedPreset.name}:</span>{" "}
            {selectedPreset.summary}
          </div>
        ) : null}
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-textH">Raça</h2>
          <p className="mt-1 text-xs text-textMuted">
            Todos os campos continuam editáveis após aplicar um preset.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {race.race === "custom" ? (
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-medium text-textH">Nome da raça</span>
              <Input
                value={race.customName ?? ""}
                placeholder="Ex.: Povo da Lua"
                onChange={(event) => setRaceField("customName", event.target.value)}
              />
            </label>
          ) : null}

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Raça</span>
            <Select
              value={race.race}
              onChange={(event) =>
                setRaceField("race", event.target.value as Race)
              }
            >
              {RACE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Sub-raça</span>
            <Input
              value={race.subrace ?? ""}
              placeholder="Ex: Alto Elfo"
              onChange={(event) =>
                setRaceField("subrace", event.target.value)
              }
            />
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">Tamanho</span>
            <Select
              value={race.size ?? "medium"}
              onChange={(event) =>
                setRaceField(
                  "size",
                  event.target.value as CreatureSize,
                )
              }
            >
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-textH">
              Mobilidade
            </span>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={race.mobility ?? 9 + (race.speedBonus ?? 0)}
              onChange={(event) =>
                updateRace((currentRace) => ({
                  ...currentRace,
                  mobility: Math.max(0, Number(event.target.value) || 0),
                  speedBonus: undefined,
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-textH">
            Bônus de atributo
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            Esses valores são somados aos atributos base do personagem.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <label
              key={attribute}
              className="grid min-w-0 gap-1.5 rounded-lg border border-border bg-bg-subtle p-3"
            >
              <span className="text-center text-xs font-bold uppercase tracking-wide text-textH">
                {attributeShort(attribute)}
              </span>
              <Input
                type="number"
                className="text-center"
                value={race.attributeBonus?.[attribute] ?? 0}
                onChange={(event) =>
                  setAttributeBonus(
                    attribute,
                    Number(event.target.value) || 0,
                  )
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-textH">
              Magias raciais
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Apenas magias cuja origem é a raça aparecem aqui. Consulte sua
              referência e adicione as opções liberadas para o nível atual do
              personagem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRacialSpellModalKind("cantrip")}
            >
              <Plus className="h-4 w-4" />
              Aprender truque
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRacialSpellModalKind("leveled")}
            >
              <Plus className="h-4 w-4" />
              Aprender magia
            </Button>
          </div>
        </div>

        {racialSpellcastingPreset ? (
          <div className="mb-4 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs leading-5 text-text">
            {racialSpellcastingPreset.guidance}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <RacialSpellGroup
            title="Truques raciais"
            indexes={racialCantripIndexes}
            getSpellByIndex={getSpellByIndex}
            onRemove={removeRacialSpell}
          />
          <RacialSpellGroup
            title="Magias raciais"
            indexes={racialLeveledSpellIndexes}
            getSpellByIndex={getSpellByIndex}
            onRemove={removeRacialSpell}
          />
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-textH">
              Habilidades naturais
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Podem ter ações, gatilhos, usos, recargas e magias concedidas.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setCreatingAbility(true)}
          >
            <Plus className="h-4 w-4" />
            Habilidade
          </Button>
        </div>

        {naturalAbilities.length > 0 ? (
          <div className="grid gap-3">
            {[...naturalAbilities]
              .sort((left, right) =>
                left.name.localeCompare(right.name, "pt-BR"),
              )
              .map((ability) => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  sourceLabel="Raça"
                  usageMax={
                    ability.usage
                      ? getAbilityUsageMax(character, ability.usage)
                      : undefined
                  }
                  onEdit={() => setEditingAbility(ability)}
                  onRemove={() => removeAbility(ability.id)}
                  onUse={() => updateAbilityState(ability.id, "use")}
                  onRestore={() => updateAbilityState(ability.id, "restore")}
                  onDeactivate={() => updateAbilityState(ability.id, "deactivate")}
                />
              ))}
          </div>
        ) : (
          <EmptyCard text="Nenhuma habilidade natural cadastrada." />
        )}
      </section>

      <GrantedProficienciesEditor
        proficiencies={race.proficiencies ?? []}
        onChange={setRaceProficiencies}
        title="Proficiências raciais"
        description="Inclui perícias, testes de resistência, conjuração com mãos ocupadas e outros treinamentos concedidos pela raça."
        emptyMessage="Nenhuma proficiência racial cadastrada."
      />

      <AbilityDialog
        open={creatingAbility || editingAbility !== null}
        ability={editingAbility}
        onClose={() => {
          setCreatingAbility(false)
          setEditingAbility(null)
        }}
        onSave={saveAbility}
      />

      {racialSpellModalKind ? (
        <RacialSpellSelectionModal
          open
          kind={racialSpellModalKind}
          raceName={raceName}
          spells={spells}
          selected={
            racialSpellModalKind === "cantrip"
              ? racialCantripIndexes
              : racialLeveledSpellIndexes
          }
          attribute={racialCastingAttribute}
          onAttributeChange={changeRacialCastingAttribute}
          onChange={(selected) => setRacialSpells(racialSpellModalKind, selected)}
          onClose={() => setRacialSpellModalKind(null)}
        />
      ) : null}
    </div>
  )
}

function RacialSpellGroup({
  title,
  indexes,
  getSpellByIndex,
  onRemove,
}: {
  title: string
  indexes: string[]
  getSpellByIndex: ReturnType<typeof useMagicContext>["getSpellByIndex"]
  onRemove: (spellIndex: string) => void
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-xs font-semibold text-textH">{title}</div>
      <div className="mt-3 grid gap-2">
        {indexes.length ? (
          indexes.map((index) => {
            const spell = getSpellByIndex(index)
            return (
              <div
                key={index}
                className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3"
              >
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium text-textH">
                    {spell?.displayName?.trim() || spell?.name || index}
                  </div>
                  <div className="mt-1 text-[10px] text-textMuted">
                    {spell
                      ? spell.slotLevel === 0
                        ? "Truque"
                        : `${spell.slotLevel}º círculo`
                      : "Magia racial"}
                  </div>
                  {spell?.description?.trim() ? (
                    <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-textMuted [overflow-wrap:anywhere]">
                      {spell.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${spell?.displayName || spell?.name || index}`}
                  onClick={() => onRemove(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-dangerBg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
            Nenhuma magia cadastrada nesta categoria.
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
      {text}
    </div>
  )
}

function detectRacePresetId(race: CharacterRace): string {
  const match = PHB_RACE_PRESETS.find(
    (preset) =>
      preset.race === race.race &&
      normalizeText(preset.subrace) === normalizeText(race.subrace ?? ""),
  )
  return match?.id ?? "custom"
}

function getSkillFromName(name: string): Skill | undefined {
  const normalized = normalizeText(name)
  return (Object.entries(SKILL_LABELS) as Array<[Skill, string]>).find(
    ([skill, label]) =>
      normalizeText(skill) === normalized || normalizeText(label) === normalized,
  )?.[0]
}

function getAttributeFromName(name: string): Attribute | undefined {
  const normalized = normalizeText(name)
  return ATTRIBUTE_KEYS.find(
    (attribute) =>
      normalizeText(attribute) === normalized ||
      normalizeText(attributeShort(attribute)) === normalized ||
      normalizeText(ATTRIBUTE_LABELS[attribute]) === normalized,
  )
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}
