import { useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Ability } from "../../../models/abilities/Ability"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  open: boolean
  title: string
  features: Ability[]
  replacements: Record<string, Ability>
  onReplace: (originalId: string, replacement: Ability | null) => void
  onClose: () => void
}

export function FeatureReplacementModal({
  open,
  title,
  features,
  replacements,
  onReplace,
  onClose,
}: Props) {
  const [selectedOriginal, setSelectedOriginal] = useState<Ability | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  if (!open) return null

  function openReplacement(feature: Ability) {
    setSelectedOriginal(feature)
    setEditorOpen(true)
  }

  function save(replacement: Ability) {
    if (!selectedOriginal) return
    onReplace(selectedOriginal.id, {
      ...replacement,
      source: selectedOriginal.source,
      category:
        replacement.category === "feat" || replacement.category === "invocation"
          ? "general"
          : replacement.category,
      originalAbilityId: selectedOriginal.id,
    })
    setEditorOpen(false)
    setSelectedOriginal(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">{title}</h2>
            <div className="mt-1 text-xs text-textMuted">
              {Object.keys(replacements).length} substituição(ões) configurada(s)
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
          {features.length ? (
            <div className="grid gap-2">
              {features.map((feature) => {
                const replacement = replacements[feature.id]
                return (
                  <article
                    key={feature.id}
                    className="rounded-xl border border-border bg-bg p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-textH">{feature.name}</div>
                        {feature.description?.trim() ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                            {feature.description}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={replacement ? "primary" : "secondary"}
                        onClick={() => openReplacement(feature)}
                      >
                        {replacement ? "Editar troca" : "Substituir"}
                      </Button>
                    </div>

                    {replacement ? (
                      <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-accentBorder bg-accentBg p-3">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-textMuted">
                            Será substituída por
                          </div>
                          <div className="mt-1 font-medium text-textH">
                            {replacement.name}
                          </div>
                          {replacement.description?.trim() ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                              {replacement.description}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReplace(feature.id, null)}
                        >
                          Desfazer
                        </Button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted">
              Nenhuma característica anterior disponível para substituição.
            </div>
          )}
        </div>

        <AbilityDialog
          open={editorOpen}
          ability={selectedOriginal ? replacements[selectedOriginal.id] ?? null : null}
          title={
            selectedOriginal
              ? `Substituir ${selectedOriginal.name}`
              : "Substituir característica"
          }
          onClose={() => {
            setEditorOpen(false)
            setSelectedOriginal(null)
          }}
          onSave={save}
        />
      </section>
    </div>,
    document.body,
  )
}
