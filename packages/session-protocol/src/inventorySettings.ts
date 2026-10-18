/** Shared session-level inventory controls. These operations have identical wire shapes in both runtimes. */
export type InventorySettingsOperation =
  | { type: "party.settings.carryCapacity.set"; characterId: "session"; value: number }
  | { type: "party.settings.additionalSupplyConsumption.set"; characterId: "session"; value: number }
  | { type: "party.settings.accessible.set"; characterId: "session"; value: boolean }
