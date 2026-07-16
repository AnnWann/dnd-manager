import { useEffect, useRef } from "react"
import {
  BadgeCheck,
  ScrollText,
  Sparkles,
  Shield,
  Backpack,
  WandSparkles,
  Leaf,
  UserRound,
  type LucideIcon,
} from "lucide-react"

export type CharacterTab =
  | "sheet"
  | "race"
  | "profile"
  | "abilities"
  | "proficiencies"
  | "equipment"
  | "inventory"
  | "spellsList"

export type CharacterViewTabDefinition = {
  key: string
  label: string
  icon: LucideIcon
}

type Props = {
  activeTab: string
  setActiveTab: (tab: string) => void
  tabs?: CharacterViewTabDefinition[]
}

export const CHARACTER_TABS: CharacterViewTabDefinition[] = [
  { key: "sheet", label: "Ficha", icon: ScrollText },
  { key: "abilities", label: "Habilidades", icon: Sparkles },
  { key: "spellsList", label: "Magias", icon: WandSparkles },
  { key: "equipment", label: "Equipamento", icon: Shield },
  { key: "inventory", label: "Inventário", icon: Backpack },
  { key: "race", label: "Raça", icon: Leaf },
  { key: "profile", label: "Perfil", icon: UserRound },
  { key: "proficiencies", label: "Proficiências", icon: BadgeCheck },
]

export function CharacterViewTabs({
  activeTab,
  setActiveTab,
  tabs = CHARACTER_TABS,
}: Props) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [activeTab])

  return (
    <nav
      aria-label="Seções do personagem"
      className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-bg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max snap-x snap-mandatory gap-1 sm:gap-2 lg:min-w-0">
        {tabs.map((tab) => {
          const TabIcon = tab.icon
          const isActive = activeTab === tab.key

          return (
            <button
              ref={isActive ? activeButtonRef : undefined}
              key={tab.key}
              type="button"
              title={tab.label}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex h-12 w-12 shrink-0 snap-center items-center justify-center gap-2 rounded-lg px-3 text-xs transition-colors sm:h-10 sm:w-auto sm:min-w-max lg:min-w-0 lg:flex-1",
                isActive
                  ? "bg-accentBg font-medium text-textH"
                  : "text-text hover:bg-[color:var(--social-bg)]",
              ].join(" ")}
            >
              <TabIcon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
              <span className="hidden whitespace-nowrap sm:inline">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
