import { Select as SharedSelect } from "../../components/ui/Select"
import {
  Copy,
  Eye,
  EyeOff,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Navigate } from "react-router-dom"

import type {
  SessionItemCompendiumEntry,
  SessionItemCompendiumVisibility,
} from "../../api/session-item-compendium"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { useCharacterContext } from "../../contexts/characterContext"
import { useSyncContext } from "../../contexts/syncContext"
import { useCreationEditor } from "../../features/creation/CreationEditorProvider"
import { ItemCreationDialog } from "../../features/items/ItemCreationDialog"
import {
  buildSessionCompendiumItems,
  instantiateSessionCompendiumItem,
  type SessionCompendiumItem,
} from "../../features/items/sessionItemCompendium"
import type { Itemmable } from "../../models/items/item"
import type { CreationItemCompendiumEntry } from "../../shared/creation/creation.types"

export function SessionCreationItemsCompendiumView() {
  const { userRole } = useSyncContext()
  const { addGroundItem } = useCharacterContext()
  const editor = useCreationEditor()
  const [query, setQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingEntry, setEditingEntry] = useState<SessionCompendiumItem | null>(null)

  const draftEntries = editor.draft?.itemCompendium ?? []
  const entries = useMemo<SessionItemCompendiumEntry[]>(
    () => draftEntries.map((entry) => ({
      id: entry.templateId,
      templateId: entry.templateId,
      item: entry.item,
      custom: entry.custom,
      visibility: entry.visibility,
    })),
    [draftEntries],
  )

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

  if (userRole !== "master" && userRole !== "assistant") {
    return <Navigate to="/character" replace />
  }

  function upsertDraftEntry(entry: CreationItemCompendiumEntry) {
    editor.updateDraft((draft) => ({
      ...draft,
      itemCompendium: [
        ...draft.itemCompendium.filter(
          (current) => current.templateId !== entry.templateId,
        ),
        entry,
      ],
    }))
  }

  function removeDraftEntry(templateId: string) {
    editor.updateDraft((draft) => ({
      ...draft,
      itemCompendium: draft.itemCompendium.filter(
        (entry) => entry.templateId !== templateId,
      ),
    }))
  }

  async function copyItem(item: Itemmable) {
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  function addCustomItem(item: Itemmable) {
    const template = normalizeTemplate(item)
    upsertDraftEntry({
      templateId: template.id,
      item: template,
      custom: true,
      visibility: "PUBLIC",
    })
    setCreating(false)
  }

  function editCustomItem(item: Itemmable) {
    const current = editingEntry
    if (!current?.custom) return

    const template = {
      ...normalizeTemplate(item),
      id: current.item.id,
    }
    upsertDraftEntry({
      templateId: current.item.id,
      item: template,
      custom: true,
      visibility: current.visibility,
    })
    setEditingEntry(null)
  }

  function changeVisibility(
    entry: SessionCompendiumItem,
    visibility: SessionItemCompendiumVisibility,
  ) {
    upsertDraftEntry({
      templateId: entry.item.id,
      item: structuredClone(entry.item),
      custom: entry.custom,
      visibility,
    })
  }

  function removeTemplate(itemId: string) {
    removeDraftEntry(itemId)
    if (editingEntry?.item.id === itemId) setEditingEntry(null)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-textH">Compêndio de Itens</h1>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Alterações ficam no rascunho de Criação. Nenhuma chamada de persistência é feita até Salvar alterações.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
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
                      <Badge label={entry.custom ? "Personalizado" : protectedItem ? "Canônico" : "Padrão"} />
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
                <p className="min-h-12 text-sm leading-6 text-text">{item.desc}</p>

                <label className="mt-4 grid gap-1 text-xs text-textMuted">
                  Visibilidade
                  <SharedSelect
                    className="h-9 rounded-lg border border-border bg-bg px-3 text-sm text-textH outline-none"
                    value={entry.visibility}
                    onChange={(event) =>
                      changeVisibility(
                        entry,
                        event.target.value as SessionItemCompendiumVisibility,
                      )
                    }
                  >
                    <option value="PUBLIC">Público</option>
                    <option value="MASTER">Somente mestre</option>
                  </SharedSelect>
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => addGroundItem(instantiateSessionCompendiumItem(entry))}
                  >
                    <PackagePlus className="h-4 w-4" />
                    Adicionar ao chão
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void copyItem(item)}>
                    <Copy className="h-4 w-4" />
                    {copiedId === item.id ? "Copiado" : "Copiar JSON"}
                  </Button>
                  {entry.custom ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditingEntry(entry)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Excluir item personalizado"
                        onClick={() => removeTemplate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
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

      <ItemCreationDialog
        open={creating}
        title="Adicionar item ao compêndio"
        enableJson
        saveLabel="Adicionar item"
        onClose={() => setCreating(false)}
        onSave={addCustomItem}
      />

      <ItemCreationDialog
        open={editingEntry !== null}
        title="Editar item do compêndio"
        item={editingEntry?.item ?? null}
        enableJson
        saveLabel="Salvar no rascunho"
        onClose={() => setEditingEntry(null)}
        onSave={editCustomItem}
      />
    </div>
  )
}

function Badge({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {icon}
      {label}
    </span>
  )
}

function normalizeTemplate(item: Itemmable): Itemmable {
  return {
    ...structuredClone(item),
    id: item.id || crypto.randomUUID(),
    quantity: Math.max(1, Number(item.quantity) || 1),
  }
}
