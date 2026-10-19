import type {
  SessionHpOperation, SessionStatOperation, SessionAttributeOperation,
  SessionSavingThrowOperation, SessionSkillOperation,
} from "@dnd-manager/session-protocol/session-core"

/** Transport-only boundary. Rules and authorization remain in the Session Server. */
export type CharacterSheetOperation =
  | { type: "session.hp.operation"; operation: SessionHpOperation }
  | { type: "session.sheet.operation"; operation: SessionStatOperation | SessionAttributeOperation | SessionSavingThrowOperation | SessionSkillOperation }

export function sendCharacterSheetOperation(
  transport: { readyState: number; send(data: string): void } | null,
  message: CharacterSheetOperation,
): boolean {
  if (!transport || transport.readyState !== 1) return false
  transport.send(JSON.stringify(message))
  return true
}
