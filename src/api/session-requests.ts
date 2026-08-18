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

export type SessionContentRequest = {
  id: string
  campaignId: string
  type: SessionContentRequestType
  status: SessionContentRequestStatus
  title: string
  sourceId: string
  data: Record<string, unknown>
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

export async function getSessionContentRequests(
  campaignId: string,
  status: SessionContentRequestStatus = "PENDING",
): Promise<SessionContentRequest[]> {
  if (LOCAL_AUTH_BYPASS) {
    return readLocalRequests().filter(
      (entry) => entry.campaignId === campaignId && entry.status === status,
    )
  }

  const response = await apiClient.get<{
    requests: SessionContentRequest[]
  }>(`/campaigns/${encodeURIComponent(campaignId)}/requests`, {
    params: { status },
  })
  return response.data.requests ?? []
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
    return "PENDING"
  }

  const response = await apiClient.post<{
    status: "PENDING" | "APPROVED"
  }>(`/campaigns/${encodeURIComponent(campaignId)}/requests`, input)
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
    notifySessionContentChanged()
    return
  }

  await apiClient.patch(
    `/campaigns/${encodeURIComponent(campaignId)}/requests/${encodeURIComponent(requestId)}`,
    { status, note },
  )
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
