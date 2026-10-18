import { LOCAL_AUTH_BYPASS } from "../auth/local-auth"
import { notifySessionContentChanged } from "../lib/sessionEvents"
import { apiClient } from "./api-client"

export type SessionContentRequestType =
  | "CHARACTER"
  | "SYSTEM"
  | "CLASS"
  | "OTHER"

export type SessionContentRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"

export type SessionCharacterPreview = {
  id: string
  name: string
  data: Record<string, unknown>
  revision: number
  owner: {
    id: string
    name: string
  }
  domains: Array<{
    domain: string
    payload: Record<string, unknown>
    version: number
    updatedBy?: string | null
    updatedAt: string
  }>
}

export type SessionContentRequest = {
  id: string
  campaignId: string
  type: SessionContentRequestType
  status: SessionContentRequestStatus
  title: string
  sourceId: string
  data: Record<string, unknown>
  characterPreview?: SessionCharacterPreview | null
  note?: string | null
  submittedBy: {
    id: string
    name: string
  }
  reviewedBy?: {
    id: string
    name: string
  } | null
  submittedAt: string
  reviewedAt?: string | null
  updatedAt: string
}

const LOCAL_KEY = "dnd-manager:session-content-requests:v1"
const requestCache = new Map<string, SessionContentRequest[]>()
const pendingReads = new Map<string, Promise<SessionContentRequest[]>>()

function cacheKey(
  campaignId: string,
  status: SessionContentRequestStatus,
): string {
  return `${campaignId}:${status}`
}

export function primeSessionContentRequests(
  campaignId: string,
  status: SessionContentRequestStatus,
  requests: SessionContentRequest[],
): void {
  requestCache.set(cacheKey(campaignId, status), structuredClone(requests))
}

export function invalidateSessionContentRequests(campaignId: string): void {
  for (const key of [...requestCache.keys()]) {
    if (key.startsWith(`${campaignId}:`)) requestCache.delete(key)
  }
  for (const key of [...pendingReads.keys()]) {
    if (key.startsWith(`${campaignId}:`)) pendingReads.delete(key)
  }
}

export async function getSessionContentRequests(
  campaignId: string,
  status: SessionContentRequestStatus = "PENDING",
  options: { force?: boolean } = {},
): Promise<SessionContentRequest[]> {
  if (LOCAL_AUTH_BYPASS) {
    return readLocalRequests().filter(
      (entry) => entry.campaignId === campaignId && entry.status === status,
    )
  }

  const key = cacheKey(campaignId, status)
  if (!options.force) {
    const cached = requestCache.get(key)
    if (cached) return structuredClone(cached)
    const pending = pendingReads.get(key)
    if (pending) return pending.then((requests) => structuredClone(requests))
  }

  const request = apiClient
    .get<{
      requests: SessionContentRequest[]
    }>(`/campaigns/${encodeURIComponent(campaignId)}/requests`, {
      params: { status },
    })
    .then((response) => {
      const requests = response.data.requests ?? []
      primeSessionContentRequests(campaignId, status, requests)
      return structuredClone(requests)
    })
    .finally(() => {
      pendingReads.delete(key)
    })

  pendingReads.set(key, request)
  return request
}

export async function submitSessionContentRequest(
  campaignId: string,
  input: {
    type: SessionContentRequestType
    title: string
    sourceId: string
    data?: Record<string, unknown>
  },
): Promise<"PENDING" | "APPROVED"> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    const requests = readLocalRequests()
    const next: SessionContentRequest = {
      id: crypto.randomUUID(),
      campaignId,
      type: input.type,
      status: "PENDING",
      title: input.title,
      sourceId: input.sourceId,
      data: input.data ?? {},
      submittedBy: {
        id: "local-development-user",
        name: "Usuário local",
      },
      submittedAt: now,
      updatedAt: now,
    }
    writeLocalRequests([
      ...requests.filter(
        (entry) =>
          !(
            entry.campaignId === campaignId &&
            entry.type === input.type &&
            entry.sourceId === input.sourceId
          ),
      ),
      next,
    ])
    invalidateSessionContentRequests(campaignId)
    return "PENDING"
  }

  const response = await apiClient.post<{
    status: "PENDING" | "APPROVED"
  }>(`/campaigns/${encodeURIComponent(campaignId)}/requests`, input)
  invalidateSessionContentRequests(campaignId)
  if (response.data.status === "APPROVED") {
    notifySessionContentChanged()
  }
  return response.data.status
}

export async function reviewSessionContentRequest(
  campaignId: string,
  requestId: string,
  status: "APPROVED" | "REJECTED",
  note?: string,
): Promise<void> {
  if (LOCAL_AUTH_BYPASS) {
    const now = new Date().toISOString()
    writeLocalRequests(
      readLocalRequests().map((entry) =>
        entry.id === requestId && entry.campaignId === campaignId
          ? {
              ...entry,
              status,
              note: note?.trim() || null,
              reviewedBy: {
                id: "local-development-user",
                name: "Usuário local",
              },
              reviewedAt: now,
              updatedAt: now,
            }
          : entry,
      ),
    )
    invalidateSessionContentRequests(campaignId)
    notifySessionContentChanged()
    return
  }

  await apiClient.patch(
    `/campaigns/${encodeURIComponent(campaignId)}/requests/${encodeURIComponent(requestId)}`,
    { status, note },
  )
  invalidateSessionContentRequests(campaignId)
  notifySessionContentChanged()
}

function readLocalRequests(): SessionContentRequest[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as unknown
    return Array.isArray(parsed) ? parsed as SessionContentRequest[] : []
  } catch {
    return []
  }
}

function writeLocalRequests(requests: SessionContentRequest[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(requests))
  } catch {
    // Development fallback only.
  }
}
