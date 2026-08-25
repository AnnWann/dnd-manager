import { Navigate, useNavigate, useParams } from "react-router-dom"

import { ItemCreationWizard } from "../../features/characters/inventory/ItemCreationWizard"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"
import type { Itemmable } from "../../models/items/item"

export function UserCharacterCreateItemView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <UserCharacterWorkspace characterId={characterId}>
      <UserCharacterCreateItemContent characterId={characterId} />
    </UserCharacterWorkspace>
  )
}

function UserCharacterCreateItemContent({
  characterId,
}: {
  characterId: string
}) {
  const navigate = useNavigate()
  const {
    characters,
    isEditing,
    updateCharacter,
    saveCharacter,
  } = useCharacterWorkspace()
  const character = characters.find(
    (entry) => entry.get("id") === characterId,
  )
  const inventoryPath =
    `/user/characters/${encodeURIComponent(characterId)}/inventory`

  if (!character) {
    return <Navigate to="/not-found" replace />
  }

  if (!isEditing) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-textMuted">
        Ative o modo de edição acima para criar um item para este personagem.
      </div>
    )
  }

  async function addItem(item: Itemmable) {
    updateCharacter(characterId, (current) =>
      current.addInventoryItem(item),
    )
    const saved = await saveCharacter?.()
    if (saved) navigate(inventoryPath)
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <ItemCreationWizard
        onCancel={() => navigate(inventoryPath)}
        onCreate={(item) => void addItem(item)}
      />
    </div>
  )
}
