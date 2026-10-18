import type { ReactNode } from "react"

/** Inventory surface shared by website and embedded session clients.
 * The host supplies compartment tiles and actions; this view owns no inventory state.
 */
export function InventoryTileGrid({
  children, empty, isEmpty,
}: {
  children: ReactNode
  empty: ReactNode
  isEmpty: boolean
}) {
  return isEmpty ? (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
      {empty}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {children}
    </div>
  )
}
