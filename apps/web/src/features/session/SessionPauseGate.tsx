import { useEffect, useRef, type ReactNode } from "react"
import { LockKeyhole, PauseCircle } from "lucide-react"

import { shouldBlockPlayerSessionUI } from "../../shared/session-runtime/sessionPause"
import { useOptionalSessionRuntime } from "../session-runtime/useSessionRuntime"

/**
 * Only players are locked out. The master can continue editing and resume the
 * game using the header control. The Durable Object independently rejects all
 * player mutations while paused; this is the visual/accessibility layer.
 */
export function SessionPauseGate({ children }: { children: ReactNode }) {
  const runtime = useOptionalSessionRuntime()
  const pausedForPlayer = shouldBlockPlayerSessionUI(runtime?.role, runtime?.pauseState)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pausedForPlayer) dialogRef.current?.focus()
  }, [pausedForPlayer])

  return (
    <>
      <div inert={pausedForPlayer} aria-hidden={pausedForPlayer}>
        {children}
      </div>
      {pausedForPlayer ? (
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-paused-title"
          aria-describedby="session-paused-description"
          className="fixed inset-0 z-[20000] flex min-h-dvh items-center justify-center bg-[color:var(--surface-app)]/95 p-5 text-text backdrop-blur-md focus:outline-none"
        >
          <div className="w-full max-w-md rounded-2xl border border-accentBorder bg-bg-elevated p-7 text-center shadow-2xl sm:p-10">
            <PauseCircle className="mx-auto h-12 w-12 text-accent" aria-hidden="true" />
            <h2 id="session-paused-title" className="mt-5 text-2xl font-semibold text-textH">
              Sessão pausada
            </h2>
            <p id="session-paused-description" className="mt-3 text-sm leading-6 text-textMuted">
              O mestre pausou o jogo. As fichas, rolagens e demais ações estão temporariamente bloqueadas.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-subtle px-4 py-2 text-xs text-textMuted">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Aguarde o mestre retomar a sessão
            </div>
            <p className="mt-4 text-xs text-textMuted">
              A tela será liberada automaticamente quando o jogo for retomado.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
