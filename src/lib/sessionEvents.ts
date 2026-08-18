export const SESSION_CONTENT_CHANGED_EVENT = "dndmm:session-content-changed"

export function notifySessionContentChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SESSION_CONTENT_CHANGED_EVENT))
}
