export type InitiativeSide = "ally" | "enemy" | "neutral"

export type InitiativeSourceType =
  | "character"
  | "npc"
  | "monster"
  | "custom"

export type InitiativeViewMode = "table" | "cards"
export type InitiativeDeathSaveVisibility = "masterOnly" | "owner" | "everyone"
export type InitiativeDeathSaves = { successes: number; failures: number }
export type InitiativeDefeatReason = "manual" | "zeroHp"

export type InitiativeConditionDuration =
  | { type: "manual" }
  | { type: "turns"; remaining: number }
  | { type: "rounds"; remaining: number }
  | { type: "untilTurnStart"; ownerEntryId: string }
  | { type: "untilTurnEnd"; ownerEntryId: string }

export type InitiativeCondition = {
  id: string
  name: string
  description?: string
  duration: InitiativeConditionDuration
}

export type InitiativeEntry = {
  id: string
  sourceId?: string
  sourceType: InitiativeSourceType
  /** Nome canônico usado pelo mestre e por entradas antigas. */
  name: string
  /** Nome verdadeiro quando a origem possui identidade secreta. */
  realName?: string
  /** Nome genérico/público mostrado aos jogadores. */
  basicName?: string
  /** Nome definido durante o combate; tem precedência para todos. */
  customName?: string
  /** Revela o nome verdadeiro aos jogadores. */
  revealRealName?: boolean
  imageUrl?: string
  initiative: number
  initiativeBonus: number
  dexterity?: number
  side: InitiativeSide
  armorClass?: number
  currentHp?: number
  maxHp?: number
  temporaryHp?: number
  conditions: InitiativeCondition[]
  hidden: boolean
  defeated: boolean
  downed?: boolean
  defeatReason?: InitiativeDefeatReason
  deathSaves?: InitiativeDeathSaves
  order: number
  createdAt: number
}

export type InitiativeSession = {
  version: 1
  id: string
  name: string
  entries: InitiativeEntry[]
  activeEntryId?: string
  roundAnchorEntryId?: string
  round: number
  started: boolean
  viewMode: InitiativeViewMode
  deathSaveVisibility: InitiativeDeathSaveVisibility
  deathSaveOwnerCanEdit: boolean
  createdAt: number
  updatedAt: number
}

export type NewInitiativeEntry = Omit<
  InitiativeEntry,
  "id" | "conditions" | "hidden" | "defeated" | "order" | "createdAt"
> & {
  id?: string
  conditions?: InitiativeCondition[]
  hidden?: boolean
  defeated?: boolean
}

export function createInitiativeSession(
  name = "Combate local",
): InitiativeSession {
  const now = Date.now()

  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    entries: [],
    round: 1,
    started: false,
    viewMode: "table",
    deathSaveVisibility: "owner",
    deathSaveOwnerCanEdit: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function createInitiativeEntry(
  input: NewInitiativeEntry,
  order = 0,
): InitiativeEntry {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    conditions: input.conditions ?? [],
    hidden: input.hidden ?? false,
    defeated: input.defeated ?? false,
    downed: input.downed ?? false,
    defeatReason: input.defeatReason,
    deathSaves: input.deathSaves
      ? normalizeDeathSaves(input.deathSaves)
      : input.sourceType === "character"
        ? { successes: 0, failures: 0 }
        : undefined,
    order,
    createdAt: Date.now(),
  }
}

