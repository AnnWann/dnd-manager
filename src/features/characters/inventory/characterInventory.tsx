import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { consumeCharacterInventoryItem } from "../../../models/characters/characterConsumables"
import { getEncumbranceInfo } from "../../../models/characters/characterEncumbrance"
import { equipInventoryItemWithRules } from "../../../models/characters/characterEquipmentInteractions"
import { equipInventoryStackWithRules } from "../../../models/characters/characterInventoryStacks"
import { toggleInventoryItemAttunement } from "../../../models/characters/characterInventory"
import {
  BAG_OF_HOLDING_CAPACITY_KG,
  getBagOfHoldingWeightKg,
} from "../../../models/items/bagOfHolding"
import {
  areAllCurrenciesInBagOfHolding,
  setCurrenciesInsideBagOfHolding,
} from "../../../models/items/Currency"
import {
  isBagOfHoldingItem,
  type Itemmable,
} from "../../../models/items/item"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { CharacterEncumbrancePanel } from "./characterEncumbrancePanel"
import { EquipItemDialog } from "./equipItemDialog"
import { InventoryEditor } from "./inventoryEditor"
import { TransferItemDialog } from "./transferItemDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const BAG_CAPACITY_EPSILON = 0.000001

export function newInventoryItem(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "",
    desc: "",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: false,
    kind: "common",
    magicItem: false,
    requiresAttunement: false,
    attuned: false,
  }
}

