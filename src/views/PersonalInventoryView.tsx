import type { Character } from '../models/types'
import { CharacterSelector } from '../features/characters/characterSelector'
import { InventoryEditor } from '../features/inventory/InventoryEditor'
import { newInventoryItem } from '../lib/inventory'

type Props = {
  characters: Character[]
  activeCharacter: Character
  setActiveCharacterId: (id: string) => void
  addCharacter: () => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
  canEditInventory: boolean
  updateCharacter: (characterId: string, updater: (c: Character) => Character) => void
}

export function PersonalInventoryView({
  characters,
  activeCharacter,
  setActiveCharacterId,
  addCharacter,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
  canEditInventory,
  updateCharacter,
}: Props) {
  const items = activeCharacter.personalInventory ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <CharacterSelector
        characters={characters}
        activeCharacter={activeCharacter}
        addCharacter={addCharacter}
        setActiveCharacterId={setActiveCharacterId}
        deleteActiveCharacter={deleteActiveCharacter}
        disableDelete={disableDelete}
        showOwnerBadge={showOwnerBadge}
      />

      <InventoryEditor
        title={`Inventário pessoal: ${activeCharacter.name}`}
        description="Itens e recursos vinculados ao personagem ativo."
        items={items}
        canEdit={canEditInventory}
        emptyMessage="Nenhum item no inventário pessoal."
        onAddItem={() =>
          updateCharacter(activeCharacter.id, (current) => ({
            ...current,
            personalInventory: [...(current.personalInventory ?? []), newInventoryItem()],
          }))
        }
        onUpdateItem={(itemId, updater) =>
          updateCharacter(activeCharacter.id, (current) => ({
            ...current,
            personalInventory: (current.personalInventory ?? []).map((item) =>
              item.id === itemId ? updater(item) : item,
            ),
          }))
        }
        onRemoveItem={(itemId) =>
          updateCharacter(activeCharacter.id, (current) => ({
            ...current,
            personalInventory: (current.personalInventory ?? []).filter((item) => item.id !== itemId),
          }))
        }
      />
    </div>
  )
}