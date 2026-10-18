import { Users } from "lucide-react"
import { useMemo } from "react"

import type { CampaignSessionMember } from "../../api/campaign-session"
import { useOptionalSessionRuntime } from "../session-runtime/useSessionRuntime"

export function SessionPresenceIndicator({
  members,
}: {
  members: CampaignSessionMember[]
}) {
  const runtime = useOptionalSessionRuntime()

  const onlineUsers = useMemo(() => {
    if (!runtime) return []

    const memberById = new Map(members.map((member) => [member.id, member]))
    const uniquePresence = new Map<string, (typeof runtime.presence)[number]>()

    for (const presence of runtime.presence) {
      const current = uniquePresence.get(presence.userId)
      if (!current || presence.role === "MASTER") {
        uniquePresence.set(presence.userId, presence)
      }
    }

    return Array.from(uniquePresence.values())
      .map((presence) => {
        const member = memberById.get(presence.userId)
        return {
          userId: presence.userId,
          name:
            member?.name?.trim() ||
            (presence.role === "MASTER" ? "Mestre" : "Jogador"),
          role: presence.role,
        }
      })
      .sort((left, right) => {
        if (left.role !== right.role) return left.role === "MASTER" ? -1 : 1
        return left.name.localeCompare(right.name, "pt-BR")
      })
  }, [members, runtime])

  if (!runtime) return null

  const connected = runtime.status === "connected"
  const label = connected
    ? `${onlineUsers.length} online`
    : runtime.status === "reconnecting"
      ? "Reconectando"
      : runtime.status === "connecting"
        ? "Conectando"
        : "Offline"

  return (
    <details className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs font-medium text-textH transition hover:bg-bg-subtle [&::-webkit-details-marker]:hidden"
        title="Usuários conectados à sessão"
      >
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-textMuted/50"}`}
          aria-hidden="true"
        />
        <Users className="h-4 w-4 text-textMuted" />
        <span>{label}</span>
      </summary>

      <div className="absolute right-0 z-[13000] mt-2 w-64 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-xl">
        <div className="border-b border-border px-3 py-2.5">
          <div className="text-xs font-semibold text-textH">Conectados à sessão</div>
          <div className="mt-0.5 text-[10px] text-textMuted">
            {connected
              ? `${onlineUsers.length} usuário${onlineUsers.length === 1 ? "" : "s"} online`
              : "Conexão em tempo real indisponível"}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {onlineUsers.length ? (
            <div className="grid gap-1">
              {onlineUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-bg-subtle"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-textH">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-textMuted">
                      {user.role === "MASTER" ? "Mestre" : "Jogador"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-5 text-center text-xs text-textMuted">
              Nenhum usuário conectado.
            </div>
          )}
        </div>
      </div>
    </details>
  )
}
