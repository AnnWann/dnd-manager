import { useMemo, useState } from "react"
import { Plus, Search, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../../../models/sheet/Proficiency"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type ManagedProficiencyCategory = Exclude<
  ProficiencyCategory,
  "skill" | "saving-throw"
>

type CategoryOption = {
  value: ManagedProficiencyCategory
  label: string
  description: string
}

type DisplayProficiency = {
  proficiency: Proficiency & {
    category: ManagedProficiencyCategory
  }
  source: "character" | "race"
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: "weapon",
    label: "Armas",
    description: "Armas simples, marciais ou específicas.",
  },
  {
    value: "armor",
    label: "Armaduras",
    description: "Armaduras leves, médias, pesadas ou específicas.",
  },
  {
    value: "shield",
    label: "Escudos",
    description: "Escudos e proficiências defensivas similares.",
  },
  {
    value: "tool",
    label: "Ferramentas",
    description: "Ferramentas de ladrão, artesão, kits etc.",
  },
  {
    value: "vehicle",
    label: "Veículos",
    description: "Veículos terrestres, aquáticos ou especiais.",
  },
  {
    value: "mount",
    label: "Montarias",
    description: "Cavalos, montarias exóticas ou treinamento similar.",
  },
  {
    value: "language",
    label: "Idiomas",
    description: "Idiomas falados, escritos ou compreendidos.",
  },
  {
    value: "instrument",
    label: "Instrumentos",
    description: "Instrumentos musicais.",
  },
  {
    value: "game",
    label: "Jogos",
    description: "Baralhos, dados, xadrez, jogos de azar etc.",
  },
  {
    value: "other",
    label: "Outros",
    description: "Qualquer proficiência que não se encaixe acima.",
  },
]

const DEFAULT_CATEGORY: ManagedProficiencyCategory = "weapon"

