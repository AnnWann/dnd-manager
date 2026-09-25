import { parseManualDiceExpression, type ManualDiceExpressionParseResult } from "../shared/session-runtime/manualDiceExpression"
import type {
  SessionDiceD20Source,
  SessionDiceDamageSource,
  SessionDiceRollMode,
  SessionDiceRollRequest,
  SessionDiceRollResult,
  SessionActionRollRequest,
  SessionActionRollResult,
  SessionActionRollSource,
  SessionCreatureRollRequest,
  SessionCreatureRollSource,
} from "../shared/session-runtime/diceRollProtocol"

export const DICE_ROLL_REQUEST_EVENT = "dndmm:dice-roll-request"
export const DICE_ROLL_RESULT_EVENT = "dndmm:dice-roll-result"
export const ACTION_ROLL_REQUEST_EVENT = "dndmm:action-roll-request"
export const ACTION_ROLL_RESULT_EVENT = "dndmm:action-roll-result"
export const CREATURE_ROLL_REQUEST_EVENT = "dndmm:creature-roll-request"

let requestSequence = 0

export function requestD20Roll(input: {
  characterId: string
  label: string
  source: SessionDiceD20Source
  mode?: SessionDiceRollMode
}): void {
  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: input.label,
    mode: input.mode ?? "normal",
    source: input.source,
  })
}

export function requestDamageRoll(input: {
  characterId: string
  label: string
  source: SessionDiceDamageSource
}): void {
  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: input.label,
    mode: "normal",
    source: input.source,
  })
}


export function requestManualDiceRoll(input: {
  characterId?: string
  initiativeEntryId?: string
  expression: string
}): ManualDiceExpressionParseResult {
  const parsed = parseManualDiceExpression(input.expression)
  if (!parsed.ok) return parsed

  publishRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    label: "Rolagem manual",
    mode: "normal",
    source: {
      type: "manual",
      expression: parsed.value.expression,
      initiativeEntryId: input.initiativeEntryId,
    },
  })
  return parsed
}


export function requestActionRoll(input: {
  characterId: string
  source: SessionActionRollSource
  mode?: SessionDiceRollMode
}): void {
  publishActionRequest({
    requestId: createRequestId(),
    characterId: input.characterId,
    mode: input.mode ?? "normal",
    source: input.source,
  })
}

export function requestActionAnnouncement(input: {
  characterId: string
  title: string
  subtitle?: string
  description?: string
}): void {
  requestActionRoll({
    characterId: input.characterId,
    source: {
      type: "announcement",
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
    },
  })
}

export function requestCreatureRoll(input: {
  creatureId: string
  initiativeEntryId?: string
  source: SessionCreatureRollSource
  mode?: SessionDiceRollMode
}): void {
  if (typeof window === "undefined") return
  const request: SessionCreatureRollRequest = {
    requestId: createRequestId(),
    creatureId: input.creatureId,
    initiativeEntryId: input.initiativeEntryId,
    mode: input.mode ?? "normal",
    source: input.source,
  }
  window.dispatchEvent(
    new CustomEvent<SessionCreatureRollRequest>(CREATURE_ROLL_REQUEST_EVENT, {
      detail: request,
    }),
  )
}

export function publishServerActionRoll(result: SessionActionRollResult): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionActionRollResult>(ACTION_ROLL_RESULT_EVENT, { detail: result }),
  )
}

export function publishServerDiceRoll(result: SessionDiceRollResult): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionDiceRollResult>(DICE_ROLL_RESULT_EVENT, { detail: result }),
  )
}

export function rollModeFromEvent(
  event: Pick<MouseEvent, "shiftKey" | "altKey">,
): SessionDiceRollMode {
  if (event.shiftKey) return "advantage"
  if (event.altKey) return "disadvantage"
  return "normal"
}

export function rollModifierHint(): string {
  return "Clique para rolar no servidor. Shift: vantagem. Alt: desvantagem."
}


function publishActionRequest(request: SessionActionRollRequest): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionActionRollRequest>(ACTION_ROLL_REQUEST_EVENT, { detail: request }),
  )
}

function publishRequest(request: SessionDiceRollRequest): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionDiceRollRequest>(DICE_ROLL_REQUEST_EVENT, { detail: request }),
  )
}

function createRequestId(): string {
  return `${Date.now()}-${requestSequence++}`
}
