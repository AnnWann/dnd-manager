import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import type { InventoryItem } from '../../models/types'

type Props = {
  title: string
  description: string
  items: InventoryItem[]
  canEdit: boolean
  emptyMessage: string
  onAddItem: () => void
  onUpdateItem: (itemId: string, updater: (item: InventoryItem) => InventoryItem) => void
  onRemoveItem: (itemId: string) => void
}

export function InventoryEditor({
  title,
  description,
  items,
  canEdit,
  emptyMessage,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">{title}</div>
            <div className="mt-1 text-xs text-text">{description}</div>
          </div>
          {canEdit ? (
            <Button size="sm" variant="primary" onClick={onAddItem}>
              + Adicionar
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-[color:var(--social-bg)] p-3">
                {canEdit ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_110px]">
                    <div className="grid gap-2">
                      <label className="text-xs text-text">Item</label>
                      <Input
                        value={item.name}
                        onChange={(e) => onUpdateItem(item.id, (current) => ({ ...current, name: e.target.value }))}
                        placeholder="Nome do item"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-text">Qtd.</label>
                      <Input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateItem(item.id, (current) => ({ ...current, quantity: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <label className="text-xs text-text">Notas</label>
                      <Textarea
                        rows={2}
                        value={item.notes ?? ''}
                        onChange={(e) => onUpdateItem(item.id, (current) => ({ ...current, notes: e.target.value }))}
                        placeholder="Detalhes, condições, localização..."
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => onRemoveItem(item.id)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-text">
                    <div className="font-medium text-textH">{item.name || 'Item sem nome'}</div>
                    <div>Qtd.: {item.quantity}</div>
                    <div className="whitespace-pre-wrap">{item.notes?.trim() || 'Sem notas'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  )
}