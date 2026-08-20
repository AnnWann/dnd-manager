import { BookPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

import {
  getAccessibleHomebrewSpells,
  type AccessibleHomebrewSpell,
} from "../api/user-spells"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { useMagicContext } from "../contexts/magicContext"
import { SpellArchiveActions } from "../features/magic/library/SpellArchiveActions"
import {
  SpellLibraryView,
  type SpellLibraryRecord,
} from "../features/magic/library/SpellLibraryView"
import type { Spell, SpellResourceType } from "../models/magic/spells/Spell"
import { SPELL_RESOURCE_OPTIONS } from "../models/magic/spells/spellResourceCost"

export function MagicView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const { savedSpells, saveSpells } = useMagicContext()
  const [resourceType, setResourceType] = useState<SpellResourceType | "slot">("slot")
  const [resourceAmount, setResourceAmount] = useState(1)
  const [userRecords, setUserRecords] = useState<AccessibleHomebrewSpell[]>([])
  const [userLibraryOpen, setUserLibraryOpen] = useState(false)
  const [selectedUserSpellIds, setSelectedUserSpellIds] = useState<string[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryMessage, setLibraryMessage] = useState("")

  const records = useMemo<SpellLibraryRecord[]>(
    () =>
      savedSpells.map((spell) => ({
        index: spell.index,
        owned: true,
      })),
    [savedSpells],
  )

  const savedIndexes = useMemo(
    () => new Set(savedSpells.map((spell) => spell.index)),
    [savedSpells],
  )

  useEffect(() => {
    let cancelled = false

    async function loadLibraries() {
      try {
        const accessible = await getAccessibleHomebrewSpells()
        if (!cancelled) setUserRecords(accessible)
      } catch {
        if (!cancelled) setUserRecords([])
      }
    }

    void loadLibraries()
    return () => {
      cancelled = true
    }
  }, [])

  function beginEditor(spell: Spell | null) {
    setResourceType(spell?.resourceCost?.resource ?? "slot")
    setResourceAmount(
      Math.max(1, Math.trunc(spell?.resourceCost?.amount ?? 1)),
    )
  }

  function prepareSpellForSave(spell: Spell): Spell {
    return {
      ...spell,
      resourceCost:
        resourceType === "slot"
          ? undefined
          : {
              resource: resourceType,
              amount: resourceAmount,
            },
    }
  }

  function openUserLibrary() {
    setSelectedUserSpellIds([])
    setLibraryMessage("")
    setUserLibraryOpen(true)
  }

  function toggleUserSpell(recordId: string) {
    setSelectedUserSpellIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId],
    )
  }

  async function addFromUserLibrary() {
    if (!selectedUserSpellIds.length || libraryLoading) return
    const selected = userRecords.filter((record) =>
      selectedUserSpellIds.includes(record.id),
    )
    if (!selected.length) return

    setLibraryLoading(true)
    setLibraryMessage("")
    try {
      saveSpells(selected.map((record) => ({ ...record.data, homebrew: true })))
      setLibraryMessage(`${selected.length} magia(s) adicionada(s) ao rascunho.`)
      setSelectedUserSpellIds([])
    } catch (error) {
      setLibraryMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar as magias selecionadas.",
      )
    } finally {
      setLibraryLoading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <SpellArchiveActions
        spells={savedSpells}
        exportName={`dndmm-homebrew-magias-${campaignId ?? "sessao"}`}
        onImport={(spells) => saveSpells(spells)}
      >
        <Button size="sm" variant="secondary" onClick={openUserLibrary}>
          <BookPlus className="h-4 w-4" />
          Adicionar da biblioteca do usuário
        </Button>
      </SpellArchiveActions>

      <SpellLibraryView
        variant="session"
        records={records}
        onEditorOpen={beginEditor}
        prepareSpellForSave={prepareSpellForSave}
        creatorPrelude={
          <section className="rounded-xl border border-accentBorder bg-bg p-3">
            <div className="text-xs font-semibold text-textH">
              Recurso de conjuração
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
              <label className="grid gap-1 text-xs text-text">
                Recurso
                <select
                  className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                  value={resourceType}
                  onChange={(event) =>
                    setResourceType(
                      event.target.value as SpellResourceType | "slot",
                    )
                  }
                >
                  <option value="slot">Espaço de magia (padrão)</option>
                  {SPELL_RESOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {resourceType !== "slot" ? (
                <label className="grid gap-1 text-xs text-text">
                  Custo
                  <Input
                    type="number"
                    min={1}
                    value={resourceAmount}
                    onChange={(event) =>
                      setResourceAmount(
                        Math.max(
                          1,
                          Math.trunc(Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                </label>
              ) : null}
            </div>

            {resourceType !== "slot" ? (
              <p className="mt-2 text-[11px] text-textMuted">
                Esse recurso substitui o gasto de espaço de magia ao usar a
                magia nesta sessão.
              </p>
            ) : null}
          </section>
        }
      />

      {userLibraryOpen ? (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">
                  Biblioteca do usuário
                </h2>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  Selecione magias homebrew acessíveis pela sua conta para criar cópias no rascunho da sessão.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setUserLibraryOpen(false)}
              >
                Fechar
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-2">
                {userRecords.length ? (
                  userRecords.map((record) => {
                    const selected = selectedUserSpellIds.includes(record.id)
                    const alreadyAdded = savedIndexes.has(record.index)
                    return (
                      <label
                        key={record.id}
                        className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected}
                          disabled={alreadyAdded}
                          onChange={() => toggleUserSpell(record.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-textH">
                            {record.name}
                          </span>
                          <span className="mt-1 block text-xs text-textMuted">
                            {alreadyAdded
                              ? "Já está na sessão"
                              : record.ownedByCurrentUser
                                ? "Sua homebrew"
                                : "Homebrew compartilhada"}
                          </span>
                        </span>
                      </label>
                    )
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-textMuted">
                    Nenhuma magia homebrew disponível na biblioteca do usuário.
                  </div>
                )}
              </div>

              {libraryMessage ? (
                <div className="mt-4 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
                  {libraryMessage}
                </div>
              ) : null}
            </div>

            <footer className="flex justify-end gap-2 border-t border-border p-4">
              <Button
                variant="secondary"
                onClick={() => setUserLibraryOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                loading={libraryLoading}
                disabled={!selectedUserSpellIds.length}
                onClick={() => void addFromUserLibrary()}
              >
                Adicionar ao rascunho
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
