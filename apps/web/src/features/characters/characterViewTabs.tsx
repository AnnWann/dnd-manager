import { CharacterTabStrip } from "@dnd-manager/game-ui/character-tab-strip"
import {
  BadgeCheck,
  ScrollText,
  Sparkles,
  Shield,
  Backpack,
  WandSparkles,
  Leaf,
  UserRound,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"

import {
  getCustomSystemIconComponent,
} from "../customSystems/CustomSystemIcon"
import { useCustomSystemDefinitions } from "../../lib/customSystems/CustomSystemRegistry"

export type CharacterTab =
  | "sheet"
  | "race"
  | "profile"
  | "abilities"
  | "proficiencies"
  | "equipment"
  | "inventory"
  | "spells-list"
  | "custom-class"

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

export const CHARACTER_TABS: Array<CharacterViewTabDefinition & { key: CharacterTab }> = [
  { key: "sheet", label: "Ficha", icon: ScrollText },
  { key: "abilities", label: "Habilidades", icon: Sparkles },
  { key: "spells-list", label: "Magias", icon: WandSparkles },
  { key: "equipment", label: "Equipamento", icon: Shield },
  { key: "inventory", label: "Inventário", icon: Backpack },
  { key: "race", label: "Raça", icon: Leaf },
  { key: "profile", label: "Perfil", icon: UserRound },
  { key: "proficiencies", label: "Proficiências", icon: BadgeCheck },
  { key: "custom-class", label: "Classe customizada", icon: SlidersHorizontal },
]

export function CharacterViewTabs({
  activeTab,
  setActiveTab,
  tabs = CHARACTER_TABS,
}: Props) {
  const customSystemDefinitions = useCustomSystemDefinitions()
  return <CharacterTabStrip activeTab={activeTab} onChange={setActiveTab}
    tabs={tabs.map(tab => {
      const system = customSystemDefinitions.find(definition => definition.id === tab.key)
      return { key: tab.key, label: tab.label, icon: system ? getCustomSystemIconComponent(system.icon) : tab.icon }
    })} />
}
