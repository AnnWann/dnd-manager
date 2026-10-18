import { useState } from "react"
import { Button } from "../../components/ui/Button"
import { Select } from "../../components/ui/Select"
import { useMagicContext } from "../../contexts/magicContext"
import type { Itemmable } from "../../models/items/item"
import type { Attribute } from "../../models/sheet/Attribute"
import { SpellPickerDialog } from "../characters/magic/grantedSpellsEditor"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" }, { value: "dex", label: "DES" }, { value: "con", label: "CON" },
  { value: "int", label: "INT" }, { value: "wis", label: "SAB" }, { value: "cha", label: "CAR" },
]

export function ScrollSpellFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const { getSpellByIndex } = useMagicContext()
  const [open, setOpen] = useState(false)
  const spell = item.scrollSpellIndex ? getSpellByIndex(item.scrollSpellIndex) : undefined
  return (
    <div className="md:col-span-3 grid gap-3 rounded-xl border border-accentBorder bg-accentBg p-3">
      <div className="text-sm font-semibold text-textH">Magia do pergaminho</div>
      <p className="text-xs text-textMuted">
        Selecione uma magia. Ao segurar o pergaminho ou colocá-lo no bolso, o personagem poderá conjurá-la uma vez; uma unidade do pergaminho será destruída.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-textH">{spell?.displayName || spell?.name || item.scrollSpellIndex || "Nenhuma magia selecionada"}</span>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Escolher magia</Button>
      </div>
      <label className="grid gap-1 text-xs text-textMuted">Atributo de conjuração
        <Select value={item.scrollCastingAttribute ?? "int"} onChange={event => onUpdate(current => ({ ...current, scrollCastingAttribute: event.target.value as Attribute }))}>
          {ATTRIBUTES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </label>
      <SpellPickerDialog open={open} excludedIndexes={new Set<string>()} onClose={() => setOpen(false)}
        onSelect={selected => {
          onUpdate(current => ({ ...current, scrollSpellIndex: selected.index, scrollCastingAttribute: current.scrollCastingAttribute ?? "int" }))
          setOpen(false)
        }} />
    </div>
  )
}
