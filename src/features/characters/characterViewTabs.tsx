import type { LucideIcon } from "lucide-react"
import {
  ScrollText,
  Sparkles,
  Shield,
  Backpack,
  WandSparkles
} from "lucide-react"

export type CharacterTab =
  | "sheet"
  | "abilities"
  | "equipment"
  | "inventory"
  | "spellsList"
type Props = {
  activeTab: CharacterTab
  setActiveTab: (tab: CharacterTab) => void
}

const TABS: Array<{
  key: CharacterTab
  label: string
  icon: LucideIcon
}> = [
  { key: "sheet", label: "Ficha", icon: ScrollText },
  { key: "abilities", label: "Habilidades", icon: Sparkles },
  { key: "equipment", label: "Equipamento", icon: Shield },
  { key: "inventory", label: "Inventário", icon: Backpack },
  { key: "spellsList", label: "Magias Conhecidas", icon: WandSparkles }
]

export function CharacterViewTabs({
  activeTab,
  setActiveTab,
}: Props) {
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-bg p-1">
      {TABS.map((tab) => {
        const TabIcon = tab.icon

        return (
          <button
            key={tab.key}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? "flex-1 rounded-md bg-accentBg px-3 py-2 text-xs font-medium text-textH"
                : "flex-1 rounded-md px-3 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
            }
          >
            <span className="flex items-center justify-center sm:hidden">
              <TabIcon className="h-4 w-4" />
            </span>

            <span className="hidden sm:block">
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}