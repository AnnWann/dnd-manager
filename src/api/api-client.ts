import axios from "axios"

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * Kept as a compatibility hook for callers that explicitly invalidate API reads.
 * User-facing stale-while-revalidate caching now lives in the user data providers,
 * so GET requests always reach the server when a refresh is requested.
 */
export function clearApiReadCache(): void {}

export function getApiStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return error.response?.status ?? null
}
