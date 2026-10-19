import { CharacterTabStrip } from "./CharacterTabStrip"
import { useState, type ReactNode } from "react"

export type SheetTabId = "sheet" | "abilities" | "spells-list" | "equipment" | "inventory" | "race" | "profile" | "proficiencies" | "custom-class"
export const STANDARD_SHEET_TABS: ReadonlyArray<{ id: SheetTabId; label: string }> = [
  { id: "sheet", label: "Ficha" },
  { id: "abilities", label: "Habilidades" },
  { id: "spells-list", label: "Magias" },
  { id: "equipment", label: "Equipamento" },
  { id: "inventory", label: "Inventário" },
  { id: "race", label: "Raça" },
  { id: "profile", label: "Perfil" },
  { id: "proficiencies", label: "Proficiências" },
  { id: "custom-class", label: "Classe customizada" },
]
/** Stateless data boundary: either website or VTT can supply its own authorized tab content. */
export function SharedCharacterTabs({ sections, tabs = STANDARD_SHEET_TABS, defaultTab = "sheet" }: {
  sections: Record<string, ReactNode>
  tabs?: ReadonlyArray<{ id: string; label: string }>
  defaultTab?: string
}) {
  const [active, setActive] = useState(defaultTab)
  return <div className="sheet-shared-tabs">
    <CharacterTabStrip activeTab={active} onChange={setActive}
      tabs={tabs.map(tab => ({ key: tab.id, label: tab.label }))} />
    <section role="tabpanel" aria-label={tabs.find(tab => tab.id === active)?.label}>
      {sections[active] ?? <p>Os dados desta seção ainda não estão disponíveis no adaptador de sessão.</p>}
    </section>
  </div>
}
