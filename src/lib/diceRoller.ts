import type {
  SessionDiceD20Source,
  SessionDiceDamageSource,
  SessionDiceRollMode,
  SessionDiceRollRequest,
  SessionDiceRollResult,
} from "../shared/session-runtime/diceRollProtocol"

export const DICE_ROLL_REQUEST_EVENT = "dndmm:dice-roll-request"
export const DICE_ROLL_RESULT_EVENT = "dndmm:dice-roll-result"

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

function publishRequest(request: SessionDiceRollRequest): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionDiceRollRequest>(DICE_ROLL_REQUEST_EVENT, { detail: request }),
  )
}

function createRequestId(): string {
  return `${Date.now()}-${requestSequence++}`
}
