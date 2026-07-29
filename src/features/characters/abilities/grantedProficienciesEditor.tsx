import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../../../models/sheet/Proficiency"

const CATEGORY_OPTIONS: Array<{
  value: ProficiencyCategory
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
  { value: "other", label: "Outra" },
]

export function GrantedProficienciesEditor({
  proficiencies,
  onChange,
}: {
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
}) {
  const [category, setCategory] =
    useState<ProficiencyCategory>("weapon")
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")

  function addProficiency() {
    const normalizedName = name.trim()
    if (!normalizedName) return

    const duplicate = proficiencies.some(
      (proficiency) =>
        proficiency.category === category &&
        normalizeName(proficiency.name) === normalizeName(normalizedName),
    )
    if (duplicate) return

    onChange([
      ...proficiencies,
      {
        id: crypto.randomUUID(),
        category,
        name: normalizedName,
        notes: notes.trim() || undefined,
      },
    ])
    setName("")
    setNotes("")
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div>
        <div className="text-xs font-semibold text-textH">
          Proficiências concedidas
        </div>
        <p className="mt-1 text-[11px] leading-4 text-textMuted">
          Enquanto os modificadores desta habilidade estiverem ativos, estas
          proficiências passam a fazer parte da ficha do personagem.
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
                  {categoryLabel(proficiency.category)}
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
          Nenhuma proficiência concedida.
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-[170px_1fr_auto] md:items-end">
        <label className="grid gap-1">
          <span className="text-xs text-textMuted">Categoria</span>
          <Select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ProficiencyCategory)
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
          <Input
            value={name}
            placeholder="Ex.: Ferramentas de ladrão"
            onChange={(event) => setName(event.target.value)}
          />
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

function categoryLabel(category: ProficiencyCategory): string {
  return (
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label ??
    category
  )
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
