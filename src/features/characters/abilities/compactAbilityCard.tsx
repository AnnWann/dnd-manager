import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Ability } from "../../../models/abilities/Ability"
import { AbilityCard } from "./abilityCard"

type Props = {
  ability: Ability
  sourceLabel?: string
  onEdit?: () => void
  onRemove?: () => void
  onUse?: () => void
  onRestore?: () => void
}

export function CompactAbilityCard({
  ability,
  sourceLabel,
  onEdit,
  onRemove,
  onUse,
  onRestore,
}: Props) {
  const [open, setOpen] = useState(false)
  const abilityName = ability.name || "Habilidade sem nome"
  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"
  const compactLabel = sourceLabel ? `${kindLabel} • ${sourceLabel}` : kindLabel
  const usage = ability.usage
  const remaining = usage ? Math.max(0, usage.max - usage.used) : null
  const canUse = ability.kind === "active" && Boolean(usage && onUse)
  const canRestore = Boolean(
    usage &&
      usage.reset !== "limited" &&
      usage.reset !== "spellSlot" &&
      onRestore,
  )

  useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <>
      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 sm:flex sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <div
            className="min-w-0 flex-1 truncate text-sm font-semibold text-textH"
            title={abilityName}
          >
            {abilityName}
          </div>

          <span className="shrink-0 text-xs text-textMuted" aria-hidden="true">
            —
          </span>

          <div
            className="max-w-[32%] shrink-0 truncate whitespace-nowrap text-xs text-text"
            title={compactLabel}
          >
            {compactLabel}
          </div>

          {usage ? (
            <div
              className="shrink-0 whitespace-nowrap text-xs text-textMuted"
              title={`${remaining}/${usage.max} usos restantes`}
            >
              {remaining}/{usage.max}
            </div>
          ) : null}
        </div>

        {canUse || canRestore ? (
          <div className="col-span-2 flex min-w-0 gap-2 sm:contents">
            {canUse ? (
              <Button
                className="min-w-0 flex-1 sm:flex-none sm:shrink-0"
                size="sm"
                variant="secondary"
                disabled={remaining !== null && remaining <= 0}
                onClick={onUse}
              >
                Usar
              </Button>
            ) : null}

            {canRestore ? (
              <Button
                className="min-w-0 flex-1 sm:flex-none sm:shrink-0"
                size="sm"
                variant="secondary"
                disabled={!usage || usage.used <= 0}
                onClick={onRestore}
              >
                Restaurar
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button
          className="shrink-0"
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          Visualizar
        </Button>
      </article>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${abilityName}`}
              className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center bg-black/80 p-3 sm:p-4"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false)
              }}
            >
              <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xl sm:max-h-[calc(100dvh-2rem)]">
                <header className="flex shrink-0 items-start justify-between gap-3 border-b border-accentBorder bg-bg/95 p-4 backdrop-blur">
                  <div className="min-w-0">
                    <h2
                      className="truncate font-heading text-lg text-textH"
                      title={abilityName}
                    >
                      {abilityName}
                    </h2>
                    <div
                      className="mt-1 truncate text-xs text-textMuted"
                      title={compactLabel}
                    >
                      {compactLabel}
                    </div>
                  </div>

                  <Button
                    className="shrink-0"
                    size="sm"
                    variant="secondary"
                    onClick={() => setOpen(false)}
                  >
                    Fechar
                  </Button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                  <AbilityCard
                    ability={ability}
                    sourceLabel={sourceLabel}
                    onEdit={
                      onEdit
                        ? () => {
                            setOpen(false)
                            onEdit()
                          }
                        : undefined
                    }
                    onRemove={
                      onRemove
                        ? () => {
                            setOpen(false)
                            onRemove()
                          }
                        : undefined
                    }
                    onUse={onUse}
                    onRestore={onRestore}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
