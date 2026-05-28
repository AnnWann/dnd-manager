import type { InventoryItem } from '../types'
import { InventoryEditor } from '../features/inventory/InventoryEditor'
import { newInventoryItem } from '../lib/inventory'

type Props = {
  items: InventoryItem[]
  canEditInventory: boolean
  updateItems: (updater: (items: InventoryItem[]) => InventoryItem[]) => void
}

export function CampInventoryView({ items, canEditInventory, updateItems }: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <InventoryEditor
        title="Inventário do acampamento"
        description="Recursos e itens compartilhados pela mesa."
        items={items}
        canEdit={canEditInventory}
        emptyMessage="Nenhum item compartilhado no acampamento."
        onAddItem={() => updateItems((current) => [...current, newInventoryItem()])}
        onUpdateItem={(itemId, updater) =>
          updateItems((current) => current.map((item) => (item.id === itemId ? updater(item) : item)))
        }
        onRemoveItem={(itemId) => updateItems((current) => current.filter((item) => item.id !== itemId))}
      />
    </div>
  )
}