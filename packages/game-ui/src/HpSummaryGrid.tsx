import type { ReactNode } from "react"

/** Session-agnostic HP summary layout; host provides the value views. */
export function HpSummaryGrid({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid grid-cols-2 gap-2"}>{children}</div>
}
