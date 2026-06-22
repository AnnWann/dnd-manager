import { useMemo, useState } from "react"
import { BookOpen, Check, Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterBackground } from "../../../models/characters/CharacterBackground"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  cloneBackground,
  getCharacterBackground,
  withCharacterBackground,
  withoutCharacterBackground,
} from "../../../models/characters/characterBackgroundStorage"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import type { Skill } from "../../../models/sheet/Skills"
import {
  PHB_BACKGROUND_PRESETS,
  SKILL_LABELS,
  type BackgroundPreset,
} from "../creation/phbPresets"
import { inferBackgroundFromHistory } from "../creation/inferCharacterBackground"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterBackgroundSection({
  character,
  updateCharacter,
}: Props) {
  const storedBackground = getCharacterBackground(character)
  const inferredBackground = useMemo(
    () => inferBackgroundFromHistory(character.get("profile").history),
    [character],
  )
  const background = storedBackground ?? inferredBackground
  const [open, setOpen] = useState(false)
  const [presetId, setPresetId] = useState("custom")
  const [draft, setDraft] = useState<CharacterBackground | null>(null)
  const [addEquipment, setAddEquipment] = useState(false)

  function openEditor() {
    const current = background
      ? cloneBackground(background)
      : cloneBackground(PHB_BACKGROUND_PRESETS[0])
    const matchingPreset = PHB_BACKGROUND_PRESETS.find(
      (preset) => normalizeText(preset.name) === normalizeText(current.name),
    )

    setDraft(current)
    setPresetId(matchingPreset?.id ?? "custom")
    setAddEquipment(!background)
    setOpen(true)
  }

  function selectPreset(nextPresetId: string) {
    setPresetId(nextPresetId)

    if (nextPresetId === "custom") {
      setDraft((current) => ({
        ...(current ?? emptyBackground()),
        id: "custom",
        custom: true,
      }))
      return
    }

    const preset = PHB_BACKGROUND_PRESETS.find(
      (entry) => entry.id === nextPresetId,
    )
    if (preset) setDraft(cloneBackground(preset))
  }

  function toggleSkill(skill: Skill) {
    setDraft((current) => {
      if (!current) return current

      return {
        ...current,
        skillProficiencies: current.skillProficiencies.includes(skill)
          ? current.skillProficiencies.filter((entry) => entry !== skill)
          : [...current.skillProficiencies, skill],
        custom: true,
      }
    })
    setPresetId("custom")
  }

  function saveBackground() {
    if (!draft?.name.trim()) return

    const saved: CharacterBackground = {
      ...cloneBackground(draft),
      name: draft.name.trim(),
      custom: presetId === "custom" || draft.custom,
    }

    updateCharacter(character.get("id"), (current) => {
      const withBackground = withCharacterBackground(current, saved)
      const sheet = withBackground.get("sheet")
      const skills = { ...sheet.skills }

      for (const skill of saved.skillProficiencies) {
        if (skills[skill] !== "expertise") skills[skill] = "proficient"
      }

      const proficiencies = mergeProficiencies(
        sheet.proficiencies ?? [],
        saved.proficiencies,
      )
      const inventory = addEquipment
        ? [
            ...withBackground.get("inventory"),
            ...saved.startingEquipment.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              desc:
                item.desc ||
                `Equipamento inicial do antecedente ${saved.name}.`,
            })),
          ]
        : withBackground.get("inventory")

      return withBackground.withPatch({
        sheet: {
          ...sheet,
          skills,
          proficiencies,
        },
        inventory,
      })
    })

    setOpen(false)
  }

  function removeBackground() {
    updateCharacter(character.get("id"), (current) =>
      withoutCharacterBackground(current),
    )
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0 text-accent" />
              <h2 className="text-sm font-semibold text-textH">Antecedente</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Origem, treinamento e característica narrativa anterior à vida de
              aventureiro.
            </p>
          </div>

          <Button size="sm" variant="primary" onClick={openEditor}>
            {background ? "Alterar antecedente" : "Adicionar antecedente"}
          </Button>
        </div>

        {background ? (
          <div className="mt-4 grid gap-4">
            {!storedBackground && inferredBackground ? (
              <div className="rounded-lg border border-warning bg-warningBg px-3 py-2 text-xs text-warning">
                Antecedente recuperado da história antiga. Salve-o novamente para
                convertê-lo em dado estruturado da ficha.
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-bg-subtle p-4">
              <div className="text-base font-semibold text-textH">
                {background.name}
              </div>
              {background.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">
                  {background.description}
                </p>
              ) : null}

              {background.featureName ? (
                <div className="mt-4 rounded-lg border border-accentBorder bg-accentBg p-3">
                  <div className="text-xs font-semibold text-textH">
                    {background.featureName}
                  </div>
                  {background.featureDescription ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-text">
                      {background.featureDescription}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <BackgroundList
                title="Perícias"
                empty="Nenhuma perícia cadastrada."
                values={background.skillProficiencies.map(
                  (skill) => SKILL_LABELS[skill],
                )}
              />
              <BackgroundList
                title="Proficiências e idiomas"
                empty="Nenhuma proficiência adicional cadastrada."
                values={background.proficiencies.map(
                  (entry) => `${entry.name} · ${formatCategory(entry.category)}`,
                )}
              />
            </div>

            {background.startingEquipment.length > 0 ? (
              <BackgroundList
                title="Equipamento inicial previsto"
                empty="Nenhum equipamento cadastrado."
                values={background.startingEquipment.map((item) =>
                  item.quantity > 1
                    ? `${item.name} ×${item.quantity}`
                    : item.name,
                )}
              />
            ) : null}

            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={removeBackground}>
                <Trash2 className="h-4 w-4" />
                Remover referência do antecedente
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-8 text-center">
            <div className="text-sm font-medium text-textH">
              Nenhum antecedente cadastrado
            </div>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Adicione um preset do PHB ou crie um antecedente personalizado.
            </p>
            <Button className="mt-4" size="sm" variant="secondary" onClick={openEditor}>
              <Plus className="h-4 w-4" />
              Adicionar antecedente
            </Button>
          </div>
        )}

        {background ? (
          <p className="mt-3 text-[11px] leading-5 text-textMuted">
            Remover ou substituir o antecedente não retira automaticamente
            perícias, proficiências ou itens já concedidos, pois eles podem ter
            outras origens.
          </p>
        ) : null}
      </section>

      {open && draft ? (
        <div
          className="fixed inset-0 z-[10000] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/70 p-0 backdrop-blur-sm sm:p-4"
          onMouseDown={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="grid h-[100dvh] w-full min-w-0 max-w-[100vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-elevated text-text shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:max-w-3xl sm:rounded-xl sm:border sm:border-border"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold text-textH">
                  {background ? "Alterar antecedente" : "Adicionar antecedente"}
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  Presets aplicam perícias e proficiências à ficha.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <main className="min-h-0 overflow-y-auto p-4">
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-textH">
                    Preset
                  </span>
                  <Select
                    value={presetId}
                    onChange={(event) => selectPreset(event.target.value)}
                  >
                    {PHB_BACKGROUND_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                    <option value="custom">Personalizado</option>
                  </Select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-textH">Nome</span>
                  <Input
                    value={draft.name}
                    onChange={(event) => {
                      setPresetId("custom")
                      setDraft({
                        ...draft,
                        name: event.target.value,
                        custom: true,
                      })
                    }}
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-textH">
                    Descrição
                  </span>
                  <Textarea
                    className="min-h-28"
                    value={draft.description}
                    onChange={(event) => {
                      setPresetId("custom")
                      setDraft({
                        ...draft,
                        description: event.target.value,
                        custom: true,
                      })
                    }}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">
                      Característica
                    </span>
                    <Input
                      value={draft.featureName ?? ""}
                      onChange={(event) => {
                        setPresetId("custom")
                        setDraft({
                          ...draft,
                          featureName: event.target.value,
                          custom: true,
                        })
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-textH">
                      Descrição da característica
                    </span>
                    <Textarea
                      value={draft.featureDescription ?? ""}
                      onChange={(event) => {
                        setPresetId("custom")
                        setDraft({
                          ...draft,
                          featureDescription: event.target.value,
                          custom: true,
                        })
                      }}
                    />
                  </label>
                </div>

                <div>
                  <div className="text-xs font-semibold text-textH">
                    Perícias do antecedente
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {(Object.entries(SKILL_LABELS) as Array<[Skill, string]>).map(
                      ([skill, label]) => {
                        const selected = draft.skillProficiencies.includes(skill)
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={
                              selected
                                ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
                                : "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text"
                            }
                          >
                            {selected ? "✓ " : ""}
                            {label}
                          </button>
                        )
                      },
                    )}
                  </div>
                </div>

                {draft.proficiencies.length > 0 ? (
                  <BackgroundList
                    title="Proficiências fornecidas pelo preset"
                    empty=""
                    values={draft.proficiencies.map(
                      (entry) => `${entry.name} · ${formatCategory(entry.category)}`,
                    )}
                  />
                ) : null}

                {draft.startingEquipment.length > 0 ? (
                  <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3">
                    <input
                      type="checkbox"
                      checked={addEquipment}
                      onChange={(event) => setAddEquipment(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[color:var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-textH">
                        Adicionar equipamento do antecedente ao inventário
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-textMuted">
                        {draft.startingEquipment
                          .map((item) =>
                            item.quantity > 1
                              ? `${item.name} ×${item.quantity}`
                              : item.name,
                          )
                          .join(", ")}
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>
            </main>

            <footer className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!draft.name.trim()}
                onClick={saveBackground}
              >
                <Check className="h-4 w-4" />
                Salvar antecedente
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

function BackgroundList({
  title,
  values,
  empty,
}: {
  title: string
  values: string[]
  empty: string
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="text-xs font-semibold text-textH">{title}</div>
      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="rounded-full border border-border bg-bg px-3 py-1 text-[11px] text-text"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-textMuted">{empty}</p>
      )}
    </div>
  )
}

function mergeProficiencies(
  current: Proficiency[],
  incoming: Proficiency[],
): Proficiency[] {
  const result = [...current]

  for (const proficiency of incoming) {
    const duplicate = result.some(
      (entry) =>
        entry.category === proficiency.category &&
        normalizeText(entry.name) === normalizeText(proficiency.name),
    )

    if (!duplicate) {
      result.push({ ...proficiency, id: proficiency.id || crypto.randomUUID() })
    }
  }

  return result
}

function formatCategory(category: Proficiency["category"]): string {
  const labels: Record<Proficiency["category"], string> = {
    skill: "Perícia",
    "saving-throw": "Salvaguarda",
    weapon: "Arma",
    armor: "Armadura",
    shield: "Escudo",
    tool: "Ferramenta",
    vehicle: "Veículo",
    mount: "Montaria",
    language: "Idioma",
    instrument: "Instrumento",
    game: "Jogo",
    other: "Outro",
  }

  return labels[category]
}

function emptyBackground(): CharacterBackground {
  return {
    id: "custom",
    name: "Antecedente personalizado",
    description: "",
    skillProficiencies: [],
    proficiencies: [],
    startingEquipment: [],
    featureName: "",
    featureDescription: "",
    custom: true,
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}
