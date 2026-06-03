import { Input } from '../../components/ui/Input'
import type { CharacterEquipment } from '../models/types'
import { normalizeSlot, slotBonusSummary } from './equipmentModel'

type Props = {
  equipment: CharacterEquipment
  onNameChange: (path: string, value: string) => void
  onEdit: (path: string, label: string) => void
}

function SlotCard({ label, path, equipment, onNameChange, onEdit }: {
  label: string
  path: string
  equipment: CharacterEquipment
  onNameChange: (path: string, value: string) => void
  onEdit: (path: string, label: string) => void
}) {
  let slot = normalizeSlot(equipment.armor)
  if (path === 'boots') slot = normalizeSlot(equipment.boots)
  if (path === 'helmet') slot = normalizeSlot(equipment.helmet)
  if (path === 'gloves') slot = normalizeSlot(equipment.gloves)
  if (path === 'rings:0') slot = normalizeSlot(equipment.rings[0])
  if (path === 'rings:1') slot = normalizeSlot(equipment.rings[1])
  if (path === 'rings:2') slot = normalizeSlot(equipment.rings[2])

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-text">{label}</div>
        <button
          type="button"
          className="text-sm text-accent hover:opacity-80"
          onClick={() => onEdit(path, label)}
          title="Editar efeitos e descrição"
        >
          ✎
        </button>
      </div>
      <Input
        className="mt-1 h-9"
        value={slot.name}
        onChange={(e) => onNameChange(path, e.target.value)}
        placeholder="Nome do item"
      />
      <div className="mt-2 text-[11px] text-text">{slotBonusSummary(slot)}</div>
    </div>
  )
}

export function EquipmentMainSection({ equipment, onNameChange, onEdit }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <SlotCard label="Armadura" path="armor" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Bota" path="boots" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Capacete" path="helmet" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Luvas" path="gloves" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Anel 1" path="rings:0" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Anel 2" path="rings:1" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
      <SlotCard label="Anel 3" path="rings:2" equipment={equipment} onNameChange={onNameChange} onEdit={onEdit} />
    </div>
  )
}
