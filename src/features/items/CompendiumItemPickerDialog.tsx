import { BookOpen, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  getSessionItemCompendium,
  type SessionItemCompendiumEntry,
} from "../../api/session-item-compendium"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import type { Itemmable } from "../../models/items/item"
import {
  buildSessionCompendiumItems,
  instantiateSessionCompendiumItem,
} from "./sessionItemCompendium"

type Props = {
  open: boolean
  campaignId: string
  onClose: () => void
  onSelect: (item: Itemmable) => void
}

export function CompendiumItemPickerDialog({
  open,
  campaignId,
  onClose,
  onSelect,
}: Props) {
  const [entries, setEntries] = useState<SessionItemCompendiumEntry[]>([])
  const [isMaster, setIsMaster] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setErrorMessage("")

    void getSessionItemCompendium(campaignId)
      .then((catalog) => {
        if (cancelled) return
        setEntries(catalog.entries)
        setIsMaster(catalog.campaign.isMaster)
      })
      .catch((error) => {
        if (!cancelled) {
          setEntries([])
          setIsMaster(false)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o compêndio.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [campaignId, open])

  const availableItems = useMemo(
    () =>
      buildSessionCompendiumItems(entries).filter(
        (entry) => isMaster || entry.visibility === "PUBLIC",
      ),
    [entries, isMaster],
  )

  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query)
    if (!normalized) return availableItems

    return availableItems.filter(({ item }) =>
      normalizeSearch(
        `${item.name} ${item.desc ?? ""} ${item.kind} ${item.category ?? ""}`,
      ).includes(normalized),
    )
  }, [availableItems, query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compendium-item-picker-title"
    >
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="compendium-item-picker-title"
                className="text-base font-semibold text-textH"
              >
                Adicionar do compêndio
              </h2>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {isMaster
                  ? "Como mestre, você pode adicionar itens públicos e itens visíveis apenas para mestres."
                  : "Apenas itens marcados como públicos podem ser adicionados por esta tela."}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="shrink-0 border-b border-border p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={query}
              autoFocus
              placeholder="Buscar por nome, descrição ou tipo"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-textMuted">
              Carregando compêndio...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((entry) => (
                <article
                  key={entry.item.id}
                  className="flex min-w-0 flex-col rounded-xl border border-border bg-bg p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-medium text-textH">
                      {entry.item.name}
                    </h3>
                    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
                      {entry.custom ? "Personalizado" : "Padrão"}
                    </span>
                    {isMaster && entry.visibility === "MASTER" ? (
                      <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] text-textMuted">
                        Somente mestre
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-textMuted">
                    {entry.item.kind} · {entry.item.weight ?? 0} kg · qtd. {entry.item.quantity ?? 1}
                  </div>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-text">
                    {entry.item.desc?.trim() || "Sem descrição."}
                  </p>
                  <Button
                    className="mt-4 w-full"
                    size="sm"
                    onClick={() => {
                      onSelect(instantiateSessionCompendiumItem(entry))
                      onClose()
                    }}
                  >
                    Adicionar item
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-textMuted">
              {isMaster
                ? "Nenhum item do compêndio corresponde à busca."
                : "Nenhum item público corresponde à busca."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}
