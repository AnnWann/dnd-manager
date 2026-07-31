import { useMemo, useState } from "react"
import { Copy, PackagePlus, Search } from "lucide-react"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { useCharacterContext } from "../contexts/characterContext"
import {
  BASIC_ITEM_COMPENDIUM,
  cloneCompendiumItem,
} from "../features/items/itemCompendium"

export function ItemsCompendiumView() {
  const { addGroundItem } = useCharacterContext()
  const [query, setQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return BASIC_ITEM_COMPENDIUM
    return BASIC_ITEM_COMPENDIUM.filter((item) =>
      `${item.name} ${item.desc} ${item.kind}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    )
  }, [query])

  async function copyItem(itemId: string) {
    const item = BASIC_ITEM_COMPENDIUM.find((entry) => entry.id === itemId)
    if (!item) return
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
    setCopiedId(itemId)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold text-textH">Compêndio de Itens</h1>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Modelos básicos prontos para consulta, cópia em JSON ou adição ao chão.
          </p>
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
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-textH">
                    {item.name}
                  </h2>
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-10 text-center text-sm text-textMuted">
          Nenhum item encontrado.
        </div>
      ) : null}
    </div>
  )
}
