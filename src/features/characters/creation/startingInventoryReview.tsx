import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { ensureCharacterAcquisitionMetadata } from "../../../models/characters/characterAcquisitionMetadata"
import { mergeCurrencyStacks } from "../../../models/items/Currency"
import type { Itemmable } from "../../../models/items/item"
import { ItemCreationDialog } from "../../items/ItemCreationDialog"
import {
  STANDARD_ITEM_DEFINITIONS,
  findStandardDefinitionForItem,
  instantiateMatchingStandardItem,
  instantiateStandardItem,
  normalizeStandardItem,
  type StandardItemDefinition,
} from "../../items/standardItemCompendium"
import type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

type InventoryCategory =
  | "weapons"
  | "armor"
  | "shields"
  | "ammunition"
  | "consumables"
  | "supplies"
  | "tools"
  | "foci"
  | "instruments"
  | "packs"
  | "gear"
  | "currency"
  | "magic"

const CATEGORIES: Array<{
  value: InventoryCategory
  label: string
  description: string
}> = [
  { value: "weapons", label: "Armas", description: "Armas simples e marciais." },
  { value: "armor", label: "Armaduras", description: "Armaduras leves, médias e pesadas." },
  { value: "shields", label: "Escudos", description: "Escudos e defesas equipáveis." },
  { value: "ammunition", label: "Munições", description: "Flechas, virotes e projéteis." },
  { value: "consumables", label: "Consumíveis", description: "Poções e itens de uso único." },
  { value: "supplies", label: "Suprimentos", description: "Comida, água e recursos de viagem." },
  { value: "tools", label: "Ferramentas", description: "Ferramentas e kits de ofício." },
  { value: "foci", label: "Focos", description: "Focos arcanos, divinos e druídicos." },
  { value: "instruments", label: "Instrumentos", description: "Instrumentos musicais." },
  { value: "packs", label: "Pacotes", description: "Pacotes de equipamento inicial." },
  { value: "gear", label: "Equipamento geral", description: "Itens de exploração e aventura." },
  { value: "currency", label: "Moedas", description: "Cobre, prata, electrum, ouro e platina." },
  { value: "magic", label: "Itens mágicos", description: "Definições canônicas, como Bolsa Mágica." },
]

type Props = {
  character: CharacterTemplate
  plan: CharacterCreationProgressionPlan
  onCancel: () => void
  onConfirm: (character: CharacterTemplate) => void
}

