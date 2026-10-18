import type { EquippedItemDestination, EquippedItemReference } from "../../models/characters/characterEquippedItemMovement"

import type {
  SessionEquipmentOperation as SharedSessionEquipmentOperation,
  SessionEquipmentClientMessage as SharedSessionEquipmentClientMessage,
} from "../../../../../packages/session-protocol/src/equipmentOperations"

export type SessionEquipmentOperation = SharedSessionEquipmentOperation<EquippedItemReference, EquippedItemDestination>
export type SessionEquipmentClientMessage = SharedSessionEquipmentClientMessage<EquippedItemReference, EquippedItemDestination>
