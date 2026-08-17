import { useState } from "react"
import { useMagicContext } from "../contexts/magicContext"
import { SpellCreatorModule } from "../features/magic/spellCreator/spellCreatorModule"
import { SpellSearchModule } from "../features/magic/spellSearch/spellSearchModule"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import type { Spell, SpellResourceType } from "../models/magic/spells/Spell"
import { SPELL_RESOURCE_OPTIONS } from "../models/magic/spells/spellResourceCost"

export function MagicView() {
  const { saveSpell } = useMagicContext()
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null)
  const [resourceType, setResourceType] = useState<SpellResourceType | "slot">("slot")
  const [resourceAmount, setResourceAmount] = useState(1)

  function openCreateSpell() {
    setEditingSpell(null)
    setResourceType("slot")
    setResourceAmount(1)
    setIsCreatorOpen(true)
  }

  function openEditSpell(spell: Spell) {
    setEditingSpell(spell)
    setResourceType(spell.resourceCost?.resource ?? "slot")
    setResourceAmount(Math.max(1, Math.trunc(spell.resourceCost?.amount ?? 1)))
    setIsCreatorOpen(true)
  }

  function closeModal() {
    setEditingSpell(null)
    setIsCreatorOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SpellSearchModule onEditSpell={openEditSpell} />

      {isCreatorOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-accentBorder p-4">
              <h2 className="font-heading text-lg text-textH">
                {editingSpell ? "Editar Magia" : "Criar Magia"}
              </h2>
              <Button variant="secondary" size="sm" onClick={closeModal}>Fechar</Button>
            </div>

            <div className="grid gap-3 p-4">
              <div className="rounded-xl border border-accentBorder bg-bg p-3">
                <div className="text-xs font-semibold text-textH">Recurso de conjuração</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
                  <label className="grid gap-1 text-xs text-text">
                    Recurso
                    <select
                      className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                      value={resourceType}
                      onChange={(event) => setResourceType(event.target.value as SpellResourceType | "slot")}
                    >
                      <option value="slot">Espaço de magia (padrão)</option>
                      {SPELL_RESOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {resourceType !== "slot" ? (
                    <label className="grid gap-1 text-xs text-text">
                      Custo
                      <Input type="number" min={1} value={resourceAmount} onChange={(event) => setResourceAmount(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />
                    </label>
                  ) : null}
                </div>
                {resourceType !== "slot" ? (
                  <p className="mt-2 text-[11px] text-textMuted">Esse recurso substitui o gasto de espaço de magia ao usar a magia.</p>
                ) : null}
              </div>

              <SpellCreatorModule
                editingSpell={editingSpell}
                saveSpell={(spell) => {
                  saveSpell({
                    ...spell,
                    resourceCost: resourceType === "slot" ? undefined : { resource: resourceType, amount: resourceAmount },
                  })
                  closeModal()
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Button className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full text-2xl shadow-xl" onClick={openCreateSpell}>+</Button>
    </div>
  )
}