export function CharacterInventoryTab({
  character,
  updateCharacter,
}: Props) {
  const navigate = useNavigate()
  const runtime = useOptionalSessionRuntime()
  const {
    mode,
    transferCharacters = [],
    transferItem,
    canTransferFromCharacter,
    canViewCharacterDetails,
  } = useCharacterWorkspace()

  const [transferringItem, setTransferringItem] = useState<Itemmable | null>(null)
  const [equippingItem, setEquippingItem] = useState<Itemmable | null>(null)
  const [bagLimitMessage, setBagLimitMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const characterId = character.get("id")
  const items = character.get("inventory") ?? []
  const hasBagOfHolding = items.some(isBagOfHoldingItem)
  const normalizedSearchQuery = normalizeSearchText(searchQuery)
  const visibleItems = normalizedSearchQuery
    ? items.filter((item) => normalizeSearchText(item.name || "Item sem nome").includes(normalizedSearchQuery))
    : items
  const encumbrance = getEncumbranceInfo(character)
  const canTransfer = Boolean(transferItem && canTransferFromCharacter?.(characterId))
  const bagWeight = hasBagOfHolding ? getBagOfHoldingWeightKg(items) : 0
  const hasCurrency = items.some((item) => item.kind === "currency" && (item.quantity ?? 0) > 0)
  const currenciesInsideBagOfHolding = hasBagOfHolding && areAllCurrenciesInBagOfHolding(items)
  const attunedItemIds = items.filter((item) => item.attuned === true).map((item) => item.id)
  const authoritative = mode === "campaign" && Boolean(runtime)

  function wouldExceedBagCapacity(candidateItems: Itemmable[]): boolean {
    if (!hasBagOfHolding) return false
    const currentWeight = getBagOfHoldingWeightKg(items)
    const candidateWeight = getBagOfHoldingWeightKg(candidateItems)
    if (candidateWeight <= BAG_OF_HOLDING_CAPACITY_KG + BAG_CAPACITY_EPSILON) return false
    if (candidateWeight <= currentWeight + BAG_CAPACITY_EPSILON) return false
    const excess = candidateWeight - BAG_OF_HOLDING_CAPACITY_KG
    setBagLimitMessage(
      `A Bolsa Mágica suporta no máximo ${formatKg(BAG_OF_HOLDING_CAPACITY_KG)}. ` +
        `Essa ação deixaria a bolsa com ${formatKg(candidateWeight)}, excedendo o limite em ${formatKg(excess)}.`,
    )
    return true
  }

  function addCompendiumItem(item: Itemmable) {
    if (wouldExceedBagCapacity([...items, item])) return
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.item.add", characterId, item })
      return
    }
    updateCharacter(characterId, (current) => current.addInventoryItem(item))
  }

  function updateItem(itemId: string, updater: (item: Itemmable) => Itemmable) {
    const currentItem = items.find((item) => item.id === itemId)
    if (!currentItem) return
    const updated = updater(currentItem)
    const candidateItems = items.map((item) => item.id === itemId ? updated : item)
    if (wouldExceedBagCapacity(candidateItems)) return
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.item.update", characterId, itemId, item: updated })
      return
    }
    updateCharacter(characterId, (current) => current.updateInventoryItem(itemId, updater))
  }

  function removeItem(itemId: string) {
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.item.remove", characterId, itemId })
      return
    }
    const removedItem = items.find((item) => item.id === itemId)
    updateCharacter(characterId, (current) => {
      let next = current.removeInventoryItem(itemId)
      if (removedItem && isBagOfHoldingItem(removedItem)) {
        next = next.with("inventory", (next.get("inventory") ?? []).map((item) => ({ ...item, insideBagOfHolding: false })))
      }
      return next
    })
  }

  function consumeItem(itemId: string) {
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.item.consume", characterId, itemId })
      return
    }
    updateCharacter(characterId, (current) => consumeCharacterInventoryItem(current, itemId))
  }

  function toggleBagOfHolding(itemId: string) {
    if (!hasBagOfHolding) return
    const target = items.find((item) => item.id === itemId)
    if (!target || isBagOfHoldingItem(target)) return
    const candidateItems = items.map((item) => item.id === itemId ? { ...item, insideBagOfHolding: !item.insideBagOfHolding } : item)
    if (wouldExceedBagCapacity(candidateItems)) return
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.bag.toggle", characterId, itemId })
      return
    }
    updateCharacter(characterId, (current) => current.toggleInventoryItemBagOfHolding(itemId))
  }

  function setAllCurrenciesBagOfHolding(insideBagOfHolding: boolean) {
    if (!hasBagOfHolding) return
    const candidateItems = setCurrenciesInsideBagOfHolding(items, insideBagOfHolding)
    if (wouldExceedBagCapacity(candidateItems)) return
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.currenciesBag.set", characterId, insideBagOfHolding })
      return
    }
    updateCharacter(characterId, (current) => current.with("inventory", setCurrenciesInsideBagOfHolding(current.get("inventory") ?? [], insideBagOfHolding)))
  }

  function toggleAttunement(itemId: string) {
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.attunement.toggle", characterId, itemId })
      return
    }
    updateCharacter(characterId, (current) => toggleInventoryItemAttunement(current, itemId))
  }

  function equipItem(destination: Parameters<typeof equipInventoryItemWithRules>[2]) {
    if (!equippingItem || !destination) return
    if (authoritative) {
      runtime?.dispatchInventoryOperation({ type: "character.inventory.item.equip", characterId, itemId: equippingItem.id, destination })
      return
    }
    updateCharacter(characterId, (current) => {
      const stackedResult = equipInventoryStackWithRules(current, equippingItem.id, destination)
      return stackedResult ?? equipInventoryItemWithRules(current, equippingItem.id, destination)
    })
  }

  return (
    <>
      <div className="mb-4 grid gap-4">
        <CharacterEncumbrancePanel character={character} />
        {hasBagOfHolding ? <BagOfHoldingCounter weight={bagWeight} /> : null}
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="grid flex-1 gap-1 text-[11px] text-textMuted">
          Buscar item
          <Input value={searchQuery} placeholder="Digite o nome do item" aria-label="Buscar item pelo nome" onChange={(event) => setSearchQuery(event.target.value)} />
        </label>

        {mode === "user" ? (
          <Button onClick={() => navigate(`/user/characters/${encodeURIComponent(characterId)}/inventory/add-item`)}>
            Criar item
          </Button>
        ) : null}
      </div>

      <InventoryEditor
        title={`Inventário pessoal: ${character.get("name")}`}
        description={`Peso carregado: ${formatKg(encumbrance.weight)} de ${formatKg(encumbrance.carryingCapacity)}.`}
        items={visibleItems}
        emptyMessage={normalizedSearchQuery ? "Nenhum item corresponde à busca." : "Nenhum item encontrado."}
        onAddCompendiumItem={mode === "campaign" ? addCompendiumItem : undefined}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onConsumeItem={consumeItem}
        onEquipItem={(itemId) => setEquippingItem(items.find((item) => item.id === itemId) ?? null)}
        onToggleBagOfHolding={hasBagOfHolding ? toggleBagOfHolding : undefined}
        onMoveAllCurrenciesToBagOfHolding={hasBagOfHolding && hasCurrency ? () => setAllCurrenciesBagOfHolding(!currenciesInsideBagOfHolding) : undefined}
        onToggleAttunement={toggleAttunement}
        attunedItemIds={attunedItemIds}
        onTransferItem={canTransfer ? setTransferringItem : undefined}
      />

      <EquipItemDialog
        open={equippingItem !== null}
        character={character}
        item={equippingItem}
        onClose={() => setEquippingItem(null)}
        onEquip={equipItem}
      />

      {transferItem && canViewCharacterDetails ? (
        <TransferItemDialog
          open={transferringItem !== null}
          item={transferringItem}
          from={{ type: "character", characterId }}
          characters={transferCharacters}
          canViewCharacterDetails={canViewCharacterDetails}
          onClose={() => setTransferringItem(null)}
          onTransfer={transferItem}
        />
      ) : null}

      <BagOfHoldingLimitPopup message={bagLimitMessage} onClose={() => setBagLimitMessage(null)} />
    </>
  )
}

