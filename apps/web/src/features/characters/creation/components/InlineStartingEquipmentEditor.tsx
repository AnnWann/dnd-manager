import { useMemo, useState } from "react"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import type { Itemmable } from "../../../../models/items/item"
import { ItemCreationDialog } from "../../../items/ItemCreationDialog"
import {
  STANDARD_ITEM_DEFINITIONS,
  findStandardDefinitionForItem,
  instantiateStandardItem,
  normalizeStandardItem,
} from "../../../items/standardItemCompendium"

type Category =
  | "all"
  | "weapon"
  | "armor"
  | "shield"
  | "tool"
  | "focus"
  | "instrument"
  | "pack"
  | "gear"
  | "consumable"
  | "supply"
  | "ammunition"
  | "currency"
  | "magic"

const CATEGORY_LABELS: Record<Category, string> = {
  all: "Todas as categorias",
  weapon: "Armas",
  armor: "Armaduras",
  shield: "Escudos",
  tool: "Ferramentas",
  focus: "Focos",
  instrument: "Instrumentos",
  pack: "Pacotes",
  gear: "Equipamento geral",
  consumable: "Consumíveis",
  supply: "Suprimentos",
  ammunition: "Munições",
  currency: "Moedas",
  magic: "Itens mágicos",
}

type Props = {
  title: string
  description: string
  items: Itemmable[]
  sourceLabel: string
  onChange: (items: Itemmable[]) => void
}

export function InlineStartingEquipmentEditor({
  title,
  description,
  items,
  sourceLabel,
  onChange,
}: Props) {
  const [category, setCategory] = useState<Category>("all")
  const [query, setQuery] = useState("")
  const [customOpen, setCustomOpen] = useState(false)

  const definitions = useMemo(() => {
    const normalizedQuery = normalize(query)
    return STANDARD_ITEM_DEFINITIONS.filter((definition) => {
      const itemCategory = categoryForItem(definition.item)
      if (category !== "all" && itemCategory !== category) return false
      if (!normalizedQuery) return true
      return normalize(
        `${definition.item.name} ${definition.item.desc ?? ""} ${definition.item.kind}`,
      ).includes(normalizedQuery)
    }).slice(0, 80)
  }, [category, query])

  function addItem(item: Itemmable) {
    if (
      item.category === "bagOfHolding" &&
      items.some((entry) => entry.category === "bagOfHolding")
    ) {
      return
    }

    const normalized = normalizeStandardItem({
      ...item,
      id: crypto.randomUUID(),
      notes: mergeNotes(item.notes, `Equipamento inicial: ${sourceLabel}.`),
    })
    const stackKey = normalized.compendiumItemId
    if (!stackKey || normalized.category === "bagOfHolding") {
      onChange([...items, normalized])
      return
    }

    const existingIndex = items.findIndex(
      (entry) => entry.compendiumItemId === stackKey,
    )
    if (existingIndex < 0) {
      onChange([...items, normalized])
      return
    }

    onChange(
      items.map((entry, index) =>
        index === existingIndex
          ? normalizeStandardItem({
              ...entry,
              quantity: entry.quantity + normalized.quantity,
            })
          : entry,
      ),
    )
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-textH">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">{description}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setCustomOpen(true)}>
          Adicionar item personalizado
        </Button>
      </div>

      <div className="grid gap-3">
        {items.length ? (
          items.map((item) => {
            const definition = findStandardDefinitionForItem(item)
            return (
              <article
                key={item.id}
                className="grid gap-3 rounded-lg border border-border bg-bg p-3 md:grid-cols-[minmax(0,1fr)_110px_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-textH">{item.name}</strong>
                    <Badge>{definition ? "Compêndio" : "Personalizado"}</Badge>
                    <Badge>{sourceLabel}</Badge>
                  </div>
                  <details className="mt-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium text-textH">
                      Ler detalhes do item
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">
                      {item.desc?.trim() || "Sem descrição cadastrada."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-textMuted">
                      <span>Tipo: {item.kind}</span>
                      <span>Peso por unidade: {item.weight} kg</span>
                      <span>{item.pocketable ? "Pode ir ao bolso" : "Não cabe no bolso"}</span>
                    </div>
                  </details>
                </div>

                <label className="grid gap-1 text-xs text-textMuted">
                  Quantidade
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity}
                    disabled={item.category === "bagOfHolding"}
                    onChange={(event) => {
                      const quantity = Math.max(
                        0,
                        Math.trunc(Number(event.target.value) || 0),
                      )
                      onChange(
                        items
                          .map((entry) =>
                            entry.id === item.id
                              ? normalizeStandardItem({ ...entry, quantity })
                              : entry,
                          )
                          .filter((entry) => entry.quantity > 0),
                      )
                    }}
                  />
                </label>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChange(items.filter((entry) => entry.id !== item.id))
                  }
                >
                  Remover
                </Button>
              </article>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg p-5 text-center text-xs text-textMuted">
            Nenhum equipamento selecionado para esta origem.
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-textMuted">
            Categoria
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-textMuted">
            Buscar no compêndio
            <Input
              value={query}
              placeholder="Nome ou descrição"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {definitions.map((definition) => {
            const bagBlocked =
              definition.item.category === "bagOfHolding" &&
              items.some((entry) => entry.category === "bagOfHolding")
            return (
              <button
                key={definition.item.id}
                type="button"
                disabled={bagBlocked}
                onClick={() =>
                  addItem(
                    instantiateStandardItem(
                      definition.item.id,
                      definition.item.quantity,
                    ),
                  )
                }
                className="rounded-lg border border-border bg-bg p-3 text-left hover:border-accentBorder hover:bg-accentBg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="font-medium text-textH">{definition.item.name}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-textMuted">
                  {definition.item.desc || "Sem descrição."}
                </div>
                <div className="mt-2 text-[10px] text-textMuted">
                  {definition.item.weight} kg · {CATEGORY_LABELS[categoryForItem(definition.item)]}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <ItemCreationDialog
        open={customOpen}
        title={`Adicionar equipamento de ${sourceLabel}`}
        onClose={() => setCustomOpen(false)}
        onSave={(item) => {
          addItem(item)
          setCustomOpen(false)
        }}
      />
    </section>
  )
}

function categoryForItem(item: Itemmable): Category {
  if (item.category === "bagOfHolding") return "magic"
  if (item.kind === "currency") return "currency"
  if (item.kind === "shield" || item.equipSlot === "shield") return "shield"
  if (item.kind === "equipment" && item.equipSlot === "weapon") return "weapon"
  if (item.kind === "equipment" && item.equipSlot === "armor") return "armor"
  if (item.kind === "tool") return "tool"
  if (item.kind === "focus") return "focus"
  if (item.kind === "instrument") return "instrument"
  if (item.kind === "pack") return "pack"
  if (item.kind === "consumable") return "consumable"
  if (item.kind === "supply") return "supply"
  if (item.kind === "ammunition") return "ammunition"
  return "gear"
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function mergeNotes(current: string | undefined, next: string): string {
  const parts = [current?.trim(), next.trim()].filter(Boolean)
  return Array.from(new Set(parts)).join(" ")
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}
