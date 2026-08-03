import { useEffect, useMemo, useState } from "react"
import { Copy, PackagePlus, Plus, Search, Trash2 } from "lucide-react"
import { Navigate } from "react-router-dom"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { Textarea } from "../components/ui/Textarea"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import {
  BASIC_ITEM_COMPENDIUM,
  cloneCompendiumItem,
} from "../features/items/itemCompendium"
import { createCurrencyCompendiumItems } from "../models/items/Currency"
import type { ItemKind, Itemmable } from "../models/items/item"

const CUSTOM_TEMPLATES_STORAGE_KEY = "dndmm.itemCompendium.custom.v1"
const BASE_COMPENDIUM_ITEMS = [
  ...createCurrencyCompendiumItems(),
  ...BASIC_ITEM_COMPENDIUM,
]
const ITEM_KINDS = new Set<ItemKind>([
  "common",
  "equipment",
  "consumable",
  "throwable",
  "supply",
  "ammunition",
  "tool",
  "focus",
  "instrument",
  "pack",
  "gear",
  "currency",
  "shield",
])

export function ItemsCompendiumView() {
  const { userRole } = useSyncContext()
  const { addGroundItem } = useCharacterContext()
  const [query, setQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [templateJson, setTemplateJson] = useState(DEFAULT_TEMPLATE_JSON)
  const [templateError, setTemplateError] = useState("")
  const [customTemplates, setCustomTemplates] = useState<Itemmable[]>(
    readCustomTemplates,
  )

  useEffect(() => {
    window.localStorage.setItem(
      CUSTOM_TEMPLATES_STORAGE_KEY,
      JSON.stringify(customTemplates),
    )
  }, [customTemplates])

  const compendiumItems = useMemo(
    () => [...BASE_COMPENDIUM_ITEMS, ...customTemplates],
    [customTemplates],
  )

  const customTemplateIds = useMemo(
    () => new Set(customTemplates.map((item) => item.id)),
    [customTemplates],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return compendiumItems
    return compendiumItems.filter((item) =>
      `${item.name} ${item.desc} ${item.kind}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    )
  }, [compendiumItems, query])

  if (userRole !== "master") {
    return <Navigate to="/character" replace />
  }

  async function copyItem(itemId: string) {
    const item = compendiumItems.find((entry) => entry.id === itemId)
    if (!item) return
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
    setCopiedId(itemId)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  function addTemplates() {
    try {
      const parsed = JSON.parse(templateJson) as unknown
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      if (entries.length === 0) {
        throw new Error("Informe pelo menos um modelo de item.")
      }

      const templates = entries.map(normalizeTemplate)
      setCustomTemplates((current) => [...current, ...templates])
      setTemplateJson(DEFAULT_TEMPLATE_JSON)
      setTemplateError("")
      setCreating(false)
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "JSON de item inválido.",
      )
    }
  }

  function removeTemplate(itemId: string) {
    setCustomTemplates((current) =>
      current.filter((item) => item.id !== itemId),
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-textH">Compêndio de Itens</h1>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Modelos prontos para consulta, cópia em JSON ou adição ao chão. Esta área é exclusiva do mestre.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setCreating((current) => !current)
                setTemplateError("")
              }}
            >
              <Plus className="h-4 w-4" />
              Adicionar modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <label className="relative block max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={query}
              placeholder="Buscar por nome, descrição ou tipo"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      {creating ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-textH">Novo modelo</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Cole um item ou uma lista de itens em JSON. Campos adicionais são preservados para armas, armaduras, consumíveis e outros tipos.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Textarea
                rows={14}
                value={templateJson}
                aria-label="JSON do modelo de item"
                onChange={(event) => setTemplateJson(event.target.value)}
              />
              {templateError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {templateError}
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCreating(false)
                    setTemplateError("")
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" onClick={addTemplates}>
                  Salvar modelo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const custom = customTemplateIds.has(item.id)
          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-textH">
                        {item.name}
                      </h2>
                      {custom ? (
                        <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                          Personalizado
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-textMuted">
                      {item.kind} · quantidade {item.quantity}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg border border-border bg-bg-subtle px-2 py-1 text-xs text-textH">
                    {item.weight} kg
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="min-h-12 text-sm leading-6 text-text">{item.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => addGroundItem(cloneCompendiumItem(item))}
                  >
                    <PackagePlus className="h-4 w-4" />
                    Adicionar ao chão
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => copyItem(item.id)}>
                    <Copy className="h-4 w-4" />
                    {copiedId === item.id ? "Copiado" : "Copiar JSON"}
                  </Button>
                  {custom ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Excluir modelo personalizado"
                      onClick={() => removeTemplate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-10 text-center text-sm text-textMuted">
          Nenhum item encontrado.
        </div>
      ) : null}
    </div>
  )
}

function readCustomTemplates(): Itemmable[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY) ?? "[]",
    ) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      try {
        return [normalizeStoredTemplate(entry)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

function normalizeTemplate(value: unknown): Itemmable {
  const item = normalizeStoredTemplate(value)
  return {
    ...item,
    id: `compendium-custom-${crypto.randomUUID()}`,
  }
}

function normalizeStoredTemplate(value: unknown): Itemmable {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cada modelo precisa ser um objeto JSON.")
  }

  const raw = value as Record<string, unknown>
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name) throw new Error("Cada modelo precisa ter um nome.")

  const kind = raw.kind
  if (typeof kind !== "string" || !ITEM_KINDS.has(kind as ItemKind)) {
    throw new Error(`O item ${name} possui um tipo inválido.`)
  }

  const quantity = Number(raw.quantity ?? 1)
  const weight = Number(raw.weight ?? 0)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`A quantidade de ${name} precisa ser maior que zero.`)
  }
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error(`O peso de ${name} não pode ser negativo.`)
  }

  return {
    ...raw,
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : `compendium-custom-${crypto.randomUUID()}`,
    name,
    desc: typeof raw.desc === "string" ? raw.desc : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    quantity,
    weight,
    pocketable: raw.pocketable !== false,
    kind: kind as ItemKind,
  } as Itemmable
}

const DEFAULT_TEMPLATE_JSON = `{
  "name": "Novo item",
  "desc": "Descrição do modelo.",
  "notes": "",
  "quantity": 1,
  "weight": 0,
  "pocketable": true,
  "kind": "gear"
}`
