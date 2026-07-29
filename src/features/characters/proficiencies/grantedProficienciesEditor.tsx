import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import {
  OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
  OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
} from "../../../models/characters/characterHands"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../../../models/sheet/Proficiency"

const OCCUPIED_HANDS_SPELLCASTING_TYPE =
  "occupied-hands-spellcasting" as const

type GrantedProficiencyType =
  | ProficiencyCategory
  | typeof OCCUPIED_HANDS_SPELLCASTING_TYPE

const CATEGORY_OPTIONS: Array<{
  value: GrantedProficiencyType
  label: string
}> = [
  { value: "weapon", label: "Arma" },
  { value: "armor", label: "Armadura" },
  { value: "shield", label: "Escudo" },
  { value: "tool", label: "Ferramenta" },
  { value: "vehicle", label: "Veículo" },
  { value: "mount", label: "Montaria" },
  { value: "language", label: "Idioma" },
  { value: "instrument", label: "Instrumento" },
  { value: "game", label: "Jogo" },
  { value: "skill", label: "Perícia" },
  { value: "saving-throw", label: "Teste de resistência" },
  {
    value: OCCUPIED_HANDS_SPELLCASTING_TYPE,
    label: OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  },
  { value: "other", label: "Outra" },
]

type ProficiencyPreset = {
  value: string
  label: string
}

const SAVING_THROW_OPTIONS: ProficiencyPreset[] = [
  { value: "Força", label: "Força (FOR)" },
  { value: "Destreza", label: "Destreza (DES)" },
  { value: "Constituição", label: "Constituição (CON)" },
  { value: "Inteligência", label: "Inteligência (INT)" },
  { value: "Sabedoria", label: "Sabedoria (SAB)" },
  { value: "Carisma", label: "Carisma (CAR)" },
]

const SKILL_OPTIONS: ProficiencyPreset[] = [
  { value: "Acrobacia", label: "Acrobacia (DES)" },
  { value: "Arcanismo", label: "Arcanismo (INT)" },
  { value: "Atletismo", label: "Atletismo (FOR)" },
  { value: "Atuação", label: "Atuação (CAR)" },
  { value: "Blefe", label: "Blefe (CAR)" },
  { value: "Furtividade", label: "Furtividade (DES)" },
  { value: "História", label: "História (INT)" },
  { value: "Intimidação", label: "Intimidação (CAR)" },
  { value: "Intuição", label: "Intuição (SAB)" },
  { value: "Investigação", label: "Investigação (INT)" },
  { value: "Lidar com Animais", label: "Lidar com Animais (SAB)" },
  { value: "Medicina", label: "Medicina (SAB)" },
  { value: "Natureza", label: "Natureza (INT)" },
  { value: "Percepção", label: "Percepção (SAB)" },
  { value: "Persuasão", label: "Persuasão (CAR)" },
  { value: "Prestidigitação", label: "Prestidigitação (DES)" },
  { value: "Religião", label: "Religião (INT)" },
  { value: "Sobrevivência", label: "Sobrevivência (SAB)" },
]

const OCCUPIED_HANDS_OPTIONS: ProficiencyPreset[] = [
  {
    value: OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
    label: OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  },
]

export function GrantedProficienciesEditor({
  proficiencies,
  onChange,
  title = "Proficiências concedidas",
  description =
    "Enquanto esta fonte estiver ativa, estas proficiências passam a fazer parte da ficha do personagem.",
  emptyMessage = "Nenhuma proficiência concedida.",
}: {
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
  title?: string
  description?: string
  emptyMessage?: string
}) {
  const [category, setCategory] =
    useState<GrantedProficiencyType>("weapon")
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const presetOptions = getPresetOptions(category)

  function changeCategory(nextCategory: GrantedProficiencyType) {
    const nextOptions = getPresetOptions(nextCategory)
    setCategory(nextCategory)
    setName(nextOptions?.[0]?.value ?? "")
  }

  function addProficiency() {
    const occupiedHands =
      category === OCCUPIED_HANDS_SPELLCASTING_TYPE
    const storedCategory: ProficiencyCategory = occupiedHands
      ? "other"
      : category
    const normalizedName = (
      occupiedHands
        ? OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME
        : name
    ).trim()

    if (!normalizedName) return

    const duplicate = proficiencies.some((proficiency) => {
      if (
        occupiedHands &&
        proficiency.id ===
          OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID
      ) {
        return true
      }

      return (
        proficiency.category === storedCategory &&
        normalizeName(proficiency.name) ===
          normalizeName(normalizedName)
      )
    })
    if (duplicate) return

    onChange([
      ...proficiencies,
      {
        id: occupiedHands
          ? OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID
          : crypto.randomUUID(),
        category: storedCategory,
        name: normalizedName,
        notes: notes.trim() || undefined,
      },
    ])
    setName(presetOptions?.[0]?.value ?? "")
    setNotes("")
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div>
        <div className="text-xs font-semibold text-textH">{title}</div>
        <p className="mt-1 text-[11px] leading-4 text-textMuted">
          {description}
        </p>
      </div>

      {proficiencies.length > 0 ? (
        <div className="grid gap-2">
          {proficiencies.map((proficiency) => (
            <div
              key={proficiency.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-textH">
                  {proficiency.name}
                </div>
                <div className="mt-0.5 text-[10px] text-textMuted">
                  {categoryLabel(proficiency)}
                </div>
                {proficiency.notes ? (
                  <div className="mt-1 text-xs leading-5 text-textMuted">
                    {proficiency.notes}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={`Remover ${proficiency.name}`}
                onClick={() =>
                  onChange(
                    proficiencies.filter(
                      (current) => current.id !== proficiency.id,
                    ),
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-dangerBg hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
          {emptyMessage}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-[170px_1fr_auto] md:items-end">
        <label className="grid gap-1">
          <span className="text-xs text-textMuted">Categoria</span>
          <Select
            value={category}
            onChange={(event) =>
              changeCategory(
                event.target.value as GrantedProficiencyType,
              )
            }
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-textMuted">Proficiência</span>
          {presetOptions ? (
            <Select
              value={name}
              onChange={(event) => setName(event.target.value)}
            >
              {presetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={name}
              placeholder="Ex.: Ferramentas de ladrão"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </label>

        <Button
          size="sm"
          variant="secondary"
          disabled={!name.trim()}
          onClick={addProficiency}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <label className="grid gap-1">
        <span className="text-xs text-textMuted">Observação opcional</span>
        <Textarea
          className="min-h-16"
          value={notes}
          placeholder="Condições ou limitações da proficiência."
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
    </section>
  )
}

function getPresetOptions(
  category: GrantedProficiencyType,
): ProficiencyPreset[] | undefined {
  if (category === "saving-throw") return SAVING_THROW_OPTIONS
  if (category === "skill") return SKILL_OPTIONS
  if (category === OCCUPIED_HANDS_SPELLCASTING_TYPE) {
    return OCCUPIED_HANDS_OPTIONS
  }
  return undefined
}

function categoryLabel(proficiency: Proficiency): string {
  if (
    proficiency.id ===
      OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
    normalizeName(proficiency.name) ===
      normalizeName(
        OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
      )
  ) {
    return OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME
  }

  return (
    CATEGORY_OPTIONS.find(
      (option) => option.value === proficiency.category,
    )?.label ?? proficiency.category
  )
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
