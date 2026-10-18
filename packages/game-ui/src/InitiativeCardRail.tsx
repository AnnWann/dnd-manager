import type { ReactNode } from "react"

/** Horizontal combat card track; entries and interactions are host-owned. */
export function InitiativeCardRail({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto scroll-smooth p-5">
      <div className="flex min-w-max items-stretch gap-4 pb-2">
        {children}
      </div>
    </div>
  )
}
