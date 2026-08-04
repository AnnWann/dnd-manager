import axios from "axios"

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

export function getApiStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return error.response?.status ?? null
}