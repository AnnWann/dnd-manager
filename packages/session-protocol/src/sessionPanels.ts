/**
 * Durable-Object-owned panels. Public projections MUST be created on the
 * server: private HTML and master-only state may contain adventure spoilers.
 */
import { DEFAULT_CAMPAIGN_TIME, advanceCampaignTime, type CampaignTime } from "./campaignTime"
export type SessionPanelVisibility = "private" | "shared" | "collaborative"
export type SessionPanel = {
  id: string
  title: string
  kind: "clock" | "html"
  visibility: SessionPanelVisibility
  clock?: { value: number; max: number; label: string }
  /** Private source, sent exclusively to MASTER connections. */
  html?: string
  /** Explicitly authored public HTML, never inferred from the private HTML. */
  playerHtml?: string
  /** Opaque storage owned by private HTML; never sent to players. */
  storage?: Record<string, string>
}
export type SessionPanelsState = { revision: number; panels: SessionPanel[]; campaignTime?: CampaignTime }
export type SessionPanelOperation =
  | { type: "time.advance"; minutes: number }
  | { type: "time.set"; time: CampaignTime }
  | { type: "upsert"; panel: SessionPanel }
  | { type: "delete"; id: string }
  | { type: "clock.advance"; id: string; delta: number }
  | { type: "storage.replace"; id: string; storage: Record<string, string> }
export type SessionPanelsClientMessage = {
  type: "session.panels.operation"
  operation: SessionPanelOperation
}
export type SessionPanelsServerMessage = {
  type: "session.panels.snapshot"
  state: SessionPanelsState
}

export const EMPTY_SESSION_PANELS: SessionPanelsState = { revision: 0, panels: [] }
const MAX_PANELS = 24
const MAX_HTML = 75000
const MAX_STORAGE = 85000
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max
const nonEmptyText = (value: unknown, max: number): value is string =>
  boundedText(value, max) && value.trim().length > 0
const validId = (value: unknown): value is string =>
  nonEmptyText(value, 120) && /^[a-zA-Z0-9_-]+$/.test(value)
const validStorage = (value: unknown): value is Record<string, string> =>
  isRecord(value) && JSON.stringify(value).length <= MAX_STORAGE
  && Object.entries(value).every(([key, item]) => key.length <= 200 && typeof item === "string")

export function isSessionPanel(value: unknown): value is SessionPanel {
  if (!isRecord(value) || !validId(value.id) || !nonEmptyText(value.title, 100)) return false
  if (value.kind !== "html" && value.kind !== "clock") return false
  if (value.visibility !== "private" && value.visibility !== "shared" && value.visibility !== "collaborative") return false
  if (value.kind === "clock") {
    if (!isRecord(value.clock)) return false
    const { max, value: current, label } = value.clock
    if (!Number.isInteger(max) || (max as number) < 1 || (max as number) > 36) return false
    if (!Number.isInteger(current) || (current as number) < 0 || (current as number) > (max as number)) return false
    if (!boundedText(label, 100)) return false
  }
  if (value.kind === "html" && (!boundedText(value.html ?? "", MAX_HTML) || !boundedText(value.playerHtml ?? "", MAX_HTML))) return false
  return value.storage === undefined || validStorage(value.storage)
}

export function parseSessionPanelOperation(raw: string): SessionPanelOperation | null {
  if (raw.length > 190000) return null
  let message: unknown
  try { message = JSON.parse(raw) } catch { return null }
  if (!isRecord(message) || message.type !== "session.panels.operation" || !isRecord(message.operation)) return null
  const operation = message.operation
  if (operation.type === "time.advance" && Number.isInteger(operation.minutes) && Math.abs(operation.minutes as number) <= 43200) return { type: "time.advance", minutes: operation.minutes as number }
  if (operation.type === "time.set" && isRecord(operation.time) && Number.isInteger(operation.time.day) && Math.abs(operation.time.day as number) <= 1000000 && Number.isInteger(operation.time.minute) && (operation.time.minute as number) >= 0 && (operation.time.minute as number) < 1440 && Number.isInteger(operation.time.epochYear) && Number.isInteger(operation.time.seed)) return { type: "time.set", time: operation.time as CampaignTime }
  if (operation.type === "upsert" && isSessionPanel(operation.panel)) {
    return { type: "upsert", panel: operation.panel }
  }
  if (operation.type === "delete" && validId(operation.id)) return { type: "delete", id: operation.id }
  if (operation.type === "clock.advance" && validId(operation.id)
    && Number.isInteger(operation.delta) && Math.abs(operation.delta as number) <= 1000000) {
    return { type: "clock.advance", id: operation.id, delta: operation.delta as number }
  }
  if (operation.type === "storage.replace" && validId(operation.id) && validStorage(operation.storage)) {
    return { type: "storage.replace", id: operation.id, storage: operation.storage }
  }
  return null
}

