import type { ReactNode } from "react"

export type BoardColumn<TStatus extends string, TItem> = {
  status: TStatus
  label: string
  description: string
  emptyMessage: string
  icon?: ReactNode
  items: readonly TItem[]
}

/** Presentation-only board. The host owns permissions, persistence and commands. */
export function MissionBoard<TStatus extends string, TItem>({
  columns,
  getItemKey,
  renderItem,
}: {
  columns: readonly BoardColumn<TStatus, TItem>[]
  getItemKey: (item: TItem) => string
  renderItem: (item: TItem, status: TStatus) => ReactNode
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      {columns.map((column) => (
        <section key={column.status} className="overflow-hidden rounded-xl border border-border bg-bg">
          <header className="border-b border-border bg-bg-subtle p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {column.icon}
                <h2 className="text-sm font-semibold text-textH">{column.label}</h2>
              </div>
              <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-textH">
                {column.items.length}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-textMuted">{column.description}</p>
          </header>
          <div className="grid gap-3 p-3">
            {column.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-textMuted">
                {column.emptyMessage}
              </div>
            ) : column.items.map((item) => (
              <div key={getItemKey(item)}>{renderItem(item, column.status)}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