export function CharacterProficienciesTab({
  character,
  updateCharacter,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] =
    useState<ManagedProficiencyCategory | "all">("all")
  const [search, setSearch] = useState("")

  const characterProficiencies = toManagedProficiencies(
    character.get("sheet").proficiencies ?? [],
  )
  const racialProficiencies = toManagedProficiencies(
    character.get("sheet").race.proficiencies ?? [],
  )

  const displayedProficiencies: DisplayProficiency[] = [
    ...characterProficiencies.map((proficiency) => ({
      proficiency,
      source: "character" as const,
    })),
    ...racialProficiencies.map((proficiency) => ({
      proficiency,
      source: "race" as const,
    })),
  ]

  const filteredProficiencies = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return displayedProficiencies.filter(({ proficiency }) => {
      const matchesCategory =
        activeCategory === "all" ||
        proficiency.category === activeCategory

      const matchesSearch =
        normalizedSearch.length === 0 ||
        proficiency.name.toLocaleLowerCase().includes(normalizedSearch) ||
        proficiency.notes?.toLocaleLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, displayedProficiencies, search])

  const groupedProficiencies = useMemo(
    () =>
      CATEGORY_OPTIONS.map((category) => ({
        category,
        entries: filteredProficiencies.filter(
          ({ proficiency }) =>
            proficiency.category === category.value,
        ),
      })).filter((group) => group.entries.length > 0),
    [filteredProficiencies],
  )

  function addProficiency(proficiency: Omit<Proficiency, "id">) {
    const nextProficiency: Proficiency = {
      id: crypto.randomUUID(),
      ...proficiency,
    }

    updateCharacter(character.get("id"), (current) =>
      current.withSheet("proficiencies", [
        ...(current.get("sheet").proficiencies ?? []),
        nextProficiency,
      ]),
    )
  }

  function removeProficiency(proficiencyId: string) {
    updateCharacter(character.get("id"), (current) =>
      current.withSheet(
        "proficiencies",
        (current.get("sheet").proficiencies ?? []).filter(
          (proficiency) => proficiency.id !== proficiencyId,
        ),
      ),
    )
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-textH">
              Proficiências
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              Proficiências próprias e concedidas pela raça do personagem.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Adicionar proficiência
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
          <Select
            value={activeCategory}
            onChange={(event) =>
              setActiveCategory(
                event.target.value as
                  | ManagedProficiencyCategory
                  | "all",
              )
            }
          >
            <option value="all">Todas as categorias</option>

            {CATEGORY_OPTIONS.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />

            <Input
              className="pl-9"
              value={search}
              placeholder="Buscar proficiência..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </section>

      {groupedProficiencies.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {groupedProficiencies.map(({ category, entries }) => (
            <ProficiencyGroup
              key={category.value}
              category={category}
              entries={entries}
              onRemove={removeProficiency}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          onAdd={() => setModalOpen(true)}
          hasFilters={
            search.trim().length > 0 || activeCategory !== "all"
          }
        />
      )}

      <AddProficiencyModal
        open={modalOpen}
        existingProficiencies={[
          ...characterProficiencies,
          ...racialProficiencies,
        ]}
        onClose={() => setModalOpen(false)}
        onSave={(proficiency) => {
          addProficiency(proficiency)
          setModalOpen(false)
        }}
      />
    </div>
  )
}

function ProficiencyGroup({
  category,
  entries,
  onRemove,
}: {
  category: CategoryOption
  entries: DisplayProficiency[]
  onRemove: (proficiencyId: string) => void
}) {
  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-textH">
          {category.label}
        </h3>

        <p className="mt-0.5 text-[11px] text-textMuted">
          {category.description}
        </p>
      </div>

      <div className="grid gap-2">
        {entries.map(({ proficiency, source }) => (
          <div
            key={`${source}:${proficiency.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-medium text-textH">
                  {proficiency.name}
                </div>

                {source === "race" ? (
                  <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Raça
                  </span>
                ) : null}
              </div>

              {proficiency.notes ? (
                <div className="mt-0.5 line-clamp-2 text-xs text-textMuted">
                  {proficiency.notes}
                </div>
              ) : null}
            </div>

            {source === "character" ? (
              <button
                type="button"
                title="Remover proficiência"
                aria-label={`Remover ${proficiency.name}`}
                onClick={() => onRemove(proficiency.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-danger hover:bg-dangerBg hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <span className="text-[10px] font-medium text-textMuted">
                Gerenciada em Raça
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function EmptyState({
  hasFilters,
  onAdd,
}: {
  hasFilters: boolean
  onAdd: () => void
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-bg p-8 text-center shadow-theme-sm">
      <div className="mx-auto max-w-sm">
        <h3 className="text-sm font-semibold text-textH">
          {hasFilters
            ? "Nenhuma proficiência encontrada"
            : "Nenhuma proficiência cadastrada"}
        </h3>

        <p className="mt-1 text-xs text-textMuted">
          {hasFilters
            ? "Tente mudar a busca ou a categoria selecionada."
            : "Adicione treinamentos com armas, armaduras, ferramentas, idiomas e outros recursos."}
        </p>

        {!hasFilters ? (
          <Button
            className="mt-4"
            size="sm"
            variant="primary"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            Adicionar primeira proficiência
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function AddProficiencyModal({
  open,
  existingProficiencies,
  onClose,
  onSave,
}: {
  open: boolean
  existingProficiencies: Proficiency[]
  onClose: () => void
  onSave: (proficiency: Omit<Proficiency, "id">) => void
}) {
  const [category, setCategory] =
    useState<ManagedProficiencyCategory>(DEFAULT_CATEGORY)
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  if (!open) return null

  function resetAndClose() {
    setCategory(DEFAULT_CATEGORY)
    setName("")
    setNotes("")
    setError("")
    onClose()
  }

  function save() {
    const trimmedName = name.trim()
    const trimmedNotes = notes.trim()

    if (!trimmedName) {
      setError("Informe o nome da proficiência.")
      return
    }

    const duplicated = existingProficiencies.some(
      (proficiency) =>
        proficiency.category === category &&
        proficiency.name.trim().toLocaleLowerCase() ===
          trimmedName.toLocaleLowerCase(),
    )

    if (duplicated) {
      setError("Essa proficiência já existe nessa categoria.")
      return
    }

    onSave({
      category,
      name: trimmedName,
      notes: trimmedNotes || undefined,
    })

    setCategory(DEFAULT_CATEGORY)
    setName("")
    setNotes("")
    setError("")
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={resetAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-proficiency-title"
        className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-4 text-text shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2
              id="add-proficiency-title"
              className="text-base font-semibold text-textH"
            >
              Adicionar proficiência
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              Registre um treinamento ou conhecimento do personagem.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={resetAndClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-border hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 py-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Categoria
            </span>

            <Select
              value={category}
              onChange={(event) => {
                setCategory(
                  event.target.value as ManagedProficiencyCategory,
                )
                setError("")
              }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Nome
            </span>

            <Input
              value={name}
              placeholder="Ex: Armas marciais, Ferramentas de ladrão, Dracônico..."
              invalid={Boolean(error)}
              onChange={(event) => {
                setName(event.target.value)
                setError("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  save()
                }
              }}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Observações
              <span className="font-normal text-textMuted">
                {" "}
                opcional
              </span>
            </span>

            <Textarea
              className="min-h-20"
              value={notes}
              placeholder="Ex: concedido pela origem, por treinamento, por item mágico..."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={resetAndClose}
          >
            Cancelar
          </Button>

          <Button size="sm" variant="primary" onClick={save}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}

function toManagedProficiencies(
  proficiencies: Proficiency[],
): Array<
  Proficiency & {
    category: ManagedProficiencyCategory
  }
> {
  return proficiencies.filter(
    (
      proficiency,
    ): proficiency is Proficiency & {
      category: ManagedProficiencyCategory
    } =>
      proficiency.category !== "skill" &&
      proficiency.category !== "saving-throw",
  )
}
