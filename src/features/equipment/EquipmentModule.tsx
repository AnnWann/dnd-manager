import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { defaultEquipment, weaponSlotsFromLimbCount } from '../../lib/character'
import type { Character, CharacterEquipment, EquipmentSlot } from '../../types'
import { enforceWeaponCapacity, normalizeSlot, slotBonusSummary, weaponCost } from './equipmentModel'
import { EquipmentMainSection } from './EquipmentMainSection'
import { EquipmentWeaponsSection } from './EquipmentWeaponsSection'
import { EquipmentPocketSection } from './EquipmentPocketSection'

type Props = {
  activeCharacter: Character
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function EquipmentModule({ activeCharacter, updateCharacter }: Props) {
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const equipment = activeCharacter.equipment ?? defaultEquipment(2)

  const usedLimbCount = useMemo(
    () => equipment.weaponSlots.reduce((acc, slot) => acc + weaponCost(normalizeSlot(slot)), 0),
    [equipment.weaponSlots],
  )

  function openEditor(path: string, label: string) {
    setEditingPath(path)
    setEditingLabel(label)
  }

  function closeEditor() {
    setEditingPath(null)
    setEditingLabel('')
  }

  function updateEquipment(mutator: (eq: CharacterEquipment) => CharacterEquipment) {
    updateCharacter(activeCharacter.id, (c) => {
      const eq = c.equipment ?? defaultEquipment(2)
      const next = mutator(eq)
      const enforced = {
        ...next,
        weaponSlots: enforceWeaponCapacity(next.weaponSlots.map((slot) => normalizeSlot(slot)), next.limbCount),
      }
      return { ...c, equipment: enforced }
    })
  }

  function updateEquipmentSlot(path: string, updater: (slot: EquipmentSlot) => EquipmentSlot) {
    updateEquipment((current) => {
      const next = { ...current }

      if (path.startsWith('rings:')) {
        const idx = Number(path.split(':')[1])
        next.rings = next.rings.map((slot, i) => (i === idx ? updater(normalizeSlot(slot)) : slot))
      } else if (path.startsWith('weaponSlots:')) {
        const idx = Number(path.split(':')[1])
        next.weaponSlots = next.weaponSlots.map((slot, i) => (i === idx ? updater(normalizeSlot(slot)) : slot))
      } else if (path.startsWith('pocket:')) {
        const idx = Number(path.split(':')[1])
        next.pocket = next.pocket.map((slot, i) => (i === idx ? updater(normalizeSlot(slot)) : slot))
      } else {
        const key = path as 'armor' | 'boots' | 'helmet' | 'gloves'
        next[key] = updater(normalizeSlot(next[key]))
      }

      return next
    })
  }

  function getSlotByPath(path: string): EquipmentSlot {
    if (path.startsWith('rings:')) {
      const idx = Number(path.split(':')[1])
      return normalizeSlot(equipment.rings[idx])
    }
    if (path.startsWith('weaponSlots:')) {
      const idx = Number(path.split(':')[1])
      return normalizeSlot(equipment.weaponSlots[idx])
    }
    if (path.startsWith('pocket:')) {
      const idx = Number(path.split(':')[1])
      return normalizeSlot(equipment.pocket[idx])
    }
    const key = path as 'armor' | 'boots' | 'helmet' | 'gloves'
    return normalizeSlot(equipment[key])
  }

  const modalNode = editingPath
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-xl border border-accentBorder p-4 shadow-xl"
            style={{ backgroundColor: 'var(--social-bg)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-textH">Editar: {editingLabel}</div>
              <button type="button" className="text-sm text-text hover:opacity-80" onClick={closeEditor}>✕</button>
            </div>

            {(() => {
              const slot = getSlotByPath(editingPath)
              const isWeaponSlot = editingPath.startsWith('weaponSlots:')
              return (
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs text-text">Item</label>
                    <Input
                      className="mt-1 h-9"
                      value={slot.name}
                      onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({ ...s, name: e.target.value }))}
                    />
                  </div>

                  {isWeaponSlot ? (
                    <label className="flex items-center gap-2 text-xs text-text">
                      <input
                        type="checkbox"
                        checked={Boolean(slot.twoHanded)}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({ ...s, twoHanded: e.target.checked }))}
                      />
                      Arma de duas mãos
                    </label>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-text">Bônus CA</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.armorClass ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), armorClass: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">Iniciativa</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.initiative ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), initiative: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">Bônus Inic.</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.initiativeBonus ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), initiativeBonus: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">Bônus Atk</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.attackBonus ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), attackBonus: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">HP Máx.</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.maxHp ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), maxHp: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">HP Atual</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.currentHp ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), currentHp: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">HP Temp.</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.temporaryHp ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), temporaryHp: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">Percepção</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.passivePerception ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), passivePerception: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text">Mobilidade</label>
                      <Input
                        type="number"
                        className="mt-1 h-9"
                        value={slot.bonuses?.mobility ?? 0}
                        onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({
                          ...s,
                          bonuses: { ...(s.bonuses ?? {}), mobility: Number(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-text">Descrição</label>
                    <Input
                      className="mt-1 h-9"
                      value={slot.notes ?? ''}
                      onChange={(e) => updateEquipmentSlot(editingPath, (s) => ({ ...s, notes: e.target.value }))}
                      placeholder="Detalhes específicos do item"
                    />
                  </div>

                  <div className="text-[11px] text-text">{slotBonusSummary(slot)}</div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-md border border-accentBorder px-3 py-1.5 text-xs text-textH hover:bg-accentBg"
                      onClick={closeEditor}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Equipamento</div>
          <div className="mt-1 text-xs text-text">Slots de itens equipados, armas por membros e bolso rápido de combate.</div>
        </CardHeader>
        <CardContent>
          <EquipmentMainSection
            equipment={equipment}
            onEdit={openEditor}
            onNameChange={(path, value) => updateEquipmentSlot(path, (s) => ({ ...s, name: value }))}
          />

          <EquipmentWeaponsSection
            equipment={equipment}
            usedLimbCount={usedLimbCount}
            onEdit={openEditor}
            onLimbCountChange={(limbCount) => {
              const weaponCount = weaponSlotsFromLimbCount(limbCount)
              updateEquipment((eq) => ({
                ...eq,
                limbCount,
                weaponSlots: Array.from({ length: weaponCount }, (_, idx) => normalizeSlot(eq.weaponSlots[idx])),
              }))
            }}
            onWeaponNameChange={(idx, value) => updateEquipmentSlot(`weaponSlots:${idx}`, (s) => ({ ...s, name: value }))}
          />

          <EquipmentPocketSection
            equipment={equipment}
            onEdit={openEditor}
            onPocketNameChange={(idx, value) => updateEquipmentSlot(`pocket:${idx}`, (s) => ({ ...s, name: value }))}
          />
        </CardContent>
      </Card>
      {modalNode}
    </>
  )
}