export function normalizeInitiativeSession(
  raw: Partial<InitiativeSession> | null | undefined,
): InitiativeSession {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.entries)) {
    return createInitiativeSession()
  }

  const now = Date.now()
  const entries = raw.entries
    .filter((entry): entry is InitiativeEntry => Boolean(entry?.id && entry?.name))
    .map((entry, index) => ({
      ...entry,
      initiative: finiteNumber(entry.initiative),
      initiativeBonus: finiteNumber(entry.initiativeBonus),
      side: isInitiativeSide(entry.side) ? entry.side : "neutral",
      sourceType: isSourceType(entry.sourceType) ? entry.sourceType : "custom",
      conditions: Array.isArray(entry.conditions) ? entry.conditions : [],
      hidden: Boolean(entry.hidden),
      defeated: Boolean(entry.defeated),
      downed: Boolean(entry.downed),
      defeatReason: entry.defeatReason === "manual" || entry.defeatReason === "zeroHp"
        ? entry.defeatReason
        : undefined,
      deathSaves: entry.sourceType === "character"
        ? normalizeDeathSaves(entry.deathSaves)
        : undefined,
      revealRealName: Boolean(entry.revealRealName),
      realName: entry.realName?.trim() || undefined,
      basicName: entry.basicName?.trim() || undefined,
      customName: entry.customName?.trim() || undefined,
      order: finiteNumber(entry.order, index),
      createdAt: finiteNumber(entry.createdAt, now + index),
    }))
    .sort((left, right) => left.order - right.order)
    .map((entry, index) => ({ ...entry, order: index }))

  const activeEntryId = entries.some(
    (entry) => entry.id === raw.activeEntryId,
  )
    ? raw.activeEntryId
    : undefined
  const roundAnchorEntryId = entries.some(
    (entry) => entry.id === raw.roundAnchorEntryId,
  )
    ? raw.roundAnchorEntryId
    : undefined

  return {
    version: 1,
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name?.trim() || "Combate local",
    entries,
    activeEntryId,
    roundAnchorEntryId,
    round: Math.max(1, finiteNumber(raw.round, 1)),
    started: Boolean(raw.started && activeEntryId && entries.length > 0),
    viewMode: raw.viewMode === "cards" ? "cards" : "table",
    deathSaveVisibility:
      raw.deathSaveVisibility === "masterOnly" ||
      raw.deathSaveVisibility === "everyone"
        ? raw.deathSaveVisibility
        : "owner",
    deathSaveOwnerCanEdit: Boolean(raw.deathSaveOwnerCanEdit),
    createdAt: finiteNumber(raw.createdAt, now),
    updatedAt: finiteNumber(raw.updatedAt, now),
  }
}

export function addInitiativeEntries(
  session: InitiativeSession,
  inputs: NewInitiativeEntry[],
): InitiativeSession {
  const startOrder = session.entries.length
  const additions = inputs.map((input, index) =>
    createInitiativeEntry(input, startOrder + index),
  )

  return touchSession({
    ...session,
    entries: [...session.entries, ...additions],
  })
}

export function updateInitiativeEntry(
  session: InitiativeSession,
  entryId: string,
  updater: (entry: InitiativeEntry) => InitiativeEntry,
): InitiativeSession {
  return touchSession({
    ...session,
    entries: session.entries.map((entry) =>
      entry.id === entryId
        ? normalizeZeroHpState(updater(entry), entry)
        : entry,
    ),
  })
}

export function removeInitiativeEntry(
  session: InitiativeSession,
  entryId: string,
): InitiativeSession {
  const entries = session.entries
    .filter((entry) => entry.id !== entryId)
    .map((entry, index) => ({ ...entry, order: index }))

  if (entries.length === 0) {
    return touchSession({
      ...session,
      entries,
      started: false,
      activeEntryId: undefined,
      roundAnchorEntryId: undefined,
      round: 1,
    })
  }

  const removedActive = session.activeEntryId === entryId
  const removedAnchor = session.roundAnchorEntryId === entryId

  return touchSession({
    ...session,
    entries,
    activeEntryId: removedActive ? entries[0].id : session.activeEntryId,
    roundAnchorEntryId: removedAnchor
      ? entries[0].id
      : session.roundAnchorEntryId,
  })
}

export function sortInitiativeEntries(
  session: InitiativeSession,
): InitiativeSession {
  if (session.started) return session

  const entries = [...session.entries]
    .sort((left, right) => {
      if (right.initiative !== left.initiative) {
        return right.initiative - left.initiative
      }
      if (right.initiativeBonus !== left.initiativeBonus) {
        return right.initiativeBonus - left.initiativeBonus
      }
      if ((right.dexterity ?? 0) !== (left.dexterity ?? 0)) {
        return (right.dexterity ?? 0) - (left.dexterity ?? 0)
      }
      return left.createdAt - right.createdAt
    })
    .map((entry, index) => ({ ...entry, order: index }))

  return touchSession({ ...session, entries })
}

export function startInitiativeCombat(
  session: InitiativeSession,
): InitiativeSession {
  if (session.entries.length === 0) return session

  const sorted = sortInitiativeEntries({ ...session, started: false })
  const firstEntryId = sorted.entries[0].id

  return touchSession({
    ...sorted,
    started: true,
    activeEntryId: firstEntryId,
    roundAnchorEntryId: firstEntryId,
    round: 1,
  })
}

