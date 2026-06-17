import { useState } from "react"
import { useMagicContext } from "../contexts/magicContext"
import { SpellCreatorModule } from "../features/magic/spellCreator/spellCreatorModule"
import { SpellSearchModule } from "../features/magic/spellSearch/spellSearchModule"
import { Button } from "../components/ui/Button"
import type { Spell } from "../models/magic/spells/Spell"

export function MagicView() {
  const { saveSpell } = useMagicContext()
  const [isCreatorOpen, setIsCreatorOpen] = useState(false)
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null)

  function openCreateSpell() {
    setEditingSpell(null)
    setIsCreatorOpen(true)
  }

  function openEditSpell(spell: Spell) {
    setEditingSpell(spell)
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

              <Button variant="secondary" size="sm" onClick={closeModal}>
                Fechar
              </Button>
            </div>

            <div className="p-4">
              <SpellCreatorModule
                editingSpell={editingSpell}
                saveSpell={(spell) => {
                  saveSpell(spell)
                  closeModal()
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Button
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full text-2xl shadow-xl"
        onClick={openCreateSpell}
      >
        +
      </Button>
    </div>
  )
}