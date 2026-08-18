import { useMemo, useState, type FormEvent } from "react"
import { Navigate, useLocation, useSearchParams } from "react-router-dom"

import { SessionRuntimeProvider } from "../../features/session-runtime/SessionRuntimeProvider"
import type { SessionRuntimeRole } from "../../features/session-runtime/sessionProtocol"
import { useSessionRuntime } from "../../features/session-runtime/useSessionRuntime"

const DEV_RUNTIME_PREFIX = "/dev/session-runtime/"
const DEV_CHARACTER_ID = "dev-character"
const DEV_PLAYER_ID = "player"

export function SessionRuntimeDevView() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/not-found" replace />
  }

  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = decodeURIComponent(
    location.pathname.slice(DEV_RUNTIME_PREFIX.length).split("/")[0] ?? "",
  ).trim()

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
  const hp = runtime.hpByCharacterId[DEV_CHARACTER_ID]

  const heartbeatLabel = useMemo(() => {
    if (!runtime.lastHeartbeatAckAt) return "Ainda não recebido"
    return new Date(runtime.lastHeartbeatAckAt).toLocaleTimeString()
  }, [runtime.lastHeartbeatAckAt])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams({ userId: userId.trim() || "dev-user", role })
  }

  function initializeHp() {
    runtime.initializeHp([{
      characterId: DEV_CHARACTER_ID,
      ownerUserId: DEV_PLAYER_ID,
      current: 20,
      temporary: 0,
      max: 20,
      currentMax: 20,
      maxHpBonus: 0,
    }])
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">
          Development only
        </p>
        <h1 className="text-2xl font-semibold">Session Runtime Test</h1>
        <p className="mt-2 text-sm text-textMuted">
          Use the same session ID in multiple browsers to validate presence, authoritative HP, broadcast and undo without creating a campaign locally.
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

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <h2 className="text-lg font-medium">Authoritative HP</h2>
          <p className="mt-1 text-xs text-textMuted">
            The test character belongs to userId <code>{DEV_PLAYER_ID}</code>. Only MASTER or that PLAYER may change it.
          </p>
        </div>

        {hp ? (
          <div className="grid gap-2 text-sm sm:grid-cols-5">
            <RuntimeRow label="Current" value={String(hp.current)} />
            <RuntimeRow label="Temporary" value={String(hp.temporary)} />
            <RuntimeRow label="Max" value={String(hp.max)} />
            <RuntimeRow label="Current max" value={String(hp.currentMax)} />
            <RuntimeRow label="Revision" value={String(hp.revision)} />
          </div>
        ) : (
          <p className="text-sm text-textMuted">HP has not been initialized.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {runtime.role === "MASTER" && !hp ? (
            <DevButton onClick={initializeHp}>Initialize 20/20</DevButton>
          ) : null}
          <DevButton
            disabled={!hp}
            onClick={() => runtime.dispatchHpOperation({
              type: "character.hp.damage",
              characterId: DEV_CHARACTER_ID,
              amount: 5,
            })}
          >
            Damage 5
          </DevButton>
          <DevButton
            disabled={!hp}
            onClick={() => runtime.dispatchHpOperation({
              type: "character.hp.heal",
              characterId: DEV_CHARACTER_ID,
              amount: 3,
            })}
          >
            Heal 3
          </DevButton>
          <DevButton
            disabled={!hp}
            onClick={() => runtime.dispatchHpOperation({
              type: "character.hp.temporary.add",
              characterId: DEV_CHARACTER_ID,
              amount: 4,
            })}
          >
            Temp +4
          </DevButton>
        </div>
      </section>

      {runtime.role === "MASTER" ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-medium">MASTER HP log</h2>
          {runtime.hpLog.length ? (
            <div className="grid gap-2">
              {[...runtime.hpLog].reverse().map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-3 rounded border border-border p-3 text-xs">
                  <div className="min-w-0">
                    <code>{record.operation.type}</code>
                    <div className="mt-1 text-textMuted">
                      {record.actorId} · {new Date(record.createdAt).toLocaleTimeString()}
                      {record.undoneAt ? " · undone" : ""}
                    </div>
                  </div>
                  {!record.undoneAt && record.operation.type !== "character.hp.undo" ? (
                    <DevButton onClick={() => runtime.undoLog(record.id)}>Undo</DevButton>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-textMuted">No HP operations logged yet.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Cross-browser test</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-textMuted">
          <li>Open MASTER and initialize the test character.</li>
          <li>Open the same session in another browser as userId player.</li>
          <li>Damage or heal in either browser and confirm both update.</li>
          <li>Confirm only MASTER receives the HP log and can undo.</li>
        </ol>
        <code className="mt-3 block break-all rounded bg-background p-3 text-xs">
          /dev/session-runtime/{sessionId}?userId=player&role=PLAYER
        </code>
      </section>
    </main>
  )
}

function DevButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-textMuted">{label}</span>
      <code className="break-all">{value}</code>
    </div>
  )
}
