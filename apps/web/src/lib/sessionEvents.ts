export const SESSION_CONTENT_CHANGED_EVENT = "dndmm:session-content-changed"
export const SESSION_MEMBER_KICK_EVENT = "dndmm:session-member-kick"

export type SessionMemberKickDetail = {
  campaignId: string
  userId: string
}

export function notifySessionContentChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SESSION_CONTENT_CHANGED_EVENT))
}

export function notifySessionMemberKick(
  campaignId: string,
  userId: string,
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionMemberKickDetail>(SESSION_MEMBER_KICK_EVENT, {
      detail: { campaignId, userId },
    }),
  )
}
