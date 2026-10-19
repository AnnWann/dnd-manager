import { useEffect, useRef, type ComponentType } from "react"

export type PortableSheetTab<T extends string = string> = {
  key: T
  label: string
  icon?: ComponentType<{ className?: string }>
}
export function CharacterTabStrip<T extends string>({ activeTab, onChange, tabs }: {
  activeTab: T
  onChange: (tab: T) => void
  tabs: readonly PortableSheetTab<T>[]
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activeTab])
  return <nav aria-label="Seções do personagem"
    className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-bg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div className="flex min-w-max snap-x snap-mandatory gap-1 sm:gap-2 lg:min-w-0">
      {tabs.map(tab => {
        const Icon = tab.icon
        const selected = activeTab === tab.key
        return <button key={tab.key} ref={selected ? selectedRef : undefined}
          type="button" title={tab.label} aria-label={tab.label}
          aria-current={selected ? "page" : undefined} onClick={() => onChange(tab.key)}
          className={[
            "flex h-12 w-12 shrink-0 snap-center items-center justify-center gap-2 rounded-lg px-3 text-xs transition-colors sm:h-10 sm:w-auto sm:min-w-max lg:min-w-0 lg:flex-1",
            selected ? "bg-accentBg font-medium text-textH" : "text-text hover:bg-[color:var(--social-bg)]"
          ].join(" ")}>
          {Icon ? <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" /> : null}
          <span className={Icon ? "hidden whitespace-nowrap sm:inline" : "whitespace-nowrap"}>{tab.label}</span>
        </button>
      })}
    </div>
  </nav>
}
