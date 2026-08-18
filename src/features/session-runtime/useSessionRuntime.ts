import { useContext } from "react"
import { SessionRuntimeContext } from "./SessionRuntimeProvider"

export function useSessionRuntime() {
  const context = useContext(SessionRuntimeContext)

  if (!context) {
    throw new Error("useSessionRuntime must be used inside SessionRuntimeProvider")
  }

  return context
}
