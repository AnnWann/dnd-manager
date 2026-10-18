import { useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Ability } from "../../../models/abilities/Ability"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  open: boolean
  invocations: Ability[]
  originalInvocations?: Ability[]
  max: number
  replacementLimit?: number
  onChange: (invocations: Ability[]) => void
  onClose: () => void
}

export function InvocationSelectionModal({
  open,
  invocations,
  originalInvocations = [],
  max,
  replacementLimit = 0,
  onChange,
  onClose,
}: Props) {
  const [editing, setEditing] = useState<Ability | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [replacingId, setReplacingId] = useState<string | null>(null)

  if (!open) return null

  const originalIds = new Set(originalInvocations.map((entry) => entry.id))
  const currentIds = new Set(invocations.map((entry) => entry.id))
  const replacementsUsed = originalInvocations.filter(
    (entry) => !currentIds.has(entry.id),
  ).length

  function openNew() {
    if (invocations.length >= max) return
    setReplacingId(null)
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(invocation: Ability) {
    setReplacingId(null)
    setEditing(invocation)
    setEditorOpen(true)
  }

  function openReplacement(invocation: Ability) {
    if (!originalIds.has(invocation.id)) return
    if (replacementLimit <= 0 || replacementsUsed >= replacementLimit) return
    setReplacingId(invocation.id)
    setEditing(null)
    setEditorOpen(true)
  }

  function save(ability: Ability) {
    const invocation: Ability = {
      ...ability,
      category: "invocation",
      source: "class",
    }

    if (replacingId) {
      onChange(
        invocations.map((entry) =>
          entry.id === replacingId ? invocation : entry,
        ),
      )
    } else {
      const exists = invocations.some((entry) => entry.id === invocation.id)
      onChange(
        exists
          ? invocations.map((entry) =>
              entry.id === invocation.id ? invocation : entry,
            )
          : [...invocations, invocation].slice(0, max),
      )
    }

    setEditorOpen(false)
    setEditing(null)
    setReplacingId(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold text-textH [overflow-wrap:anywhere]">
              Evocações
            </h2>
            <div className="mt-1 text-xs text-textMuted">
              {invocations.length}/{max} configuradas
              {replacementLimit > 0
                ? ` · ${replacementsUsed}/${replacementLimit} substituição`
                : ""}
            </div>
          </div>
          <Button className="shrink-0" size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="mt-4 grid min-h-0 min-w-0 flex-1 gap-2 overflow-y-auto overflow-x-hidden pr-1">
          {invocations.length ? (
            invocations.map((invocation) => {
              const isOriginal = originalIds.has(invocation.id)
              const canReplace =
                isOriginal &&
                replacementLimit > 0 &&
                replacementsUsed < replacementLimit

              return (
                <article
                  key={invocation.id}
                  className="flex min-w-0 items-start justify-between gap-3 overflow-hidden rounded-xl border border-border bg-bg p-3"
                >
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="break-words font-medium text-textH [overflow-wrap:anywhere]">
                      {invocation.name}
                    </div>
                    {invocation.description?.trim() ? (
                      <p className="mt-1 line-clamp-3 max-w-full overflow-hidden break-words text-xs leading-5 text-textMuted [overflow-wrap:anywhere]">
                        {invocation.description}
                      </p>
                    ) : null}
                    {isOriginal ? (
                      <div className="mt-1 text-[10px] text-textMuted">
                        Evocação anterior
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(invocation)}
                    >
                      Editar
                    </Button>
                    {isOriginal ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canReplace}
                        onClick={() => openReplacement(invocation)}
                      >
                        Substituir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onChange(
                            invocations.filter((entry) => entry.id !== invocation.id),
                          )
                        }
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">
              Nenhuma evocação configurada.
            </div>
          )}
        </div>

        <footer className="mt-4 flex shrink-0 justify-end border-t border-border pt-4">
          <Button disabled={max <= 0 || invocations.length >= max} onClick={openNew}>
            Adicionar evocação
          </Button>
        </footer>

        <AbilityDialog
          open={editorOpen}
          ability={editing}
          title={
            replacingId
              ? "Substituir evocação"
              : editing
                ? "Editar evocação"
                : "Adicionar evocação"
          }
          fixedCategory="invocation"
          onClose={() => {
            setEditorOpen(false)
            setEditing(null)
            setReplacingId(null)
          }}
          onSave={save}
        />
      </section>
    </div>,
    document.body,
  )
}
