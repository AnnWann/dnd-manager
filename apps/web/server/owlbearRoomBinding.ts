import { createHmac, timingSafeEqual } from "node:crypto"

export type OwlbearRoomBinding = { version: 1; roomId: string; sessionId: string; sessionName: string; signature: string }
const message = (binding: Omit<OwlbearRoomBinding, "signature">) =>
  JSON.stringify([binding.version, binding.roomId, binding.sessionId, binding.sessionName])
export function signOwlbearRoomBinding(roomId: string, sessionId: string, sessionName: string, secret: string): OwlbearRoomBinding {
  const binding = { version: 1 as const, roomId, sessionId, sessionName }
  return { ...binding, signature: createHmac("sha256", secret).update("owlbear-room-v1." + message(binding)).digest("base64url") }
}
export function verifyOwlbearRoomBinding(value: unknown, roomId: string, secret: string): value is OwlbearRoomBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const b = value as OwlbearRoomBinding
  if (b.version !== 1 || b.roomId !== roomId || !b.roomId || b.roomId.length > 256 ||
      typeof b.sessionId !== "string" || !b.sessionId || b.sessionId.length > 256 ||
      typeof b.sessionName !== "string" || b.sessionName.length > 500 || typeof b.signature !== "string") return false
  const expected = signOwlbearRoomBinding(b.roomId, b.sessionId, b.sessionName, secret).signature
  const a = Buffer.from(expected), c = Buffer.from(b.signature)
  return a.length === c.length && timingSafeEqual(a, c)
}
