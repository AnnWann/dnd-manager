import { Input } from '../../components/ui/Input'
import type { CharacterEquipment } from '../models/types'
import { normalizeSlot, slotBonusSummary } from './equipmentModel'

type Props = {
  equipment: CharacterEquipment
  onPocketNameChange: (idx: number, value: string) => void
  onEdit: (path: string, label: string) => void
}

export function EquipmentPocketSection({ equipment, onPocketNameChange, onEdit }: Props) {
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <div className="text-sm font-medium text-textH">Bolso (acesso rápido)</div>
      <div className="mt-1 text-xs text-text">Itens de uso fácil em combate, como adagas, bombas e poções.</div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-bg/60 text-xs uppercase tracking-wide text-text">
            <tr>
              <th className="border-b border-accentBorder px-3 py-2">Slot</th>
              <th className="border-b border-accentBorder px-3 py-2">Item</th>
              <th className="border-b border-accentBorder px-3 py-2">Bônus</th>
              <th className="border-b border-accentBorder px-3 py-2">Descrição</th>
              <th className="border-b border-accentBorder px-3 py-2">Editar</th>
            </tr>
          </thead>
          <tbody>
            {equipment.pocket.map((slot, idx) => {
              const normalized = normalizeSlot(slot)
              return (
                <tr key={`pocket-${idx}`}>
                  <td className="border-b border-accentBorder px-3 py-2 text-text">{idx + 1}</td>
                  <td className="border-b border-accentBorder px-3 py-2">
                    <Input
                      className="h-8"
                      value={normalized.name}
                      onChange={(e) => onPocketNameChange(idx, e.target.value)}
                      placeholder="Nome do item"
                    />
                  </td>
                  <td className="border-b border-accentBorder px-3 py-2 text-text">
                    <span className="text-xs">{slotBonusSummary(normalized)}</span>
                  </td>
                  <td className="border-b border-accentBorder px-3 py-2 text-text">
                    <span className="text-xs">{normalized.notes?.trim() || '—'}</span>
                  </td>
                  <td className="border-b border-accentBorder px-3 py-2 text-text">
                    <button
                      type="button"
                      className="text-sm text-accent hover:opacity-80"
                      onClick={() => onEdit(`pocket:${idx}`, `Bolso ${idx + 1}`)}
                      title="Editar detalhes"
                    >
                      ✎
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
