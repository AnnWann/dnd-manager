import { useContext } from "react"
import { SessionRuntimeContext } from "./SessionRuntimeProvider"

export function useOptionalSessionRuntime() {
  return useContext(SessionRuntimeContext)
}

export function useSessionRuntime() {
  const context = useOptionalSessionRuntime()

  if (!context) {
    throw new Error("useSessionRuntime must be used inside SessionRuntimeProvider")
  }

  return context
}
