import { useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { Itemmable } from "../../../models/items/item"
import {
  STANDARD_ITEM_DEFINITIONS,
  instantiateStandardItem,
} from "../../items/standardItemCompendium"
import { matchesPhbWeaponCategory } from "./phbWeaponCategory"

export type StartingWeaponCategory = "simple" | "martial"

type Props = {
  category: StartingWeaponCategory
  current?: Itemmable
  onClose: () => void
  onSelect: (item: Itemmable) => void
}

export function CharacterCreationWeaponPicker({
  category,
  current,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("")
  const definitions = useMemo(() => {
    const normalizedQuery = normalize(query)
    return STANDARD_ITEM_DEFINITIONS.filter((definition) => {
      const item = definition.item
      if (!(item.kind === "equipment" && item.equipSlot === "weapon")) {
        return false
      }
      if (!matchesPhbWeaponCategory(item, category)) return false

      return (
        !normalizedQuery ||
        normalize(`${item.name} ${item.desc ?? ""}`).includes(normalizedQuery)
      )
    })
  }, [category, query])

  return createPortal(
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4"
      onMouseDown={onClose}
    >
      <section
        className="grid max-h-[90dvh] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-bg-elevated"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold text-textH">
            Escolher arma {category === "martial" ? "marcial" : "simples"}
          </h2>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </header>

        <div className="border-b border-border p-4">
          <Input
            value={query}
            placeholder="Buscar arma"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="grid gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {definitions.map((definition) => {
            const selected =
              current?.compendiumItemId === definition.item.id
            return (
              <button
                key={definition.item.id}
                type="button"
                onClick={() =>
                  onSelect(instantiateStandardItem(definition.item.id, 1))
                }
                className={
                  selected
                    ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                    : "rounded-xl border border-border bg-bg p-3 text-left"
                }
              >
                <div className="font-semibold text-textH">
                  {definition.item.name}
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  {definition.item.desc || "Sem descrição."}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
