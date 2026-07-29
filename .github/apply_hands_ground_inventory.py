from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


def replace_regex(
    text: str,
    pattern: str,
    replacement: str,
    label: str,
    flags: int = 0,
) -> str:
    updated, count = re.subn(
        pattern,
        lambda _match: replacement,
        text,
        count=1,
        flags=flags,
    )
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# ---------------------------------------------------------------------------
# Character defaults and equipment persistence.
# ---------------------------------------------------------------------------
path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '''      equipment: props.equipment ?? {
        rings: [],
        weapons: [],
        pockets: [],
      },''',
    '''      equipment: {
        ...(props.equipment ?? {}),
        rings: props.equipment?.rings ?? [],
        weapons: props.equipment?.weapons ?? [],
        heldItems: props.equipment?.heldItems ?? [],
        pockets: props.equipment?.pockets ?? [],
      },''',
    "character equipment normalization",
)
text = text.replace(
    '"weapons" | "rings" | "pockets"',
    '"weapons" | "rings" | "pockets" | "heldItems"',
)
write(path, text)

path = "src/lib/newCharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '''      rings: [],
      weapons: [],
      pockets: [],''',
    '''      rings: [],
      weapons: [],
      heldItems: [],
      pockets: [],''',
    "new character held items",
)
write(path, text)


# ---------------------------------------------------------------------------
# Attack calculations and active held focus equipment.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Weapon } from "../items/equipment/Weapon"',
    '''import {
  getWeaponAttackAttribute,
  isWeaponImprovisedGrip,
  type Weapon,
} from "../items/equipment/Weapon"''',
    "character stats weapon helpers",
)
text = replace_once(
    text,
    '''    ...equipment.rings,
    ...equipment.weapons,
    ...equipment.pockets.filter(''',
    '''    ...equipment.rings,
    ...equipment.weapons,
    ...(equipment.heldItems ?? []).filter(
      (item): item is Equipment => item.kind === "focus",
    ),
    ...equipment.pockets.filter(''',
    "held focus active equipment",
)
text = replace_regex(
    text,
    r'export function getEffectiveWeaponAttackBonus\(.*?\n\}\n\nexport function getEffectiveWeaponDamageBonus\(.*?\n\}',
    '''export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  if (isWeaponImprovisedGrip(weapon)) {
    return getEffectiveAttackBonus(
      character,
      getEffectiveAttributeModifier(character, "str"),
    )
  }

  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined
  const modifierAttribute = getWeaponAttackAttribute(weapon)

  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...getScopedCharacterBonuses(
      character,
      "weaponAttackBonus",
      modifierAttribute,
    ),
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}

export function getEffectiveWeaponDamageBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  if (isWeaponImprovisedGrip(weapon)) {
    return getEffectiveAttributeModifier(character, "str")
  }

  const weaponDamageBonus = weapon.bonuses?.damage?.bonus
    ? resolveBonus(character, weapon.bonuses.damage.bonus)
    : undefined
  const weaponGeneralBonuses = (weapon.bonuses?.damageBonus ?? [])
    .map((bonus) => resolveBonus(character, bonus))
  const abilityBonuses = getAbilityBonuses(character, "damageBonus")

  return applyBonuses(baseValue, [
    ...weaponGeneralBonuses,
    ...abilityBonuses,
    ...(weaponDamageBonus ? [weaponDamageBonus] : []),
  ])
}''',
    "improvised weapon calculations",
    re.S,
)
write(path, text)


# ---------------------------------------------------------------------------
# Character equipment accounting and active held focuses.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterEquipment.ts"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "./CharacterTemplate"',
    'import type { CharacterTemplate } from "./CharacterTemplate"\nimport { getUsedHands } from "./characterHands"',
    "equipment hand helper import",
)
text = text.replace(
    '"weapons" | "rings" | "pockets"',
    '"weapons" | "rings" | "pockets" | "heldItems"',
)
text = replace_once(
    text,
    '''      : (weapon.twoHanded ?? false),''',
    '''      : (weapon.wieldedTwoHanded ?? weapon.twoHanded ?? false),''',
    "weapon grip preservation",
)
text = replace_once(
    text,
    '''  const pocketsWeight = equipment.pockets.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const equipmentWeight =''',
    '''  const pocketsWeight = equipment.pockets.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const heldItemsWeight = (equipment.heldItems ?? []).reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const equipmentWeight =''',
    "held item weight",
)
text = replace_once(
    text,
    '''    weaponsWeight +
    pocketsWeight''',
    '''    weaponsWeight +
    heldItemsWeight +
    pocketsWeight''',
    "held item weight total",
)
text = replace_regex(
    text,
    r'export function getUsedArms\(character: CharacterTemplate\): number \{.*?\n\}',
    '''export function getUsedArms(character: CharacterTemplate): number {
  return getUsedHands(character)
}''',
    "used arms calculation",
    re.S,
)
text = replace_once(
    text,
    '''    ...equipment.rings,
    ...equipment.weapons,
    ...equipment.pockets.filter((item) => item.kind === "equipment"),''',
    '''    ...equipment.rings,
    ...equipment.weapons,
    ...(equipment.heldItems ?? []).filter((item) => item.kind === "focus"),
    ...equipment.pockets.filter((item) => item.kind === "equipment"),''',
    "held focus equipment list",
)
text = replace_once(
    text,
    '''    weapons: equipment.weapons.map(updateItem),
    pockets: equipment.pockets.map(updateItem),''',
    '''    weapons: equipment.weapons.map(updateItem),
    heldItems: (equipment.heldItems ?? []).map(updateItem),
    pockets: equipment.pockets.map(updateItem),''',
    "update held equipment by id",
)
write(path, text)


# ---------------------------------------------------------------------------
# Shared state: ground inventory and transfer location.
# ---------------------------------------------------------------------------
path = "src/lib/remoteState.ts"
text = read(path)
text = replace_once(
    text,
    '  partyInventory?: Itemmable[]\n',
    '  partyInventory?: Itemmable[]\n  /** Shared items currently lying on the ground. */\n  groundInventory?: Itemmable[]\n',
    "ground inventory state field",
)
text = replace_once(
    text,
    '    partyInventory: [],\n    partyCarryCapacity: 0,',
    '    partyInventory: [],\n    groundInventory: [],\n    partyCarryCapacity: 0,',
    "ground inventory default",
)
write(path, text)

path = "src/lib/normalizeAppStateInventory.ts"
text = read(path)
text = replace_once(
    text,
    '''  const characters = state.characters.map((character) => {''',
    '''  const groundInventory = normalizeCollection(
    state.groundInventory ?? [],
    () => {
      changed = true
    },
  )

  const characters = state.characters.map((character) => {''',
    "normalize ground inventory",
)
text = replace_once(
    text,
    '''    characters,
    partyInventory,
  }''',
    '''    characters,
    partyInventory,
    groundInventory,
  }''',
    "return normalized ground inventory",
)
write(path, text)

path = "src/models/game/GameOperation.ts"
text = read(path)
text = replace_once(
    text,
    '''export type InventoryLocation =
  | { type: "party" }
  | { type: "character"; characterId: string }''',
    '''export type InventoryLocation =
  | { type: "party" }
  | { type: "ground" }
  | { type: "character"; characterId: string }''',
    "ground transfer location",
)
text = replace_once(
    text,
    '''  | {
      type: "inventory.item.transfer"
      request: TransferItemOperationRequest
    }''',
    '''  | {
      type: "ground.item.add"
      item: Itemmable
    }
  | {
      type: "ground.item.update"
      itemId: string
      item: Itemmable
    }
  | {
      type: "ground.item.remove"
      itemId: string
    }
  | {
      type: "inventory.item.transfer"
      request: TransferItemOperationRequest
    }''',
    "ground inventory operations",
)
text = replace_once(
    text,
    '''    operation.type === "party.item.add" ||
    operation.type === "party.item.update"''',
    '''    operation.type === "party.item.add" ||
    operation.type === "party.item.update" ||
    operation.type === "ground.item.add" ||
    operation.type === "ground.item.update"''',
    "bulky ground operations",
)
write(path, text)

path = "src/models/game/applyGameOperation.ts"
text = read(path)
text = replace_once(
    text,
    '''    case "inventory.item.transfer":
      return transferItem(state, operation.request, meta)''',
    '''    case "ground.item.add":
      return {
        ...state,
        groundInventory: [
          ...(state.groundInventory ?? []),
          touchItem(normalizeItemText(operation.item), meta),
        ],
      }

    case "ground.item.update":
      return {
        ...state,
        groundInventory: (state.groundInventory ?? []).map((item) =>
          item.id === operation.itemId
            ? touchItem(normalizeItemText(operation.item), meta)
            : item,
        ),
      }

    case "ground.item.remove":
      return {
        ...state,
        groundInventory: (state.groundInventory ?? []).filter(
          (item) => item.id !== operation.itemId,
        ),
      }

    case "inventory.item.transfer":
      return transferItem(state, operation.request, meta)''',
    "apply ground inventory operations",
)
text = replace_once(
    text,
    '''  const partyInventory = [...(state.partyInventory ?? [])]
  const inventoryByCharacterId = new Map(''',
    '''  const partyInventory = [...(state.partyInventory ?? [])]
  const groundInventory = [...(state.groundInventory ?? [])]
  const inventoryByCharacterId = new Map(''',
    "transfer ground inventory copy",
)
text = text.replace(
    '''    partyInventory,
    inventoryByCharacterId,
  )''',
    '''    partyInventory,
    groundInventory,
    inventoryByCharacterId,
  )''',
)
text = replace_once(
    text,
    '''    ...state,
    partyInventory,
    characters: state.characters.map''',
    '''    ...state,
    partyInventory,
    groundInventory,
    characters: state.characters.map''',
    "return transferred ground inventory",
)
text = replace_once(
    text,
    '''    case "inventory.item.transfer":
      return [''',
    '''    case "ground.item.add":
      return ["inventory:ground", `groundItem:${operation.item.id}`]
    case "ground.item.update":
    case "ground.item.remove":
      return ["inventory:ground", `groundItem:${operation.itemId}`]
    case "inventory.item.transfer":
      return [''',
    "ground entity keys",
)
text = replace_once(
    text,
    '''function locationKey(location: InventoryLocation): string {
  if (location.type === "party") return "party"
  return `character:${location.characterId}`
}''',
    '''function locationKey(location: InventoryLocation): string {
  if (location.type === "party") return "party"
  if (location.type === "ground") return "ground"
  return `character:${location.characterId}`
}''',
    "ground location key",
)
text = replace_once(
    text,
    '''function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  inventoryByCharacterId: Map<string, Itemmable[]>,
): Itemmable[] | undefined {
  if (location.type === "party") return partyInventory
  return inventoryByCharacterId.get(location.characterId)
}''',
    '''function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  groundInventory: Itemmable[],
  inventoryByCharacterId: Map<string, Itemmable[]>,
): Itemmable[] | undefined {
  if (location.type === "party") return partyInventory
  if (location.type === "ground") return groundInventory
  return inventoryByCharacterId.get(location.characterId)
}''',
    "ground inventory resolver",
)
write(path, text)


# ---------------------------------------------------------------------------
# Character context: ground actions and hand release actions.
# ---------------------------------------------------------------------------
path = "src/contexts/characterContext.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Itemmable } from "../models/items/item"',
    '''import type { Itemmable } from "../models/items/item"
import {
  removeHandOccupant,
  stowHandOccupant as stowCharacterHandOccupant,
  type HandOccupantReference,
} from "../models/characters/characterHands"''',
    "character context hand imports",
)
text = replace_once(
    text,
    '''  partyInventory: Itemmable[]
  operationLog: GameOperationRecord[]''',
    '''  partyInventory: Itemmable[]
  groundInventory: Itemmable[]
  operationLog: GameOperationRecord[]''',
    "context ground inventory value",
)
text = replace_once(
    text,
    '''  removePartyItem: (itemId: string) => void
  transferItem: (request: TransferItemRequest) => void''',
    '''  removePartyItem: (itemId: string) => void
  addGroundItem: (item: Itemmable) => void
  updateGroundItem: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  removeGroundItem: (itemId: string) => void
  stowHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  dropHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  transferItem: (request: TransferItemRequest) => void''',
    "context ground and hand methods",
)
text = replace_once(
    text,
    '''  function canTransferFromCharacter(characterId: string): boolean {''',
    '''  function addGroundItem(item: Itemmable) {
    dispatchGameOperation({ type: "ground.item.add", item })
  }

  function updateGroundItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    setAppState((previous) => {
      const item = (previous.groundInventory ?? []).find(
        (entry) => entry.id === itemId,
      )
      if (!item) return previous

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "ground.item.update",
            itemId,
            item: updater(item),
          },
          actorId,
        ),
      )
    })
  }

  function removeGroundItem(itemId: string) {
    dispatchGameOperation({ type: "ground.item.remove", itemId })
  }

  function stowHandOccupant(
    characterId: string,
    reference: HandOccupantReference,
  ) {
    updateCharacter(characterId, (current) =>
      stowCharacterHandOccupant(current, reference),
    )
  }

  function dropHandOccupant(
    characterId: string,
    reference: HandOccupantReference,
  ) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const removed = removeHandOccupant(
        CharacterTemplate.fromJSON(rawCharacter),
        reference,
      )
      if (!removed.item) return previous

      const withCharacter = applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.replace",
            characterId,
            character: removed.character.toJSON(),
          },
          actorId,
        ),
      )

      return applyRecordedGameOperation(
        withCharacter,
        createGameOperationRecord(
          {
            type: "ground.item.add",
            item: {
              ...removed.item,
              insideBagOfHolding: false,
            },
          },
          actorId,
        ),
      )
    })
  }

  function canTransferFromCharacter(characterId: string): boolean {''',
    "context ground and hand function bodies",
)
text = replace_once(
    text,
    '''        partyInventory: appState.partyInventory ?? [],
        operationLog: appState.operations ?? [],''',
    '''        partyInventory: appState.partyInventory ?? [],
        groundInventory: appState.groundInventory ?? [],
        operationLog: appState.operations ?? [],''',
    "context provider ground inventory",
)
text = replace_once(
    text,
    '''        removePartyItem,
        transferItem,''',
    '''        removePartyItem,
        addGroundItem,
        updateGroundItem,
        removeGroundItem,
        stowHandOccupant,
        dropHandOccupant,
        transferItem,''',
    "context provider methods",
)
text = replace_once(
    text,
    '''function locationKey(location: InventoryLocation): string {
  return location.type === "party"
    ? "party"
    : `character:${location.characterId}`
}''',
    '''function locationKey(location: InventoryLocation): string {
  if (location.type === "party") return "party"
  if (location.type === "ground") return "ground"
  return `character:${location.characterId}`
}''',
    "context ground location key",
)
write(path, text)


# ---------------------------------------------------------------------------
# Transfer dialog offers the ground as a destination.
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/transferItemDialog.tsx"
text = read(path)
text = replace_once(
    text,
    '''    if (from.type !== "party") {
      options.push({
        key: "party",
        label: "Inventário do grupo",
        location: { type: "party" },
      })
    }

    for (const character of characters) {''',
    '''    if (from.type !== "party") {
      options.push({
        key: "party",
        label: "Inventário do grupo",
        location: { type: "party" },
      })
    }

    if (from.type !== "ground") {
      options.push({
        key: "ground",
        label: "Inventário do chão",
        location: { type: "ground" },
      })
    }

    for (const character of characters) {''',
    "ground transfer destination",
)
write(path, text)


# ---------------------------------------------------------------------------
# General inventory equip flow and removal of the pocket shortcut.
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/characterInventory.tsx"
text = read(path)
text = replace_once(
    text,
    '''import {
  equipInventoryItemWithRules,
  pocketInventoryItemWithRules,
} from "../../../models/characters/characterEquipmentInteractions"''',
    '''import { equipInventoryItemWithRules } from "../../../models/characters/characterEquipmentInteractions"''',
    "inventory equipment interaction import",
)
text = replace_once(
    text,
    'import { InventoryEditor } from "./inventoryEditor"',
    'import { EquipItemDialog } from "./equipItemDialog"\nimport { InventoryEditor } from "./inventoryEditor"',
    "equip dialog import",
)
text = replace_once(
    text,
    '''  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)''',
    '''  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)
  const [equippingItem, setEquippingItem] = useState<Itemmable | null>(null)''',
    "equip dialog state",
)
text = replace_once(
    text,
    '''        onEquipItem={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            equipInventoryItemWithRules(current, itemId),
          )
        }
        onPocketItem={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            pocketInventoryItemWithRules(current, itemId),
          )
        }''',
    '''        onEquipItem={(itemId) =>
          setEquippingItem(items.find((item) => item.id === itemId) ?? null)
        }''',
    "general equip action",
)
text = replace_once(
    text,
    '''      <TransferItemDialog
        open={transferringItem !== null}''',
    '''      <EquipItemDialog
        open={equippingItem !== null}
        character={character}
        item={equippingItem}
        onClose={() => setEquippingItem(null)}
        onEquip={(destination) => {
          if (!equippingItem) return
          updateCharacter(character.get("id"), (current) =>
            equipInventoryItemWithRules(
              current,
              equippingItem.id,
              destination,
            ),
          )
        }}
      />

      <TransferItemDialog
        open={transferringItem !== null}''',
    "render equip dialog",
)
write(path, text)

path = "src/features/characters/inventory/inventoryEditorV2.tsx"
text = read(path)
text = text.replace(
    '''  onAddItem: (item: Itemmable) => void
  onUpdateItem: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem: (itemId: string) => void''',
    '''  onAddItem?: (item: Itemmable) => void
  onUpdateItem?: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  onRemoveItem?: (itemId: string) => void''',
)
text = text.replace('  onPocketItem?: (itemId: string) => void\n', '')
text = text.replace('  onPocketItem,\n', '')
text = replace_once(
    text,
    '''          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="primary"
            onClick={() => setCreatingItem(true)}
          >
            + Adicionar
          </Button>''',
    '''          {onAddItem ? (
            <Button
              className="w-full sm:w-auto"
              size="sm"
              variant="primary"
              onClick={() => setCreatingItem(true)}
            >
              + Adicionar
            </Button>
          ) : null}''',
    "optional inventory add button",
)
text = replace_once(
    text,
    '''                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingItem(item)}
                        >
                          Editar
                        </Button>''',
    '''                        {onUpdateItem ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingItem(item)}
                          >
                            Editar
                          </Button>
                        ) : null}''',
    "optional inventory edit button",
)
text = replace_regex(
    text,
    r'\n\s*\{canItemGoInPocket\(item\) && onPocketItem \? \(.*?\n\s*\) : null\}',
    '',
    "remove pocket action",
    re.S,
)
text = replace_once(
    text,
    '''                        {item.equippable && item.equipSlot && onEquipItem ? (''',
    '''                        {onEquipItem ? (''',
    "equip every item",
)
text = replace_once(
    text,
    '''                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          Remover
                        </Button>''',
    '''                        {onRemoveItem ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemoveItem(item.id)}
                          >
                            Remover
                          </Button>
                        ) : null}''',
    "optional inventory remove button",
)
text = replace_once(
    text,
    '''                      <ItemDropdownDetails
                        item={item}
                        onUpdate={(updater) => onUpdateItem(item.id, updater)}
                      />''',
    '''                      <ItemDropdownDetails
                        item={item}
                        onUpdate={
                          onUpdateItem
                            ? (updater) => onUpdateItem(item.id, updater)
                            : undefined
                        }
                      />''',
    "optional inventory detail updates",
)
text = replace_once(
    text,
    '''      <ItemEditPopup
        open={creatingItem}''',
    '''      {onAddItem ? (
      <ItemEditPopup
        open={creatingItem}''',
    "guard create popup start",
)
text = replace_once(
    text,
    '''        onSave={(item) => {
          onAddItem(normalizeItemText(item))
          setCreatingItem(false)
        }}
      />

      <ItemEditPopup
        open={editingItem !== null}''',
    '''        onSave={(item) => {
          onAddItem(normalizeItemText(item))
          setCreatingItem(false)
        }}
      />
      ) : null}

      {onUpdateItem ? (
      <ItemEditPopup
        open={editingItem !== null}''',
    "guard popups middle",
)
text = replace_once(
    text,
    '''          onUpdateItem(item.id, () => normalizeItemText(item))
          setEditingItem(null)
        }}
      />
    </Card>''',
    '''          onUpdateItem(item.id, () => normalizeItemText(item))
          setEditingItem(null)
        }}
      />
      ) : null}
    </Card>''',
    "guard edit popup end",
)
write(path, text)

path = "src/features/characters/inventory/itemDropdownDetails.tsx"
text = read(path)
text = replace_once(
    text,
    '''  onUpdate: (updater: (item: Itemmable) => Itemmable) => void''',
    '''  onUpdate?: (updater: (item: Itemmable) => Itemmable) => void''',
    "optional detail update type",
)
text = text.replace('    onUpdate((current) => {', '    onUpdate?.((current) => {')
text = text.replace(
    'const canConsume = usage && usage.reset !== "spellSlot"',
    'const canConsume = onUpdate && usage && usage.reset !== "spellSlot"',
)
text = text.replace(
    '''              const canRestore =
                usage &&''',
    '''              const canRestore =
                onUpdate &&
                usage &&''',
)
write(path, text)


# ---------------------------------------------------------------------------
# Character equipment tab and hand counts.
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/characterEquipment.tsx"
text = read(path)
text = replace_once(
    text,
    'import { EquipmentPocketsSection } from "./EquipmentPocketSection"',
    'import { EquipmentPocketsSection } from "./EquipmentPocketSection"\nimport { EquipmentHeldItemsSection } from "./EquipmentHeldItemsSection"',
    "held item section import",
)
text = replace_once(
    text,
    '          Itens equipados, escudo, armas, anéis, bolsos e sintonias.',
    '          Itens vestidos, empunhados, segurados, anéis, bolsos legados e sintonias.',
    "equipment description",
)
text = replace_once(
    text,
    '''        <EquipmentWeaponsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentRingsSection''',
    '''        <EquipmentWeaponsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentHeldItemsSection character={character} />

        <EquipmentRingsSection''',
    "render held items",
)
write(path, text)

path = "src/features/characters/equipment/EquipmentWeaponsSection.tsx"
text = read(path)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  getWeaponHandsUsed,
  isVersatileWeapon,
  type Weapon,''',
    '''  getWeaponAttackAttribute,
  getWeaponDamageDie,
  getWeaponHandsUsed,
  isVersatileWeapon,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "weapon section helper imports",
)
text = replace_once(
    text,
    'import { getUsedArmsIncludingShield } from "../../../models/characters/characterEquipmentInteractions"',
    '''import { getUsedArmsIncludingShield } from "../../../models/characters/characterEquipmentInteractions"
