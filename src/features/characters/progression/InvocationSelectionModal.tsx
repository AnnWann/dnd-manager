import { useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Ability } from "../../../models/abilities/Ability"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  open: boolean
  invocations: Ability[]
  max: number
  onChange: (invocations: Ability[]) => void
  onClose: () => void
}

export function InvocationSelectionModal({
  open,
  invocations,
  max,
  onChange,
  onClose,
}: Props) {
  const [editing, setEditing] = useState<Ability | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  if (!open) return null

  function openNew() {
    if (invocations.length >= max) return
    setEditing(null)
    setEditorOpen(true)
  }

  function save(ability: Ability) {
    const invocation: Ability = {
      ...ability,
      category: "invocation",
      source: "class",
    }
    const exists = invocations.some((entry) => entry.id === invocation.id)
    onChange(
      exists
        ? invocations.map((entry) =>
            entry.id === invocation.id ? invocation : entry,
          )
        : [...invocations, invocation].slice(0, max),
    )
    setEditorOpen(false)
    setEditing(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[12400] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <section className="w-full max-w-3xl rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">Evocações</h2>
            <div className="mt-1 text-xs text-textMuted">
              {invocations.length}/{max} configuradas
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="mt-4 grid max-h-[60dvh] gap-2 overflow-y-auto pr-1">
          {invocations.length ? (
            invocations.map((invocation) => (
              <article
                key={invocation.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-textH">{invocation.name}</div>
                  {invocation.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                      {invocation.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(invocation)
                      setEditorOpen(true)
                    }}
                  >
                    Editar
                  </Button>
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
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">
              Nenhuma evocação configurada.
            </div>
          )}
        </div>

        <footer className="mt-4 flex justify-end border-t border-border pt-4">
          <Button disabled={max <= 0 || invocations.length >= max} onClick={openNew}>
            Adicionar evocação
          </Button>
        </footer>

        <AbilityDialog
          open={editorOpen}
          ability={editing}
          title={editing ? "Editar evocação" : "Adicionar evocação"}
          fixedCategory="invocation"
          onClose={() => {
            setEditorOpen(false)
            setEditing(null)
          }}
          onSave={save}
        />
      </section>
    </div>,
    document.body,
  )
}
