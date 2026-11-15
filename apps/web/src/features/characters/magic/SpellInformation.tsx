import type { SpellInformationEntry } from "../../../models/magic/spells/spellInformation"

export function SpellInformation({ entries }: { entries: SpellInformationEntry[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg-subtle p-3">
      {entries.map(entry => (
        <div key={entry.label} className={entry.label === "Material" ? "col-span-2" : "min-w-0"}>
          <dt className="text-[10px] text-textMuted">{entry.label}</dt>
          <dd className="break-words text-xs text-textH">{entry.value}</dd>
        </div>
      ))}
    </dl>
  )
}