export function projectSessionPanels(state: SessionPanelsState, isMaster: boolean): SessionPanelsState {
  return {
    revision: state.revision,
    campaignTime: state.campaignTime ?? DEFAULT_CAMPAIGN_TIME,
    panels: state.panels
      .filter(panel => isMaster || panel.visibility !== "private")
      .map(panel => isMaster ? panel : panel.kind === "html"
        ? {
            id: panel.id,
            title: panel.title,
            kind: panel.kind,
            visibility: panel.visibility,
            html: panel.playerHtml ?? "",
          }
        : {
            id: panel.id,
            title: panel.title,
            kind: panel.kind,
            visibility: panel.visibility,
            clock: panel.clock && { ...panel.clock },
          }),
  }
}

/** Returns null when forbidden or invalid. Null never means an implicit success. */
export function applySessionPanelOperation(
  state: SessionPanelsState,
  operation: SessionPanelOperation,
  isMaster: boolean,
): SessionPanelsState | null {
  let panels = state.panels
  if (operation.type === "time.advance" || operation.type === "time.set") {
    if (!isMaster) return null
    return { ...state, revision: state.revision + 1, campaignTime: operation.type === "time.set" ? operation.time : advanceCampaignTime(state.campaignTime ?? DEFAULT_CAMPAIGN_TIME, operation.minutes) }
  }
  if (operation.type === "upsert") {
    if (!isMaster || !isSessionPanel(operation.panel)) return null
    const index = panels.findIndex(panel => panel.id === operation.panel.id)
    if (index < 0 && panels.length >= MAX_PANELS) return null
    const nextPanel = { ...operation.panel, storage: index < 0 ? operation.panel.storage ?? {} : panels[index].storage ?? {} }
    panels = index < 0 ? [...panels, nextPanel] : panels.map(panel => panel.id === nextPanel.id ? nextPanel : panel)
  } else if (operation.type === "delete") {
    if (!isMaster || !panels.some(panel => panel.id === operation.id)) return null
    panels = panels.filter(panel => panel.id !== operation.id)
  } else if (operation.type === "clock.advance") {
    const panel = panels.find(entry => entry.id === operation.id)
    if (!panel || panel.kind !== "clock" || !panel.clock || (!isMaster && panel.visibility !== "collaborative")) return null
    const clock = { ...panel.clock, value: Math.max(0, Math.min(panel.clock.max, panel.clock.value + operation.delta)) }
    panels = panels.map(entry => entry.id === panel.id ? { ...entry, clock } : entry)
  } else if (operation.type === "storage.replace") {
    const panel = panels.find(entry => entry.id === operation.id)
    if (!isMaster || !panel || panel.kind !== "html" || !validStorage(operation.storage)) return null
    panels = panels.map(entry => entry.id === panel.id ? { ...entry, storage: operation.storage } : entry)
  } else return null
  return { ...state, revision: state.revision + 1, panels }
}

export function parseSessionPanelsServerMessage(raw: string): SessionPanelsServerMessage | null {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!isRecord(parsed) || parsed.type !== "session.panels.snapshot" || !isRecord(parsed.state)) return null
  const state = parsed.state
  if (!Number.isInteger(state.revision) || (state.revision as number) < 0) return null
  if (!Array.isArray(state.panels) || state.panels.length > MAX_PANELS || !state.panels.every(isSessionPanel)) return null
  return { type: "session.panels.snapshot", state: state as SessionPanelsState }
}
