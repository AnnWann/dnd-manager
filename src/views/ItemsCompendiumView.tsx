import {
  Copy,
  Eye,
  EyeOff,
  PackagePlus,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

import {
  deleteSessionItemCompendiumEntry,
  getSessionItemCompendium,
  upsertSessionItemCompendiumEntry,
  type SessionItemCompendiumEntry,
  type SessionItemCompendiumVisibility,
} from "../api/session-item-compendium"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { ItemCreationDialog } from "../features/items/ItemCreationDialog"
import {
  buildSessionCompendiumItems,
  instantiateSessionCompendiumItem,
  type SessionCompendiumItem,
} from "../features/items/sessionItemCompendium"
import type { ItemKind, Itemmable } from "../models/items/item"

const LEGACY_CUSTOM_TEMPLATES_STORAGE_KEY = "dndmm.itemCompendium.custom.v1"
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
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { userRole } = useSyncContext()
  const { addGroundItem } = useCharacterContext()
  const [query, setQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [entries, setEntries] = useState<SessionItemCompendiumEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!campaignId || userRole !== "master") return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage("")
      try {
        const catalog = await getSessionItemCompendium(campaignId!)
        let nextEntries = catalog.entries

        const legacyTemplates = readLegacyCustomTemplates()
        if (legacyTemplates.length) {
          const knownIds = new Set(nextEntries.map((entry) => entry.templateId))
          const missing = legacyTemplates.filter((item) => !knownIds.has(item.id))

          if (missing.length) {
            const imported = await Promise.all(
              missing.map((item) =>
                upsertSessionItemCompendiumEntry(campaignId!, {
                  item,
                  custom: true,
                  visibility: "PUBLIC",
                }),
              ),
            )
            nextEntries = mergeEntries(nextEntries, imported)
          }

          window.localStorage.removeItem(LEGACY_CUSTOM_TEMPLATES_STORAGE_KEY)
        }

        if (!cancelled) setEntries(nextEntries)
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o compêndio de itens.",
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [campaignId, userRole])

  const compendiumItems = useMemo(
    () => buildSessionCompendiumItems(entries),
    [entries],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return compendiumItems
    return compendiumItems.filter(({ item }) =>
      `${item.name} ${item.desc} ${item.kind} ${item.category ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    )
  }, [compendiumItems, query])

  if (userRole !== "master") {
    return <Navigate to="/character" replace />
  }

  if (!campaignId) {
    return <Navigate to="/not-found" replace />
  }

  async function copyItem(item: Itemmable) {
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  async function addCustomItem(item: Itemmable) {
    const template = normalizeTemplate(item)
    setWorkingId(template.id)
    setErrorMessage("")
    try {
      const saved = await upsertSessionItemCompendiumEntry(campaignId!, {
        item: template,
        custom: true,
        visibility: "PUBLIC",
      })
      setEntries((current) => mergeEntries(current, [saved]))
      setCreating(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o item ao compêndio.",
      )
    } finally {
      setWorkingId("")
    }
  }

  async function changeVisibility(
    entry: SessionCompendiumItem,
    visibility: SessionItemCompendiumVisibility,
  ) {
    if (workingId) return
    setWorkingId(entry.item.id)
    setErrorMessage("")
    try {
      const saved = await upsertSessionItemCompendiumEntry(campaignId!, {
        item: entry.item,
        custom: entry.custom,
        visibility,
      })
      setEntries((current) => mergeEntries(current, [saved]))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a visibilidade do item.",
      )
    } finally {
      setWorkingId("")
    }
  }

  async function removeTemplate(itemId: string) {
    if (workingId) return
    setWorkingId(itemId)
    setErrorMessage("")
    try {
      await deleteSessionItemCompendiumEntry(campaignId!, itemId)
      setEntries((current) =>
        current.filter((entry) => entry.templateId !== itemId),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o item do compêndio.",
      )
    } finally {
      setWorkingId("")
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-textH">
                Compêndio de Itens
              </h1>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Itens públicos podem ser adicionados diretamente pelas telas de inventário. Itens de mestre permanecem visíveis apenas na área de criação.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar item
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

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-10 text-center text-sm text-textMuted">
          Carregando compêndio...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            const item = entry.item
            const protectedItem =
              !entry.custom &&
              (item.kind === "currency" || item.category === "bagOfHolding")
            const publicItem = entry.visibility === "PUBLIC"

            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-textH">
                          {item.name}
                        </h2>
                        {entry.custom ? (
                          <Badge label="Personalizado" />
                        ) : protectedItem ? (
                          <Badge label="Canônico" />
                        ) : (
                          <Badge label="Padrão" />
                        )}
                        <Badge
                          label={publicItem ? "Público" : "Somente mestre"}
                          icon={publicItem ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        />
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
                  <p className="min-h-12 text-sm leading-6 text-text">
                    {item.desc}
                  </p>

                  <label className="mt-4 grid gap-1 text-xs text-textMuted">
                    Visibilidade
                    <select
                      className="h-9 rounded-lg border border-border bg-bg px-3 text-sm text-textH outline-none"
                      value={entry.visibility}
                      disabled={Boolean(workingId)}
                      onChange={(event) =>
                        void changeVisibility(
                          entry,
                          event.target.value as SessionItemCompendiumVisibility,
                        )
                      }
                    >
                      <option value="PUBLIC">Público</option>
                      <option value="MASTER">Somente mestre</option>
                    </select>
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!publicItem || Boolean(workingId)}
                      title={
                        publicItem
                          ? "Adicionar uma cópia ao chão"
                          : "Itens de mestre precisam ser públicos para entrar em inventários"
                      }
                      onClick={() =>
                        addGroundItem(instantiateSessionCompendiumItem(entry))
                      }
                    >
                      <PackagePlus className="h-4 w-4" />
                      Adicionar ao chão
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void copyItem(item)}
                    >
                      <Copy className="h-4 w-4" />
                      {copiedId === item.id ? "Copiado" : "Copiar JSON"}
                    </Button>
                    {entry.custom ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(workingId)}
                        title="Excluir item personalizado"
                        onClick={() => void removeTemplate(item.id)}
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
      )}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-10 text-center text-sm text-textMuted">
          Nenhum item encontrado.
        </div>
      ) : null}

      <ItemCreationDialog
        open={creating}
        title="Adicionar item ao compêndio"
        enableJson
        saveLabel="Adicionar item"
        onClose={() => setCreating(false)}
        onSave={(item) => void addCustomItem(item)}
      />
    </div>
  )
}

function Badge({
  label,
  icon,
}: {
  label: string
  icon?: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {icon}
      {label}
    </span>
  )
}

function mergeEntries(
  current: SessionItemCompendiumEntry[],
  incoming: SessionItemCompendiumEntry[],
): SessionItemCompendiumEntry[] {
  const byTemplateId = new Map(
    current.map((entry) => [entry.templateId, entry]),
  )
  for (const entry of incoming) byTemplateId.set(entry.templateId, entry)
  return Array.from(byTemplateId.values())
}

function readLegacyCustomTemplates(): Itemmable[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LEGACY_CUSTOM_TEMPLATES_STORAGE_KEY) ?? "[]",
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
    quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
  }
}

function normalizeStoredTemplate(value: unknown): Itemmable {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cada item precisa ser um objeto válido.")
  }

  const raw = value as Record<string, unknown>
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name) throw new Error("Cada item precisa ter um nome.")

  const kind = raw.kind
  if (typeof kind !== "string" || !ITEM_KINDS.has(kind as ItemKind)) {
    throw new Error(`O item ${name} possui um tipo inválido.`)
  }

  const quantity = Number(raw.quantity ?? 1)
  const weight = Number(raw.weight ?? 0)
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`A quantidade de ${name} não pode ser negativa.`)
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
