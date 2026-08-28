import { useContext } from "react"
import { SessionRuntimeContext, SessionRuntimeLogContext } from "./SessionRuntimeProvider"

export function useOptionalSessionRuntime() {
  return useContext(SessionRuntimeContext)
}

export function useOptionalSessionRuntimeLog() {
  return useContext(SessionRuntimeLogContext)
}

export function useSessionRuntimeLog() {
  const context = useOptionalSessionRuntimeLog()
  if (!context) {
    throw new Error("useSessionRuntimeLog must be used inside SessionRuntimeProvider")
  }
  return context
}

export function useSessionRuntime() {
  const context = useOptionalSessionRuntime()

  if (!context) {
    throw new Error("useSessionRuntime must be used inside SessionRuntimeProvider")
  }

  return context
}
