from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


# Make currency stacks follow the same general hand-equipment flow and hide
# editing controls in read-only inventories such as the player ground view.
path = Path("src/features/characters/inventory/inventoryEditorV2.tsx")
text = path.read_text()
text = replace_once(
    text,
    '''          onTransferItem={onTransferItem}
          transferLabel={transferLabel}
          onEditItem={setEditingItem}''',
    '''          onTransferItem={onTransferItem}
          onEquipItem={onEquipItem}
          transferLabel={transferLabel}
          onEditItem={setEditingItem}''',
    "currency wallet equip callback",
)

currency_wallet = '''function CurrencyWallet({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onTransferItem,
  onEquipItem,
  transferLabel,
  onEditItem,
}: {
  items: Itemmable[]
  onAddItem?: (item: Itemmable) => void
  onUpdateItem?: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem?: (itemId: string) => void
  onTransferItem?: (item: Itemmable) => void
  onEquipItem?: (itemId: string) => void
  transferLabel: string
  onEditItem: (item: Itemmable) => void
}) {
  return (
    <div className="mb-4 rounded-xl border border-accentBorder bg-accentBg p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-textH">Moedas</div>
          <div className="mt-1 text-xs leading-5 text-textMuted">
            Valores monetários ficam separados do restante dos itens.
          </div>
        </div>
        {onAddItem ? (
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="secondary"
            onClick={() => onAddItem(newCurrencyItem())}
          >
            + Moeda
          </Button>
        ) : null}
      </div>

      {items.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-bg p-3"
            >
              <div className="truncate text-sm font-medium text-textH">
                {item.name || "Moedas"}
              </div>
              <label className="mt-2 grid gap-1.5">
                <span className="text-[11px] text-textMuted">Quantidade</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!onUpdateItem}
                  value={item.quantity ?? 0}
                  onChange={(event) =>
                    onUpdateItem?.(item.id, (current) => ({
                      ...current,
                      quantity: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {onUpdateItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEditItem(item)}
                  >
                    Editar
                  </Button>
                ) : null}
                {onEquipItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEquipItem(item.id)}
                  >
                    Equipar
                  </Button>
                ) : null}
                {onTransferItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onTransferItem(item)}
                  >
                    {transferLabel}
                  </Button>
                ) : null}
                {onRemoveItem ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}'''
text, count = re.subn(
    r'function CurrencyWallet\(\{.*?\n\}\n\n(?=function newCurrencyItem)',
    lambda _match: currency_wallet + "\n\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"currency wallet block matched {count} times")
path.write_text(text)


# The special occupied-hands proficiency has its own card and should not be
# repeated in the generic Other category.
path = Path("src/features/characters/proficiencies/characterProficiencies.tsx")
text = path.read_text()
text = replace_once(
    text,
    '''  const characterProficiencies = toManagedProficiencies(
    character.get("sheet").proficiencies ?? [],
  )
  const racialProficiencies = toManagedProficiencies(
    character.get("sheet").race.proficiencies ?? [],
  )''',
    '''  const characterProficiencies = toManagedProficiencies(
    character.get("sheet").proficiencies ?? [],
  ).filter(
    (proficiency) =>
      proficiency.id !== OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
  )
  const racialProficiencies = toManagedProficiencies(
    character.get("sheet").race.proficiencies ?? [],
  ).filter(
    (proficiency) =>
      proficiency.id !== OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
  )''',
    "hide special proficiency from generic groups",
)
path.write_text(text)
