import { useMemo, useState, type FormEvent } from "react"
import { Navigate, useParams, useSearchParams } from "react-router-dom"

import { SessionRuntimeProvider } from "../../features/session-runtime/SessionRuntimeProvider"
import type { SessionRuntimeRole } from "../../features/session-runtime/sessionProtocol"
import { useSessionRuntime } from "../../features/session-runtime/useSessionRuntime"

export function SessionRuntimeDevView() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/not-found" replace />
  }

  const { sessionId } = useParams<{ sessionId?: string }>()
  const [searchParams] = useSearchParams()

  if (!sessionId) {
    return <Navigate to="/not-found" replace />
  }

  const userId = searchParams.get("userId")?.trim() || "dev-user"
  const role: SessionRuntimeRole =
    searchParams.get("role")?.toUpperCase() === "MASTER" ? "MASTER" : "PLAYER"

  return (
    <SessionRuntimeProvider
      sessionId={sessionId}
      userId={userId}
      role={role}
    >
      <SessionRuntimeDevPanel
        sessionId={sessionId}
        initialUserId={userId}
        initialRole={role}
      />
    </SessionRuntimeProvider>
  )
}

function SessionRuntimeDevPanel({
  sessionId,
  initialUserId,
  initialRole,
}: {
  sessionId: string
  initialUserId: string
  initialRole: SessionRuntimeRole
}) {
  const runtime = useSessionRuntime()
  const [, setSearchParams] = useSearchParams()
  const [userId, setUserId] = useState(initialUserId)
  const [role, setRole] = useState<SessionRuntimeRole>(initialRole)

  const heartbeatLabel = useMemo(() => {
    if (!runtime.lastHeartbeatAckAt) return "Ainda não recebido"
    return new Date(runtime.lastHeartbeatAckAt).toLocaleTimeString()
  }, [runtime.lastHeartbeatAckAt])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams({ userId: userId.trim() || "dev-user", role })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">
          Development only
        </p>
        <h1 className="text-2xl font-semibold">Session Runtime Test</h1>
        <p className="mt-2 text-sm text-textMuted">
          Use the same session ID in multiple browsers to validate WebSocket presence and reconnection without creating a campaign locally.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[1fr_180px_auto]"
      >
        <label className="grid gap-1 text-sm">
          <span className="text-textMuted">User ID</span>
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-textMuted">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as SessionRuntimeRole)}
            className="rounded border border-border bg-background px-3 py-2"
          >
            <option value="PLAYER">PLAYER</option>
            <option value="MASTER">MASTER</option>
          </select>
        </label>

        <button
          type="submit"
          className="self-end rounded border border-border px-4 py-2 text-sm"
        >
          Reconnect
        </button>
      </form>

      <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <RuntimeRow label="Session ID" value={sessionId} />
        <RuntimeRow label="Status" value={runtime.status} />
        <RuntimeRow label="Client ID" value={runtime.clientId} />
        <RuntimeRow label="Heartbeat ACK" value={heartbeatLabel} />
        <RuntimeRow label="Presence count" value={String(runtime.presence.length)} />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-medium">Presence</h2>
        {runtime.presence.length === 0 ? (
          <p className="text-sm text-textMuted">No active connections.</p>
        ) : (
          <div className="grid gap-2">
            {runtime.presence.map((user) => (
              <div
                key={user.clientId}
                className="grid gap-1 rounded border border-border p-3 text-sm md:grid-cols-3"
              >
                <span>{user.userId}</span>
                <span className="text-textMuted">{user.role}</span>
                <code className="break-all text-xs text-textMuted">{user.clientId}</code>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Cross-browser test</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-textMuted">
          <li>Keep this page open.</li>
          <li>Open the same session ID in another browser.</li>
          <li>Use a different userId in the query string.</li>
          <li>Both connections should appear in Presence.</li>
        </ol>
        <code className="mt-3 block break-all rounded bg-background p-3 text-xs">
          /dev/session-runtime/{sessionId}?userId=browser-b&role=PLAYER
        </code>
      </section>
    </main>
  )
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 md:grid-cols-[160px_1fr]">
      <span className="text-textMuted">{label}</span>
      <code className="break-all">{value}</code>
    </div>
  )
}
