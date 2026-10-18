import { Fragment, type ReactNode } from "react"

/** Framework-neutral (other than React) table layout with externally rendered combat rows. */
export function InitiativeRosterTable<TEntry>({
  entries, getKey, renderRows, headings,
}: {
  entries: readonly TEntry[]
  getKey: (entry: TEntry) => string
  renderRows: (entry: TEntry) => ReactNode
  headings: readonly string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-textMuted">
          <tr>
            {headings.map((heading, index) => (
              <th key={heading} className={index === headings.length - 1 ? "px-3 py-3 text-right" : "px-3 py-3"}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{entries.map((entry) => <Fragment key={getKey(entry)}>{renderRows(entry)}</Fragment>)}</tbody>
      </table>
    </div>
  )
}