export function StartingInventoryReview({
  character,
  plan,
  onCancel,
  onConfirm,
}: Props) {
  const [items, setItems] = useState<Itemmable[]>(() =>
    prepareStartingInventory(character.get("inventory") ?? []),
  )
  const [category, setCategory] = useState<InventoryCategory | null>(null)
  const [query, setQuery] = useState("")
  const [customOpen, setCustomOpen] = useState(false)

  const definitions = useMemo(() => {
    if (!category) return []
    const normalizedQuery = normalizeSearch(query)

    return STANDARD_ITEM_DEFINITIONS.filter(
      (definition) => itemCategory(definition.item) === category,
    ).filter((definition) => {
      if (!normalizedQuery) return true
      return normalizeSearch(
        [
          definition.item.name,
          definition.item.desc,
          definition.item.kind,
          definition.item.category,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery)
    })
  }, [category, query])

  function addDefinition(definition: StandardItemDefinition) {
    if (
      definition.item.category === "bagOfHolding" &&
      items.some((item) => item.category === "bagOfHolding")
    ) {
      return
    }

    setItems((current) =>
      mergeStartingStacks([
        ...current,
        instantiateStandardItem(definition.item.id, definition.item.quantity),
      ]),
    )
  }

  function updateQuantity(itemId: string, quantity: number) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item
        if (item.category === "bagOfHolding") return item
        return normalizeStandardItem({
          ...item,
          quantity: Math.max(0, Math.trunc(quantity || 0)),
        })
      }),
    )
  }

  function confirm() {
    const eventId = crypto.randomUUID()
    const addedAt = new Date().toISOString()
    const classLevel =
      character
        .get("sheet")
        .classes?.find((entry) => entry.className === plan.className)?.level ??
      plan.targetLevel
    const prepared = ensureCharacterAcquisitionMetadata(
      character.with("inventory", mergeStartingStacks(items)),
      {
        eventId,
        addedAt,
        reason: "character-creation",
        sourceType: "characterCreation",
        sourceName: "Criação de personagem",
        className: plan.className,
        classLevel,
        characterLevel: character
          .get("sheet")
          .classes?.reduce((sum, entry) => sum + entry.level, 0) ?? plan.targetLevel,
      },
    )

    onConfirm(prepared)
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-textH">Inventário inicial</h1>
          <p className="mt-1 text-sm leading-6 text-textMuted">
            Equipamentos de antecedente e classe foram convertidos para as mesmas definições do compêndio usadas pelo inventário normal. Revise, remova ou adicione itens antes de criar a ficha.
          </p>
        </div>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar criação
        </Button>
      </header>

      <div className="grid gap-3">
        {items.length ? (
          items.map((item) => {
            const definition = findStandardDefinitionForItem(item)
            const source = startingSource(item)
            return (
              <article
                key={item.id}
                className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-4 md:grid-cols-[minmax(0,1fr)_110px_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-textH">{item.name}</h2>
                    <Badge label={source} />
                    {definition ? <Badge label="Compêndio" /> : <Badge label="Personalizado" />}
                    {definition?.locked ? <Badge label="Definição protegida" /> : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-textMuted">
                    {item.desc || "Sem descrição."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-textMuted">
                    <span>Tipo: {item.kind}</span>
                    <span>Peso: {item.weight} kg por unidade</span>
                    {item.compendiumItemId ? (
                      <span>Origem: {item.compendiumItemId}</span>
                    ) : null}
                  </div>
                </div>

                <label className="grid gap-1 text-xs text-textMuted">
                  Quantidade
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity}
                    disabled={item.category === "bagOfHolding"}
                    onChange={(event) =>
                      updateQuantity(item.id, Number(event.target.value))
                    }
                  />
                </label>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                >
                  Remover
                </Button>
              </article>
            )
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-textMuted">
            Nenhum item inicial selecionado.
          </div>
        )}
      </div>

      <section className="rounded-xl border border-border bg-bg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-textH">Adicionar do compêndio</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Escolha primeiro uma categoria e depois o item.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setCustomOpen(true)}>
            Item personalizado
          </Button>
        </div>

        {category === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((entry) => {
              const count = STANDARD_ITEM_DEFINITIONS.filter(
                (definition) => itemCategory(definition.item) === entry.value,
              ).length
              return (
                <button
                  key={entry.value}
                  type="button"
                  className="rounded-xl border border-border bg-bg-subtle p-4 text-left hover:border-accentBorder hover:bg-accentBg"
                  onClick={() => {
                    setCategory(entry.value)
                    setQuery("")
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-textH">{entry.label}</span>
                    <Badge label={`${count} itens`} />
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-textMuted">
                    {entry.description}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={query}
                placeholder="Buscar item nesta categoria"
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCategory(null)
                  setQuery("")
                }}
              >
                Trocar categoria
              </Button>
            </div>

            <div className="grid max-h-[32rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {definitions.map((definition) => {
                const alreadyHasBag =
                  definition.item.category === "bagOfHolding" &&
                  items.some((item) => item.category === "bagOfHolding")
                return (
                  <button
                    key={definition.item.id}
                    type="button"
                    disabled={alreadyHasBag}
                    className="rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => addDefinition(definition)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-textH">
                        {definition.item.name}
                      </span>
                      {definition.locked ? <Badge label="Fixo" /> : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-textMuted">
                      {definition.item.desc || "Sem descrição."}
                    </p>
                    <div className="mt-2 text-[11px] text-textMuted">
                      {definition.item.weight} kg
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={confirm}>Criar personagem com este inventário</Button>
      </footer>

      <ItemCreationDialog
        open={customOpen}
        title="Adicionar item personalizado"
        onClose={() => setCustomOpen(false)}
        onSave={(item) => {
          setItems((current) => [...current, normalizeStandardItem(item)])
          setCustomOpen(false)
        }}
      />
    </section>
  )
}

function prepareStartingInventory(items: Itemmable[]): Itemmable[] {
  return mergeStartingStacks(
    items.map(
      (item) =>
        instantiateMatchingStandardItem(item) ?? normalizeStandardItem(item),
    ),
  )
}

function mergeStartingStacks(items: Itemmable[]): Itemmable[] {
  const currenciesMerged = mergeCurrencyStacks(items)
  const result: Itemmable[] = []
  const stackBySource = new Map<string, number>()

  for (const item of currenciesMerged) {
    if (item.kind === "currency" || item.category === "bagOfHolding") {
      result.push(item)
      continue
    }

    const source = item.compendiumItemId?.trim()
    if (!source) {
      result.push(item)
      continue
    }

    const existingIndex = stackBySource.get(source)
    if (existingIndex === undefined) {
      stackBySource.set(source, result.length)
      result.push(item)
      continue
    }

    const existing = result[existingIndex]
    result[existingIndex] = normalizeStandardItem({
      ...existing,
      quantity: (existing.quantity ?? 0) + (item.quantity ?? 0),
    })
  }

  return result.filter((item) => item.quantity > 0)
}

function startingSource(item: Itemmable): string {
  const text = `${item.notes ?? ""} ${item.desc ?? ""}`.toLocaleLowerCase("pt-BR")
  if (text.includes("antecedente")) return "Antecedente"
  if (text.includes("ouro inicial") || item.kind === "currency") return "Recursos iniciais"
  if (text.includes("classe")) return "Classe"
  return "Adicionado manualmente"
}

function itemCategory(item: Itemmable): InventoryCategory {
  if (item.category === "bagOfHolding") return "magic"
  if (item.kind === "currency") return "currency"
  if (item.kind === "shield" || item.equipSlot === "shield") return "shields"
  if (item.kind === "equipment" && item.equipSlot === "weapon") return "weapons"
  if (item.kind === "equipment" && item.equipSlot === "armor") return "armor"
  if (item.kind === "ammunition") return "ammunition"
  if (item.kind === "consumable") return "consumables"
  if (item.kind === "supply") return "supplies"
  if (item.kind === "tool") return "tools"
  if (item.kind === "focus") return "foci"
  if (item.kind === "instrument") return "instruments"
  if (item.kind === "pack") return "packs"
  return "gear"
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-medium text-textH">
      {label}
    </span>
  )
}
