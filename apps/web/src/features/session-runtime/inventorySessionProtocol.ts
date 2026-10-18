import type { SessionInventoryOperation as SharedInventoryOperation } from "../../../../../packages/session-protocol/src/inventoryOperations"
import type { InventorySettingsOperation } from "../../../../../packages/session-protocol/src/inventorySettings"
import type { EquipmentDestination } from "../../models/characters/characterEquipmentInteractions"
import type { EquippedItemReference } from "../../models/characters/characterEquippedItemMovement"
import type { TransferItemOperationRequest } from "../../models/game/GameOperation"
import type { Itemmable } from "../../models/items/item"

/**
 * Privacy-safe projection of a character that contributes to the shared
 * supply budget. Individual race/consumption details remain in the character
 * snapshot and are therefore visible only to clients that may read that
 * character. The aggregate consumption is authoritative for every client.
 */
export type SessionSupplyConsumerSummary = {
  characterId: string
  name: string
}

export type PendingConditionalLoot = {
  id: string
  creatureName: string
  item: Itemmable
  dmHint?: string
}

export type SessionSharedInventoryState = {
  initialized: boolean
  revision: number
  partyInventory: Itemmable[]
  groundInventory: Itemmable[]
  /** DM-only decisions waiting to be resolved. Server delivery filters this for players. */
  pendingConditionalLoot?: PendingConditionalLoot[]
  carryCapacity?: number
  additionalSupplyConsumption?: number
  /** Whether players can access the shared party inventory. Defaults to true. */
  partyInventoryAccessible?: boolean
  /** Active session consumers, calculated from unfiltered authoritative state. */
  supplyConsumers?: SessionSupplyConsumerSummary[]
  /** Legacy aggregate retained for compatibility; mirrors food consumption. */
  supplyPerLongRest?: number
  /** Raw racial food portions consumed by active characters per long rest. */
  foodPerLongRest?: number
  /** Raw racial drink portions consumed by active characters per long rest. */
  drinkPerLongRest?: number
}

export type SessionInventoryOperation = SharedInventoryOperation<Itemmable, EquipmentDestination, TransferItemOperationRequest, EquippedItemReference>

export type SessionInventoryClientMessage =
  | {
      type: "session.inventory.initialize"
      partyInventory: Itemmable[]
      groundInventory: Itemmable[]
      carryCapacity?: number
      additionalSupplyConsumption?: number
      partyInventoryAccessible?: boolean
    }
  | { type: "session.inventory.operation"; operation: SessionInventoryOperation }

export type SessionInventoryServerMessage =
  | { type: "session.inventory.snapshot"; state: SessionSharedInventoryState }
  | { type: "session.inventory.updated"; state: SessionSharedInventoryState }
