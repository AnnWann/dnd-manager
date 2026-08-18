import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Navigate, useLocation, useSearchParams } from "react-router-dom"

import { SessionRuntimeProvider } from "../../features/session-runtime/SessionRuntimeProvider"
import type { SessionRuntimeRole } from "../../features/session-runtime/sessionProtocol"
import { useSessionRuntime } from "../../features/session-runtime/useSessionRuntime"

const DEV_RUNTIME_PREFIX = "/dev/session-runtime/"
const DEV_CHARACTER_ID = "dev-character"
const DEV_PLAYER_ID = "player"

export function SessionRuntimeDevView() {
  if (!import.meta.env.DEV) return <Navigate to="/not-found" replace />

  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = decodeURIComponent(
    location.pathname.slice(DEV_RUNTIME_PREFIX.length).split("/")[0] ?? "",
  ).trim()
  if (!sessionId) return <Navigate to="/not-found" replace />

  const userId = searchParams.get("userId")?.trim() || "dev-user"
  const role: SessionRuntimeRole =
    searchParams.get("role")?.toUpperCase() === "MASTER" ? "MASTER" : "PLAYER"

  return (
    <SessionRuntimeProvider sessionId={sessionId} userId={userId} role={role}>
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
  const state = runtime.hpByCharacterId[DEV_CHARACTER_ID]
  const d8 = state?.hitDice.d8

  const heartbeatLabel = useMemo(() => {
    if (!runtime.lastHeartbeatAckAt) return "Ainda não recebido"
    return new Date(runtime.lastHeartbeatAckAt).toLocaleTimeString()
  }, [runtime.lastHeartbeatAckAt])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams({ userId: userId.trim() || "dev-user", role })
  }

  function initializeCharacter() {
    runtime.initializeHp([{
      characterId: DEV_CHARACTER_ID,
      ownerUserId: DEV_PLAYER_ID,
      current: 20,
      temporary: 0,
      max: 20,
      currentMax: 20,
      maxHpBonus: 0,
      hitDice: {
        d8: { current: 4, max: 4 },
      },
      attributes: {
        str: 10,
        dex: 14,
        con: 12,
        int: 16,
        wis: 13,
        cha: 18,
      },
      stats: {
        armorClassAdjustment: 0,
        initiativeAdjustment: 0,
        mobilityAdjustment: 0,
        passivePerceptionAdjustment: 0,
        exhaustion: 0,
        inspiration: false,
        experience: 0,
      },
    }])
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Development only</p>
        <h1 className="text-2xl font-semibold">Session Runtime Test</h1>
        <p className="mt-2 text-sm text-textMuted">
          Validate authoritative HP, hit dice, granular stats and attributes, rests, broadcast and MASTER undo without a campaign.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[1fr_180px_auto]">
        <label className="grid gap-1 text-sm">
          <span className="text-textMuted">User ID</span>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} className="rounded border border-border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-textMuted">Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as SessionRuntimeRole)} className="rounded border border-border bg-background px-3 py-2">
            <option value="PLAYER">PLAYER</option>
            <option value="MASTER">MASTER</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded border border-border px-4 py-2 text-sm">Reconnect</button>
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
              <div key={user.clientId} className="grid gap-1 rounded border border-border p-3 text-sm md:grid-cols-3">
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
          <h2 className="text-lg font-medium">Authoritative character state</h2>
          <p className="mt-1 text-xs text-textMuted">
            Character owner: <code>{DEV_PLAYER_ID}</code>. Only that PLAYER or MASTER can mutate it.
          </p>
        </div>

        {state ? (
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <RuntimeRow label="HP" value={`${state.current}/${state.currentMax}`} />
            <RuntimeRow label="Temporary HP" value={String(state.temporary)} />
            <RuntimeRow label="d8 hit dice" value={d8 ? `${d8.current}/${d8.max}` : "none"} />
            <RuntimeRow label="Revision" value={String(state.revision)} />
            <RuntimeRow label="STR" value={String(state.attributes.str)} />
            <RuntimeRow label="DEX" value={String(state.attributes.dex)} />
            <RuntimeRow label="CON" value={String(state.attributes.con)} />
            <RuntimeRow label="INT" value={String(state.attributes.int)} />
            <RuntimeRow label="WIS" value={String(state.attributes.wis)} />
            <RuntimeRow label="CHA" value={String(state.attributes.cha)} />
            <RuntimeRow label="CA adjustment" value={String(state.stats.armorClassAdjustment)} />
            <RuntimeRow label="Initiative adjustment" value={String(state.stats.initiativeAdjustment)} />
            <RuntimeRow label="Mobility adjustment" value={String(state.stats.mobilityAdjustment)} />
            <RuntimeRow label="Passive adjustment" value={String(state.stats.passivePerceptionAdjustment)} />
            <RuntimeRow label="Exhaustion" value={String(state.stats.exhaustion)} />
            <RuntimeRow label="Inspiration" value={String(state.stats.inspiration)} />
            <RuntimeRow label="Experience" value={String(state.stats.experience)} />
          </div>
        ) : (
          <p className="text-sm text-textMuted">Character state has not been initialized.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {runtime.role === "MASTER" && !state ? <DevButton onClick={initializeCharacter}>Initialize character</DevButton> : null}
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.attribute.set", characterId: DEV_CHARACTER_ID, attribute: "str", value: 18 })}>Set STR 18</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.attribute.set", characterId: DEV_CHARACTER_ID, attribute: "dex", value: 20 })}>Set DEX 20</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.hp.damage", characterId: DEV_CHARACTER_ID, amount: 5 })}>Damage 5</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.hp.heal", characterId: DEV_CHARACTER_ID, amount: 3 })}>Heal 3</DevButton>
          <DevButton disabled={!d8 || d8.current <= 0} onClick={() => runtime.dispatchHpOperation({ type: "character.hitDice.use", characterId: DEV_CHARACTER_ID, side: "d8", amount: 1 })}>Use 1d8</DevButton>
          <DevButton disabled={!d8 || d8.current >= d8.max} onClick={() => runtime.dispatchHpOperation({ type: "character.hitDice.recover", characterId: DEV_CHARACTER_ID, side: "d8", amount: 1 })}>Recover 1d8</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.armorClass.set", characterId: DEV_CHARACTER_ID, value: 18, calculatedValue: 15 })}>Set CA 18 (auto 15)</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.initiative.set", characterId: DEV_CHARACTER_ID, value: 4, calculatedValue: 2 })}>Set initiative +4 (auto +2)</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.mobility.set", characterId: DEV_CHARACTER_ID, value: 12, calculatedValue: 9 })}>Set mobility 12 (auto 9)</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.passivePerception.set", characterId: DEV_CHARACTER_ID, value: 15, calculatedValue: 12 })}>Set passive 15 (auto 12)</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.exhaustion.set", characterId: DEV_CHARACTER_ID, value: 2 })}>Set exhaustion 2</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.inspiration.set", characterId: DEV_CHARACTER_ID, value: !(state?.stats.inspiration ?? false) })}>Toggle inspiration</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.stat.experience.set", characterId: DEV_CHARACTER_ID, value: (state?.stats.experience ?? 0) + 500 })}>XP +500</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.rest.short", characterId: DEV_CHARACTER_ID, healing: 4, hitDiceConsumption: { d8: 1 } })}>Short rest: +4 HP, -1d8</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.rest.long", characterId: DEV_CHARACTER_ID, recovery: "full" })}>Full long rest</DevButton>
          <DevButton disabled={!state} onClick={() => runtime.dispatchHpOperation({ type: "character.rest.long", characterId: DEV_CHARACTER_ID, recovery: "partial" })}>Partial long rest</DevButton>
        </div>
      </section>

      {runtime.role === "MASTER" ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-medium">MASTER operation log</h2>
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
            <p className="text-sm text-textMuted">No authoritative operations logged yet.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Cross-browser test</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-textMuted">
          <li>Open MASTER and initialize the character.</li>
          <li>Open the same session in another browser as userId player.</li>
          <li>Change STR or DEX and confirm both browsers update immediately.</li>
          <li>Confirm one attribute change creates one MASTER log entry.</li>
          <li>Undo it and verify only that attribute returns to its prior value.</li>
          <li>Test an invalid score outside 1–30 and confirm the server rejects it.</li>
        </ol>
        <code className="mt-3 block break-all rounded bg-background p-3 text-xs">
          /dev/session-runtime/{sessionId}?userId=player&role=PLAYER
        </code>
      </section>
    </main>
  )
}

function DevButton({ children, disabled = false, onClick }: {
  children: ReactNode
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
