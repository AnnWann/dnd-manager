import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios"

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

const responseCache = new Map<string, AxiosResponse>()

apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase()

  if (method !== "get") {
    responseCache.clear()
    return config
  }

  const key = cacheKey(config)
  const cached = responseCache.get(key)
  if (!cached) return config

  config.adapter = async () => ({
    ...cached,
    config,
    request: undefined,
  })

  return config
})

apiClient.interceptors.response.use((response) => {
  const method = (response.config.method ?? "get").toLowerCase()
  if (method === "get") {
    responseCache.set(cacheKey(response.config), response)
  }
  return response
})

function cacheKey(config: InternalAxiosRequestConfig): string {
  const params = config.params
    ? JSON.stringify(config.params)
    : ""
  return `${config.baseURL ?? ""}${config.url ?? ""}?${params}`
}

export function clearApiReadCache(): void {
  responseCache.clear()
}

export function getApiStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return error.response?.status ?? null
}
