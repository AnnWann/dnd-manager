export type SessionMutationResult = {
  type: "session.mutation.result"
  requestId: string
  error?: { code: string; message: string }
}

const mutationRoutes = new Set([
  "session.hp.operation", "session.sheet.operation", "session.abilities.operation",
  "session.magic.operation", "session.customSystem.operation",
  "session.equipment.operation", "session.initiative.operation",
])

export function readTrackedMutation(raw: string) {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== "object" || !("mutationId" in value)) return null
  const message = value as Record<string, unknown>
  if (typeof message.mutationId !== "string" || !/^[a-z0-9-]{1,64}$/i.test(message.mutationId)
    || typeof message.type !== "string" || !mutationRoutes.has(message.type)
    || !message.operation || typeof message.operation !== "object") return null
  const { mutationId, ...original } = message
  return { requestId: mutationId, raw: JSON.stringify(original) }
}
