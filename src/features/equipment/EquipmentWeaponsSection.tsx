import { Input } from '../../components/ui/Input'
import type { CharacterEquipment } from '../models/types'
import { normalizeSlot, slotBonusSummary } from './equipmentModel'

type Props = {
  equipment: CharacterEquipment
  usedLimbCount: number
  onLimbCountChange: (next: number) => void
  onWeaponNameChange: (idx: number, value: string) => void
  onEdit: (path: string, label: string) => void
}

export function EquipmentWeaponsSection({
  equipment,
  usedLimbCount,
  onLimbCountChange,
  onWeaponNameChange,
  onEdit,
}: Props) {
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <div className="text-sm font-medium text-textH">Membros e slots de arma</div>
      <div className="mt-2 grid gap-2 md:grid-cols-[220px_1fr] md:items-end">
        <div>
          <label className="text-xs text-text">Quantidade de membros</label>
          <Input
            type="number"
            className="mt-1 h-9"
            min={0}
            value={equipment.limbCount}
            onChange={(e) => onLimbCountChange(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
          />
        </div>
        <div className="text-xs text-text">
          Slots de arma: <strong>{equipment.weaponSlots.length}</strong> • Membros usados: <strong>{usedLimbCount}/{equipment.limbCount}</strong>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {equipment.weaponSlots.map((slot, idx) => {
          const normalized = normalizeSlot(slot)
          return (
            <div key={`weapon-${idx}`} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-text">Arma {idx + 1}</div>
                <button
                  type="button"
                  className="text-sm text-accent hover:opacity-80"
                  onClick={() => onEdit(`weaponSlots:${idx}`, `Arma ${idx + 1}`)}
                  title="Editar arma"
                >
                  ✎
                </button>
              </div>
              <Input
                className="mt-1 h-9"
                value={normalized.name}
                onChange={(e) => onWeaponNameChange(idx, e.target.value)}
                placeholder="Nome da arma"
              />
              <div className="mt-2 text-[11px] text-text">{slotBonusSummary(normalized)} • {normalized.twoHanded ? '2 mãos' : '1 mão'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