export function endInitiativeCombat(
  session: InitiativeSession,
): InitiativeSession {
  return touchSession({
    ...session,
    started: false,
    activeEntryId: undefined,
    roundAnchorEntryId: undefined,
    round: 1,
  })
}

export function advanceInitiativeTurn(
  session: InitiativeSession,
): InitiativeSession {
  if (!session.started || session.entries.length === 0) return session

  const currentIndex = session.entries.findIndex(
    (entry) => entry.id === session.activeEntryId,
  )
  if (currentIndex < 0) return session

  const currentEntry = session.entries[currentIndex]
  const nextIndex = (currentIndex + 1) % session.entries.length
  const nextEntry = session.entries[nextIndex]

  let entries = expireConditionsAtTurnEnd(
    session.entries,
    currentEntry.id,
  )

  const crossedRoundBoundary =
    nextEntry.id === session.roundAnchorEntryId &&
    currentEntry.id !== session.roundAnchorEntryId

  if (crossedRoundBoundary) {
    entries = decrementRoundConditions(entries)
  }

  entries = expireConditionsAtTurnStart(entries, nextEntry.id)

  return touchSession({
    ...session,
    entries,
    activeEntryId: nextEntry.id,
    round: crossedRoundBoundary ? session.round + 1 : session.round,
  })
}

export function rewindInitiativeTurn(
  session: InitiativeSession,
): InitiativeSession {
  if (!session.started || session.entries.length === 0) return session

  const currentIndex = session.entries.findIndex(
    (entry) => entry.id === session.activeEntryId,
  )
  if (currentIndex < 0) return session

  const previousIndex =
    (currentIndex - 1 + session.entries.length) % session.entries.length
  const previousEntry = session.entries[previousIndex]
  const crossedRoundBoundary = session.activeEntryId === session.roundAnchorEntryId

  return touchSession({
    ...session,
    activeEntryId: previousEntry.id,
    round: crossedRoundBoundary
      ? Math.max(1, session.round - 1)
      : session.round,
  })
}

export function tradeConsecutiveAllies(
  session: InitiativeSession,
  entryId: string,
  direction: -1 | 1,
): InitiativeSession {
  if (direction !== 1) return session

  const index = session.entries.findIndex((entry) => entry.id === entryId)
  const targetIndex = index + 1

  if (index < 0 || targetIndex >= session.entries.length) {
    return session
  }

  const entry = session.entries[index]
  const target = session.entries[targetIndex]

  if (entry.side !== "ally" || target.side !== "ally") return session

  const activeEntryIndex = session.activeEntryId
    ? session.entries.findIndex(
        (candidate) => candidate.id === session.activeEntryId,
      )
    : -1
  const roundAnchorIndex = session.roundAnchorEntryId
    ? session.entries.findIndex(
        (candidate) => candidate.id === session.roundAnchorEntryId,
      )
    : -1
  const entries = [...session.entries]
  entries[index] = target
  entries[targetIndex] = entry
  const orderedEntries = entries.map((item, order) => ({ ...item, order }))

  return touchSession({
    ...session,
    entries: orderedEntries,
    activeEntryId:
      activeEntryIndex >= 0
        ? orderedEntries[activeEntryIndex]?.id
        : session.activeEntryId,
    roundAnchorEntryId:
      roundAnchorIndex >= 0
        ? orderedEntries[roundAnchorIndex]?.id
        : session.roundAnchorEntryId,
  })
}

export function canTradeConsecutiveAllies(
  session: InitiativeSession,
  entryId: string,
  direction: -1 | 1,
): boolean {
  if (direction !== 1) return false

  const index = session.entries.findIndex((entry) => entry.id === entryId)
  const targetIndex = index + 1

  if (index < 0 || targetIndex >= session.entries.length) {
    return false
  }

  return (
    session.entries[index].side === "ally" &&
    session.entries[targetIndex].side === "ally"
  )
}

export function applyInitiativeCondition(
  session: InitiativeSession,
  entryId: string,
  condition: Omit<InitiativeCondition, "id"> & { id?: string },
): InitiativeSession {
  return updateInitiativeEntry(session, entryId, (entry) => ({
    ...entry,
    conditions: [
      ...entry.conditions,
      {
        ...condition,
        id: condition.id ?? crypto.randomUUID(),
      },
    ],
  }))
}

export function removeInitiativeCondition(
  session: InitiativeSession,
  entryId: string,
  conditionId: string,
): InitiativeSession {
  return updateInitiativeEntry(session, entryId, (entry) => ({
    ...entry,
    conditions: entry.conditions.filter(
      (condition) => condition.id !== conditionId,
    ),
  }))
}

