import { BookOpen, Boxes, Shapes, WandSparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getSessionHomebrew,
  type SessionHomebrewAsset,
  type SessionHomebrewCatalog,
} from "../../api/session-homebrew"
import { Button } from "../../components/ui/Button"
import { useCustomSystemsContext } from "../../contexts/customSystemsContext"
import { useMagicContext } from "../../contexts/magicContext"
import { sessionPath } from "../../lib/campaignRoutes"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"
import type { Spell } from "../../models/magic/spells/Spell"

export function SessionHomebrewView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const navigate = useNavigate()
  const { savedSpells } = useMagicContext()
  const { definitions, saveDefinitions } = useCustomSystemsContext()
  const [catalog, setCatalog] = useState<SessionHomebrewCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null)
  const [viewingAsset, setViewingAsset] = useState<SessionHomebrewAsset | null>(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    setLoading(true)
    setErrorMessage("")
    void getSessionHomebrew(campaignId)
      .then((result) => {
        if (!cancelled) setCatalog(result)
      })
      .catch((error) => {
        if (!cancelled) {
          setCatalog(null)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o homebrew da sessão.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const spellEntries = useMemo(() => {
    const byIndex = new Map<
      string,
      {
        spell: Spell
        source: "session" | "approved"
        author?: string
      }
    >()

    for (const entry of catalog?.spells ?? []) {
      if (entry.status !== "APPROVED") continue
      byIndex.set(entry.index, {
        spell: { ...entry.data, homebrew: true },
        source: "approved",
        author: entry.author.name,
      })
    }

    for (const spell of savedSpells) {
      if (!spell.homebrew) continue
      const previous = byIndex.get(spell.index)
      byIndex.set(spell.index, {
        spell,
        source: previous?.source ?? "session",
        author: previous?.author,
      })
    }

    return Array.from(byIndex.values()).sort((left, right) =>
      spellName(left.spell).localeCompare(spellName(right.spell), "pt-BR"),
    )
  }, [catalog, savedSpells])

  const systemAssets = useMemo(
    () => catalog?.assets.filter((asset) => asset.type === "SYSTEM") ?? [],
    [catalog],
  )
  const classAssets = useMemo(
    () => catalog?.assets.filter((asset) => asset.type === "CLASS") ?? [],
    [catalog],
  )
  const otherAssets = useMemo(
    () => catalog?.assets.filter((asset) => asset.type === "OTHER") ?? [],
    [catalog],
  )

  const systemEntries = useMemo(() => {
    const byId = new Map<
      string,
      {
        definition?: CustomSystemDefinition
        asset?: SessionHomebrewAsset
      }
    >()

    for (const asset of systemAssets) {
      byId.set(asset.sourceId, { asset })
    }
    for (const definition of definitions) {
      const current = byId.get(definition.id) ?? {}
      byId.set(definition.id, { ...current, definition })
    }

    return Array.from(byId.values()).sort((left, right) =>
      (left.definition?.name ?? left.asset?.name ?? "").localeCompare(
        right.definition?.name ?? right.asset?.name ?? "",
        "pt-BR",
      ),
    )
  }, [definitions, systemAssets])

  useEffect(() => {
    const installedIds = new Set(definitions.map((definition) => definition.id))
    const missing = systemAssets
      .map((asset) => toCustomSystemDefinition(asset.data))
      .filter((definition): definition is CustomSystemDefinition => Boolean(definition))
      .filter((definition) => !installedIds.has(definition.id))

    if (missing.length) saveDefinitions(missing)
  }, [definitions, saveDefinitions, systemAssets])

  if (!campaignId) return <Navigate to="/not-found" replace />

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <header className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-accentBorder bg-accentBg p-2 text-accent">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-textH">Homebrew</h1>
              <p className="mt-1 text-sm text-textMuted">
                Visão central de todo conteúdo homebrew aprovado ou adicionado diretamente à sessão. Personagens ficam apenas na lista de personagens da sessão.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <CountBadge label="Magias" count={spellEntries.length} />
            <CountBadge label="Sistemas" count={systemEntries.length} />
            <CountBadge label="Classes" count={classAssets.length} />
            {otherAssets.length ? (
              <CountBadge label="Outros" count={otherAssets.length} />
            ) : null}
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <WandSparkles className="h-4 w-4 text-accent" />
              <h2 className="font-semibold text-textH">Magias homebrew</h2>
            </div>
            <p className="mt-1 text-xs text-textMuted">
              Inclui criações/importações do mestre e magias aprovadas em Solicitações.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(sessionPath(campaignId, "creation/magic"))}
          >
            Abrir biblioteca de magias
          </Button>
        </header>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <EmptyCard>Carregando homebrew...</EmptyCard>
          ) : spellEntries.length ? (
            spellEntries.map(({ spell, source, author }) => (
              <button
                key={spell.index}
                type="button"
                className="rounded-xl border border-border bg-bg-subtle p-4 text-left transition-colors hover:bg-accentBg"
                onClick={() => setViewingSpell(spell)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-textH">{spellName(spell)}</span>
                  <ContentBadge
                    label={spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`}
                  />
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {source === "approved"
                    ? `Aprovada${author ? ` · ${author}` : ""}`
                    : "Adicionada diretamente à sessão"}
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-text">
                  {spell.description?.trim() || "Sem descrição."}
                </p>
              </button>
            ))
          ) : (
            <EmptyCard>Nenhuma magia homebrew foi adicionada à sessão.</EmptyCard>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              <h2 className="font-semibold text-textH">Sistemas personalizados</h2>
            </div>
            <p className="mt-1 text-xs text-textMuted">
              Sistemas criados pelo mestre e sistemas aprovados enviados por jogadores.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(sessionPath(campaignId, "creation/custom-systems"))}
          >
            Gerenciar sistemas
          </Button>
        </header>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {systemEntries.length ? (
            systemEntries.map(({ definition, asset }) => (
              <button
                key={definition?.id ?? asset!.id}
                type="button"
                className="rounded-xl border border-border bg-bg-subtle p-4 text-left transition-colors hover:bg-accentBg"
                onClick={() => asset && setViewingAsset(asset)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-textH">
                    {definition?.name ?? asset?.name}
                  </span>
                  {asset ? <ContentBadge label="Aprovado" /> : null}
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {definition
                    ? `Versão ${definition.version}`
                    : asset
                      ? `Adicionado por ${asset.addedBy.name}`
                      : "Sistema"}
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-text">
                  {definition?.description?.trim() || "Sem descrição."}
                </p>
              </button>
            ))
          ) : (
            <EmptyCard>Nenhum sistema personalizado foi adicionado à sessão.</EmptyCard>
          )}
        </div>
      </section>

      <AssetSection
        title="Classes homebrew"
        description="Classes homebrew aprovadas para esta sessão."
        assets={classAssets}
        empty="Nenhuma classe homebrew foi adicionada à sessão."
        onView={setViewingAsset}
      />

      {otherAssets.length ? (
        <AssetSection
          title="Outros homebrews"
          description="Conteúdos homebrew de outros tipos aprovados para a sessão."
          assets={otherAssets}
          empty=""
          onView={setViewingAsset}
        />
      ) : null}

      {viewingSpell ? (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg shadow-xl">
            <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-bg p-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">
                  {spellName(viewingSpell)}
                </h2>
                <p className="mt-1 text-xs text-textMuted">
                  {viewingSpell.slotLevel === 0 ? "Truque" : `${viewingSpell.slotLevel}º nível`} · {viewingSpell.school}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewingSpell(null)}
              >
                Fechar
              </Button>
            </header>
            <div className="grid gap-4 p-4 text-sm text-text">
              <section>
                <h3 className="font-semibold text-textH">Descrição</h3>
                <p className="mt-2 whitespace-pre-wrap leading-6">
                  {viewingSpell.description?.trim() || "Sem descrição."}
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-textH">Em níveis superiores</h3>
                <p className="mt-2 whitespace-pre-wrap leading-6">
                  {viewingSpell.higherLevelText?.trim() || "Sem efeito adicional."}
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {viewingAsset ? (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg shadow-xl">
            <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-bg p-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">{viewingAsset.name}</h2>
                <p className="mt-1 text-xs text-textMuted">
                  {assetTypeLabel(viewingAsset.type)} · adicionado por {viewingAsset.addedBy.name}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewingAsset(null)}
              >
                Fechar
              </Button>
            </header>
            <div className="p-4">
              <pre className="max-h-[65dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
                {JSON.stringify(viewingAsset.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AssetSection({
  title,
  description,
  assets,
  empty,
  onView,
}: {
  title: string
  description: string
  assets: SessionHomebrewAsset[]
  empty: string
  onView: (asset: SessionHomebrewAsset) => void
}) {
  return (
    <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
      <header className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Shapes className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-textH">{title}</h2>
        </div>
        <p className="mt-1 text-xs text-textMuted">{description}</p>
      </header>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {assets.length ? (
          assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="rounded-xl border border-border bg-bg-subtle p-4 text-left transition-colors hover:bg-accentBg"
              onClick={() => onView(asset)}
            >
              <div className="font-medium text-textH">{asset.name}</div>
              <div className="mt-1 text-xs text-textMuted">
                {assetTypeLabel(asset.type)} · {asset.addedBy.name}
              </div>
            </button>
          ))
        ) : (
          <EmptyCard>{empty}</EmptyCard>
        )}
      </div>
    </section>
  )
}

function EmptyCard({ children }: { children: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-textMuted">
      {children}
    </div>
  )
}

function ContentBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
    </span>
  )
}

function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-textH">
      {label}: {count}
    </span>
  )
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function assetTypeLabel(type: SessionHomebrewAsset["type"]): string {
  if (type === "SYSTEM") return "Sistema homebrew"
  if (type === "CLASS") return "Classe homebrew"
  return "Homebrew"
}

function toCustomSystemDefinition(
  value: Record<string, unknown>,
): CustomSystemDefinition | null {
  if (typeof value.id !== "string" || typeof value.name !== "string") return null
  return value as unknown as CustomSystemDefinition
}