function BagOfHoldingCounter({ weight }: { weight: number }) {
  const remaining = Math.max(0, BAG_OF_HOLDING_CAPACITY_KG - weight)
  const percentage = Math.min(100, Math.max(0, (weight / BAG_OF_HOLDING_CAPACITY_KG) * 100))
  const isFull = weight >= BAG_OF_HOLDING_CAPACITY_KG - BAG_CAPACITY_EPSILON
  const isOverCapacity = weight > BAG_OF_HOLDING_CAPACITY_KG + BAG_CAPACITY_EPSILON
  return (
    <section className={["rounded-xl border bg-bg p-3 shadow-theme-sm", isOverCapacity ? "border-danger" : "border-border"].join(" ")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-sm font-semibold text-textH">Bolsa Mágica</div><div className="mt-1 text-xs leading-5 text-text">Capacidade RAW: {formatKg(BAG_OF_HOLDING_CAPACITY_KG)}.</div></div>
        <div className="text-left text-xs sm:text-right">
          <div className={isOverCapacity ? "font-semibold text-danger" : "font-semibold text-textH"}>{formatKg(weight)} / {formatKg(BAG_OF_HOLDING_CAPACITY_KG)}</div>
          <div className="mt-1 text-textMuted">{isOverCapacity ? `Excedeu em ${formatKg(weight - BAG_OF_HOLDING_CAPACITY_KG)}` : isFull ? "Bolsa cheia" : `Restam ${formatKg(remaining)}`}</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-subtle"><div className={["h-full rounded-full transition-[width]", isOverCapacity ? "bg-danger" : "bg-accent"].join(" ")} style={{ width: `${percentage}%` }} /></div>
    </section>
  )
}

function BagOfHoldingLimitPopup({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null
  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <div className="text-sm font-semibold text-textH">Bolsa Mágica cheia</div>
        <p className="mt-2 text-sm leading-6 text-text">{message}</p>
        <div className="mt-4 flex justify-end"><Button size="sm" variant="secondary" onClick={onClose}>Entendi</Button></div>
      </div>
    </div>
  )
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
}

function formatKg(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`
}