export function initiativeEntryDisplayName(
  entry: InitiativeEntry,
  viewer: "master" | "player" = "master",
): string {
  const custom = entry.customName?.trim()
  if (custom) return custom
  if (viewer === "master") return entry.realName?.trim() || entry.name
  if (entry.revealRealName) return entry.realName?.trim() || entry.name
  return entry.basicName?.trim() || entry.name
}

export function setInitiativeEntryManualDefeated(
  entry: InitiativeEntry,
  defeated: boolean,
): InitiativeEntry {
  return {
    ...entry,
    defeated,
    downed: defeated ? false : entry.downed,
    defeatReason: defeated ? "manual" : undefined,
  }
}

function normalizeZeroHpState(
  next: InitiativeEntry,
  previous: InitiativeEntry,
): InitiativeEntry {
  if (next.currentHp === undefined) return next
  if (next.currentHp <= 0) {
    if (next.sourceType === "character") {
      return {
        ...next,
        downed: true,
        defeated: next.defeatReason === "manual" ? next.defeated : false,
        deathSaves: normalizeDeathSaves(next.deathSaves),
      }
    }
    return next.defeated
      ? next
      : { ...next, defeated: true, downed: false, defeatReason: "zeroHp" }
  }

  const recoveredFromZero = previous.currentHp !== undefined && previous.currentHp <= 0
  return {
    ...next,
    downed: false,
    defeated: next.defeatReason === "zeroHp" ? false : next.defeated,
    defeatReason: next.defeatReason === "zeroHp" ? undefined : next.defeatReason,
    deathSaves: recoveredFromZero && next.sourceType === "character"
      ? { successes: 0, failures: 0 }
      : next.deathSaves,
  }
}

function normalizeDeathSaves(value: InitiativeDeathSaves | undefined): InitiativeDeathSaves {
  return {
    successes: clampInteger(value?.successes, 0, 3),
    failures: clampInteger(value?.failures, 0, 3),
  }
}

function clampInteger(value: unknown, minimum: number, maximum: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 0
  return Math.max(minimum, Math.min(maximum, numeric))
}

export function rollInitiative(bonus = 0): number {
  return Math.floor(Math.random() * 20) + 1 + bonus
}

function expireConditionsAtTurnEnd(
  entries: InitiativeEntry[],
  ownerEntryId: string,
): InitiativeEntry[] {
  return entries.map((entry) => ({
    ...entry,
    conditions: entry.conditions.flatMap((condition) => {
      if (
        condition.duration.type === "untilTurnEnd" &&
        condition.duration.ownerEntryId === ownerEntryId
      ) {
        return []
      }

      if (
        entry.id === ownerEntryId &&
        condition.duration.type === "turns"
      ) {
        if (condition.duration.remaining <= 1) return []

        return [
          {
            ...condition,
            duration: {
              ...condition.duration,
              remaining: condition.duration.remaining - 1,
            },
          },
        ]
      }

      return [condition]
    }),
  }))
}

function expireConditionsAtTurnStart(
  entries: InitiativeEntry[],
  ownerEntryId: string,
): InitiativeEntry[] {
  return entries.map((entry) => ({
    ...entry,
    conditions: entry.conditions.filter(
      (condition) =>
        !(
          condition.duration.type === "untilTurnStart" &&
          condition.duration.ownerEntryId === ownerEntryId
        ),
    ),
  }))
}

function decrementRoundConditions(
  entries: InitiativeEntry[],
): InitiativeEntry[] {
  return entries.map((entry) => ({
    ...entry,
    conditions: entry.conditions.flatMap((condition) => {
      if (condition.duration.type !== "rounds") return [condition]
      if (condition.duration.remaining <= 1) return []

      return [
        {
          ...condition,
          duration: {
            ...condition.duration,
            remaining: condition.duration.remaining - 1,
          },
        },
      ]
    }),
  }))
}

function touchSession(session: InitiativeSession): InitiativeSession {
  return { ...session, updatedAt: Date.now() }
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback
}

function isInitiativeSide(value: unknown): value is InitiativeSide {
  return value === "ally" || value === "enemy" || value === "neutral"
}

function isSourceType(value: unknown): value is InitiativeSourceType {
  return (
    value === "character" ||
    value === "npc" ||
    value === "monster" ||
    value === "custom"
  )
}