import { setWeaponGripWithRules } from "../../../models/characters/characterHands"''',
    "weapon grip rule import",
)
text = replace_once(
    text,
    '''  const modifierAttribute = weapon.modifierAttribute ?? "str"''',
    '''  const modifierAttribute = getWeaponAttackAttribute(weapon)''',
    "weapon attack attribute",
)
text = replace_once(
    text,
    '''  const proficiency = weapon.proficient
    ? character.getProficiencyBonus()
    : 0''',
    '''  const proficiency =
    weapon.proficient && !isWeaponImprovisedGrip(weapon)
      ? character.getProficiencyBonus()
      : 0''',
    "improvised weapon proficiency",
)
text = replace_once(
    text,
    '''  const modifierAttribute = weapon.modifierAttribute ?? "str"''',
    '''  const modifierAttribute = getWeaponAttackAttribute(weapon)''',
    "weapon damage attribute",
)
text = replace_regex(
    text,
    r'  function setWeaponGrip\(index: number, wieldedTwoHanded: boolean\) \{.*?\n  \}',
    '''  function setWeaponGrip(index: number, wieldedTwoHanded: boolean) {
    updateCharacter(character.get("id"), (current) =>
      setWeaponGripWithRules(current, index, wieldedTwoHanded),
    )
  }''',
    "central weapon grip setter",
    re.S,
)
text = replace_once(
    text,
    '''            const modifierAttribute = weapon.modifierAttribute ?? "str"''',
    '''            const modifierAttribute = getWeaponAttackAttribute(weapon)''',
    "weapon card attribute",
)
text = replace_once(
    text,
    '''            const versatile = isVersatileWeapon(weapon)
            const canUseTwoHands =''',
    '''            const versatile = isVersatileWeapon(weapon)
            const improvised = isWeaponImprovisedGrip(weapon)
            const supportsGripChoice = versatile || weapon.twoHanded === true
            const canUseTwoHands =''',
    "weapon grip card state",
)
text = replace_once(
    text,
    '''                        {versatile
                          ? `Versátil · ${handUsage} ${handUsage === 1 ? "mão" : "mãos"}`
                          : handUsage === 2
                            ? "Duas mãos"
                            : "Uma mão"}''',
    '''                        {improvised
                          ? "Improvisada · uma mão"
                          : versatile
                            ? `Versátil · ${handUsage} ${handUsage === 1 ? "mão" : "mãos"}`
                            : handUsage === 2
                              ? "Duas mãos"
                              : "Uma mão"}''',
    "weapon grip badge",
)
text = replace_once(
    text,
    '''                    {versatile ? (''',
    '''                    {supportsGripChoice ? (''',
    "show grip controls for two-handed weapon",
)
text = replace_once(
    text,
    '''                          Uma mão
                        </button>''',
    '''                          {weapon.twoHanded
                            ? "Uma mão — improvisada"
                            : "Uma mão"}
                        </button>''',
    "one hand weapon label",
)
write(path, text)

path = "src/features/characters/equipment/EquipmentPocketSection.tsx"
text = read(path)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  getWeaponHandsUsed,
  isVersatileWeapon,
  type Weapon,''',
    '''  getWeaponAttackAttribute,
  getWeaponDamageDie,
  getWeaponHandsUsed,
  isVersatileWeapon,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "pocket weapon helper imports",
)
text = replace_once(
    text,
    '''  const attribute = weapon.modifierAttribute ?? "str"''',
    '''  const attribute = getWeaponAttackAttribute(weapon)''',
    "pocket weapon attack attribute",
)
text = replace_once(
    text,
    '''  const proficiency = weapon.proficient
    ? character.getProficiencyBonus()
    : 0''',
    '''  const proficiency =
    weapon.proficient && !isWeaponImprovisedGrip(weapon)
      ? character.getProficiencyBonus()
      : 0''',
    "pocket improvised proficiency",
)
write(path, text)


# ---------------------------------------------------------------------------
# Character sheet attacks, damage and spellcasting hand warning.
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/attributeCalculators.tsx"
text = read(path)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  type Weapon,''',
    '''  getWeaponAttackAttribute,
  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "calculator weapon helpers",
)
text = replace_once(
    text,
    'import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"',
    'import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"\nimport { SpellcastingHandsWarning } from "./spellcastingHandsWarning"',
    "spellcasting warning import",
)
text = replace_once(
    text,
    '''    const attribute = weapon.modifierAttribute ?? "str"
    const proficiency = weapon.proficient ? proficiencyBonus : 0''',
    '''    const attribute = getWeaponAttackAttribute(weapon)
    const proficiency =
      weapon.proficient && !isWeaponImprovisedGrip(weapon)
        ? proficiencyBonus
        : 0''',
    "calculator improvised attack",
)
text = replace_once(
    text,
    '''    const attribute = weapon.modifierAttribute ?? "str"''',
    '''    const attribute = getWeaponAttackAttribute(weapon)''',
    "calculator improvised damage",
)
text = replace_once(
    text,
    '''      <div className="grid gap-4">
        <CalculatorGroup''',
    '''      <div className="grid gap-4">
        <SpellcastingHandsWarning character={character} />

        <CalculatorGroup''',
    "full sheet spellcasting warning",
)
text = replace_once(
    text,
    '''  const attribute = weapon.modifierAttribute ?? "str"''',
    '''  const attribute = getWeaponAttackAttribute(weapon)''',
    "weapon attack card attribute",
)
text = replace_once(
    text,
    '''          {weapon.name || "Arma sem nome"}
        </span>''',
    '''          {weapon.name || "Arma sem nome"}
          {isWeaponImprovisedGrip(weapon) ? " · improvisada" : ""}
        </span>''',
    "weapon card improvised label",
)
write(path, text)

path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  type Weapon,''',
    '''  getWeaponAttackAttribute,
  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "minimal weapon helpers",
)
text = replace_once(
    text,
    'import type { Attribute } from "../../../models/sheet/Attribute"',
    'import type { Attribute } from "../../../models/sheet/Attribute"\nimport { SpellcastingHandsWarning } from "./spellcastingHandsWarning"',
    "minimal warning import",
)
text = replace_once(
    text,
    '''                  const attribute = weapon.modifierAttribute ?? "str"
                  const baseAttack =
                    character.getEffectiveAttributeModifier(attribute) +
                    (weapon.proficient ? proficiency : 0)''',
    '''                  const attribute = getWeaponAttackAttribute(weapon)
                  const baseAttack =
                    character.getEffectiveAttributeModifier(attribute) +
                    (weapon.proficient && !isWeaponImprovisedGrip(weapon)
                      ? proficiency
                      : 0)''',
    "minimal improvised attack",
)
text = replace_once(
    text,
    '''        <div className="grid gap-3">
          <div>''',
    '''        <div className="grid gap-3">
          <SpellcastingHandsWarning character={character} />

          <div>''',
    "minimal spellcasting warning",
)
text = replace_once(
    text,
    '''        {weapon.name || "Arma"}
      </div>''',
    '''        {weapon.name || "Arma"}
        {isWeaponImprovisedGrip(weapon) ? " · imp." : ""}
      </div>''',
    "minimal improvised label",
)
write(path, text)


# ---------------------------------------------------------------------------
# Dedicated occupied-hands spellcasting proficiency control.
# ---------------------------------------------------------------------------
path = "src/features/characters/proficiencies/characterProficiencies.tsx"
text = read(path)
text = replace_once(
    text,
    'import { Plus, Search, Trash2, X } from "lucide-react"',
    'import { Hand, Plus, Search, Trash2, X } from "lucide-react"',
    "proficiency hand icon",
)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    '''import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
  OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  hasOccupiedHandsSpellcastingProficiency,
} from "../../../models/characters/characterHands"''',
    "spellcasting proficiency helpers",
)
text = replace_once(
    text,
    '''    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">''',
    '''    <div className="grid gap-4">
      <OccupiedHandsSpellcastingProficiency
        character={character}
        updateCharacter={updateCharacter}
      />

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">''',
    "render occupied hands proficiency",
)
special_component = '''
function OccupiedHandsSpellcastingProficiency({
  character,
  updateCharacter,
}: Props) {
  const ownProficiency = (character.get("sheet").proficiencies ?? []).find(
    (proficiency) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      proficiency.name === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )
  const racialProficiency = (
    character.get("sheet").race.proficiencies ?? []
  ).some(
    (proficiency) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      proficiency.name === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )
  const enabled = hasOccupiedHandsSpellcastingProficiency(character)

  function toggle() {
    if (racialProficiency) return

    updateCharacter(character.get("id"), (current) => {
      const proficiencies = current.get("sheet").proficiencies ?? []

      if (ownProficiency) {
        return current.withSheet(
          "proficiencies",
          proficiencies.filter(
            (proficiency) => proficiency.id !== ownProficiency.id,
          ),
        )
      }

      return current.withSheet("proficiencies", [
        ...proficiencies,
        {
          id: OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
          name: OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
          category: "other",
          notes:
            "Permite conjurar mesmo quando todas as mãos não ocupadas por focos arcanos estão preenchidas.",
        },
      ])
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-subtle text-accent">
            <Hand className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-textH">
              {OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME}
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Ignora o bloqueio de conjuração causado por todas as mãos estarem
              ocupadas. Focos arcanos já não contam como bloqueadores.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={enabled}
          disabled={racialProficiency}
          onClick={toggle}
          className={
            enabled
              ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
              : "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs font-medium text-text"
          }
        >
          {racialProficiency
            ? "Concedida pela raça"
            : enabled
              ? "Proficiente"
              : "Não proficiente"}
        </button>
      </div>
    </section>
  )
}

'''
text = replace_once(
    text,
    '\nfunction ProficiencyGroup({',
    '\n' + special_component + 'function ProficiencyGroup({',
    "occupied hands proficiency component",
)
write(path, text)


# ---------------------------------------------------------------------------
# Routing and sidebar.
# ---------------------------------------------------------------------------
path = "src/Router.tsx"
text = read(path)
text = replace_once(
    text,
    'import { PartyInventoryView } from "./views/PartyInventoryView"',
    'import { GroundInventoryView } from "./views/GroundInventoryView"\nimport { PartyInventoryView } from "./views/PartyInventoryView"',
    "ground inventory route import",
)
text = replace_once(
    text,
    '      <Route path="/party-inventory" element={<PartyInventoryView />} />',
    '      <Route path="/party-inventory" element={<PartyInventoryView />} />\n      <Route path="/ground-inventory" element={<GroundInventoryView />} />',
    "ground inventory route",
)
write(path, text)

path = "src/App.tsx"
text = read(path)
text = replace_once(
    text,
    '''    {
      label: "Missões",''',
    '''    {
      label: "Inventário do chão",
      icon: <IconBackpack />,
      active: location.pathname === "/ground-inventory",
      onClick: () => navigate("/ground-inventory"),
    },
    {
      label: "Missões",''',
    "ground inventory sidebar item",
)
write(path, text)


# ---------------------------------------------------------------------------
# Sanity checks.
# ---------------------------------------------------------------------------
checks = {
    "src/models/items/equipment/Weapon.ts": [
        "isWeaponImprovisedGrip",
        'sides: "d4"',
    ],
    "src/models/characters/CharacterTemplate.ts": ["heldItems"],
    "src/models/characters/characterStats.ts": [
        "isWeaponImprovisedGrip",
        "getWeaponAttackAttribute",
    ],
    "src/lib/remoteState.ts": ["groundInventory"],
    "src/models/game/GameOperation.ts": ['type: "ground"', "ground.item.add"],
    "src/models/game/applyGameOperation.ts": ["groundInventory", "ground.item.add"],
    "src/contexts/characterContext.tsx": ["dropHandOccupant", "groundInventory"],
    "src/features/characters/inventory/characterInventory.tsx": ["EquipItemDialog"],
    "src/features/characters/inventory/inventoryEditorV2.tsx": ["{onEquipItem ? ("],
    "src/features/characters/characterSheet/attributeCalculators.tsx": [
        "SpellcastingHandsWarning",
    ],
    "src/features/characters/proficiencies/characterProficiencies.tsx": [
        "OccupiedHandsSpellcastingProficiency",
    ],
    "src/views/GroundInventoryView.tsx": ["Inventário do chão"],
}

for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
