import { useMemo, useState } from "react"

import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { useMagicContext } from "../../contexts/magicContext"
import { SpellCreatorModule } from "../../features/magic/spellCreator/spellCreatorModule"
import { useUserMagicState } from "../../features/magic/UserMagicProvider"
import type { Spell } from "../../models/magic/spells/Spell"

export function UserSpellsTab() {
  const {
    spells,
    saveSpell,
    deleteSpell,
  } = useMagicContext()
  const {
    records,
    loading,
    errorMessage,
  } = useUserMagicState()

  const [query, setQuery] = useState("")
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null)
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null)

  const recordByIndex = useMemo(
    () => new Map(records.map((record) => [record.index, record])),
    [records],
  )

  const filteredSpells = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")

    return spells
      .filter((spell) => {
        if (!normalizedQuery) return true

        return [
          spell.displayName,
          spell.name,
          spell.description,
          spell.school,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLocaleLowerCase("pt-BR")
              .includes(normalizedQuery),
          )
      })
      .toSorted((left, right) => {
        if (left.slotLevel !== right.slotLevel) {
          return left.slotLevel - right.slotLevel
        }

        return (left.displayName || left.name).localeCompare(
          right.displayName || right.name,
          "pt-BR",
        )
      })
  }, [query, spells])

  const ownedCount = records.filter(
    (record) => record.ownedByCurrentUser,
  ).length
  const campaignCount = records.filter(
    (record) =>
      !record.ownedByCurrentUser &&
      record.campaigns.some(
        (campaign) => campaign.status === "APPROVED",
      ),
  ).length

  function openCreate() {
    setEditingSpell(null)
    setCreatorOpen(true)
  }

  function openEdit(spell: Spell) {
    const record = recordByIndex.get(spell.index)
    if (!record?.ownedByCurrentUser) return

    setEditingSpell(spell)
    setCreatorOpen(true)
  }

  function closeCreator() {
    setEditingSpell(null)
    setCreatorOpen(false)
  }

  function archiveSpell(spell: Spell) {
    const record = recordByIndex.get(spell.index)
    if (!record?.ownedByCurrentUser) return

    const confirmed = window.confirm(
      `Arquivar “${spell.displayName || spell.name}”? A magia deixará de aparecer na sua biblioteca, mas os registros históricos serão preservados.`,
    )

    if (confirmed) deleteSpell(spell.index)
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">
              Biblioteca de magias
            </h1>

            <p className="mt-1 text-sm text-textMuted">
              Magias oficiais, magias próprias e magias aprovadas nas suas campanhas.
            </p>
          </div>

          <Button onClick={openCreate}>
            Criar magia homebrew
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <LibraryBadge label={`${spells.length} disponíveis`} />
          <LibraryBadge label={`${ownedCount} próprias`} />
          <LibraryBadge label={`${campaignCount} de campanhas`} />
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-textMuted">
            Carregando magias relacionais...
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Magias disponíveis
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Magias compartilhadas por campanha são somente leitura quando você não é o autor.
          </div>
        </CardHeader>

        <CardContent>
          <Input
            value={query}
            placeholder="Buscar por nome, escola ou descrição"
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="mt-4 grid gap-3">
            {filteredSpells.map((spell) => {
              const record = recordByIndex.get(spell.index)
              const owned = Boolean(record?.ownedByCurrentUser)
              const campaignNames =
                record?.campaigns
                  .filter((campaign) => campaign.status === "APPROVED")
                  .map((campaign) => campaign.name) ?? []

              return (
                <article
                  key={spell.index}
                  className="rounded-xl border border-border bg-bg-subtle p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setViewingSpell(spell)}
                    >
                      <div className="truncate text-sm font-semibold text-textH">
                        {spell.displayName || spell.name}
                      </div>
                      <div className="mt-1 text-xs text-textMuted">
                        {formatLevel(spell.slotLevel)} · {spell.school}
                        {spell.concentration ? " · Concentração" : ""}
                        {spell.ritual ? " · Ritual" : ""}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                        {!spell.homebrew ? (
                          <LibraryBadge label="Oficial" />
                        ) : owned ? (
                          <LibraryBadge label="Sua homebrew" />
                        ) : (
                          <LibraryBadge label="Homebrew de campanha" />
                        )}

                        {campaignNames.map((campaignName) => (
                          <LibraryBadge
                            key={campaignName}
                            label={campaignName}
                          />
                        ))}
                      </div>
                    </button>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setViewingSpell(spell)}
                      >
                        Ver
                      </Button>

                      {owned ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(spell)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => archiveSpell(spell)}
                          >
                            Arquivar
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {creatorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-semibold text-textH">
                {editingSpell ? "Editar magia" : "Criar magia homebrew"}
              </h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={closeCreator}
              >
                Fechar
              </Button>
            </div>

            <div className="p-4">
              <SpellCreatorModule
                editingSpell={editingSpell}
                saveSpell={(spell) => {
                  saveSpell(spell)
                  closeCreator()
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {viewingSpell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-bg p-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">
                  {viewingSpell.displayName || viewingSpell.name}
                </h2>
                <div className="mt-1 text-xs text-textMuted">
                  {formatLevel(viewingSpell.slotLevel)} · {viewingSpell.school}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewingSpell(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-text">
              {viewingSpell.description || "Sem descrição."}
            </div>

            {viewingSpell.higherLevelText?.trim() ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-textH">
                  Em níveis superiores
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
                  {viewingSpell.higherLevelText}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LibraryBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-textH">
      {label}
    </span>
  )
}

function formatLevel(level: number): string {
  return level === 0 ? "Truque" : `Nível ${level}`
}
