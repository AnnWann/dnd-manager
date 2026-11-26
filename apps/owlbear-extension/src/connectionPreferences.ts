export const ROOM_SESSION_METADATA = "com.dnd-manager.owlbear/room-session-v1"
export type RoomSessionBinding = { version: 1; roomId: string; sessionId: string; sessionName: string; signature: string }
export function readRoomBinding(value: unknown, roomId: string): RoomSessionBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const b = value as RoomSessionBinding
  return b.version === 1 && b.roomId === roomId && typeof b.sessionId === "string" &&
    Boolean(b.sessionId) && typeof b.sessionName === "string" && typeof b.signature === "string" ? b : null
}
export type RememberedAccount = { token: string; userId: string; expiresAt: number }
export function accountStorageKey(origin: string) { return "dnd-manager:owlbear:account:v1:" + origin }
export function characterStorageKey(origin: string, userId: string, sessionId: string) {
  return "dnd-manager:owlbear:character:v1:" + JSON.stringify([origin, userId, sessionId])
}
export function readRememberedAccount(storage: Pick<Storage, "getItem">, origin: string, now = Date.now()): RememberedAccount | null {
  try {
    const value = JSON.parse(storage.getItem(accountStorageKey(origin)) || "null") as RememberedAccount | null
    return value && typeof value.token === "string" && value.token && typeof value.userId === "string" &&
      Number.isFinite(value.expiresAt) && value.expiresAt > now ? value : null
  } catch { return null }
}
/** Results from the dedicated dice view stay there; remote rolls must not steal focus either. */
export function shouldOpenDicePopover(activeArea: string, dedicatedRequest: boolean, isPopover: boolean): boolean {
  return !isPopover && activeArea !== "dice" && !dedicatedRequest
}
