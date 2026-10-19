import type { SessionAuthoritativeOperation } from "@dnd-manager/session-protocol/session-core"

/** Typed, host-independent authoritative sheet operation sender.
 * The worker owns validation and character visibility/ownership checks.
 */
export function sendCharacterSheetOperation(
  transport: { readyState: number; send(data: string): void } | null,
  operation: SessionAuthoritativeOperation,
): boolean {
  if (!transport || transport.readyState !== 1) return false
  transport.send(JSON.stringify({ type: "session.hp.operation", operation }))
  return true
}
