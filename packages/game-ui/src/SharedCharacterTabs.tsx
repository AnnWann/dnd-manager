import { useState, type ReactNode } from "react"

export type SheetTabId = "sheet" | "abilities" | "spells-list" | "equipment" | "inventory" | "race" | "profile" | "proficiencies"
export const STANDARD_SHEET_TABS: ReadonlyArray<{ id: SheetTabId; label: string }> = [
  { id: "sheet", label: "Ficha" },
  { id: "abilities", label: "Habilidades" },
  { id: "spells-list", label: "Magias" },
  { id: "equipment", label: "Equipamento" },
  { id: "inventory", label: "Inventário" },
  { id: "race", label: "Raça" },
  { id: "profile", label: "Perfil" },
  { id: "proficiencies", label: "Proficiências" },
]
/** Stateless data boundary: either website or VTT can supply its own authorized tab content. */
export function SharedCharacterTabs({ sections, defaultTab = "sheet" }: {
  sections: Partial<Record<SheetTabId, ReactNode>>
  defaultTab?: SheetTabId
}) {
  const [active, setActive] = useState<SheetTabId>(defaultTab)
  return <div className="sheet-shared-tabs">
    <nav className="sheet-shared-nav" aria-label="Seções do personagem" role="tablist">
      {STANDARD_SHEET_TABS.map(tab => <button key={tab.id} type="button" role="tab"
        aria-selected={active === tab.id} className={active === tab.id ? "sheet-tab-active" : ""}
        onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </nav>
    <section role="tabpanel" aria-label={STANDARD_SHEET_TABS.find(tab => tab.id === active)?.label}>
      {sections[active] ?? <p>Os dados desta seção ainda não estão disponíveis no adaptador de sessão.</p>}
    </section>
  </div>
}
