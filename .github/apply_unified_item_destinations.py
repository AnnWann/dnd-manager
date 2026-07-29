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


# Inventory destination model: pocket is part of the same equip dialog.
path = "src/models/characters/characterEquipmentInteractions.ts"
text = read(path)
text = replace_once(
    text,
    '''export type EquipmentDestination =
  | { type: "natural" }
  | {
      type: "hand"''',
    '''export type EquipmentDestination =
  | { type: "natural" }
  | { type: "pocket" }
  | {
      type: "hand"''',
    "pocket equipment destination type",
)
text = replace_once(
    text,
    '''  if (!item) return character

  if (destination.type === "hand") {''',
    '''  if (!item) return character

  if (destination.type === "pocket") {
    return pocketInventoryItemWithRules(character, itemId)
  }

  if (destination.type === "hand") {''',
    "pocket equipment destination behavior",
)
write(path, text)


# The inventory no longer exposes a standalone Send to pocket action.
path = "src/features/characters/inventory/characterInventory.tsx"
text = read(path)
text = replace_once(
    text,
    '''import {
  equipInventoryItemWithRules,
  pocketInventoryItemWithRules,
} from "../../../models/characters/characterEquipmentInteractions"''',
    '''import { equipInventoryItemWithRules } from "../../../models/characters/characterEquipmentInteractions"''',
    "remove direct pocket interaction import",
)
text = re.sub(
    r'\n\s*onPocketItem=\{\(itemId\) =>\n\s*updateCharacter\(character\.get\("id"\), \(current\) =>\n\s*pocketInventoryItemWithRules\(current, itemId\),\n\s*\)\n\s*\}',
    '',
    text,
    count=1,
)
write(path, text)


path = "src/features/characters/inventory/inventoryEditorV2.tsx"
text = read(path)
text = text.replace('  canItemGoInPocket,\n', '')
text = text.replace('  onPocketItem?: (itemId: string) => void\n', '')
text = text.replace('  onPocketItem,\n', '')
text = text.replace('          onPocketItem={onPocketItem}\n', '')
text = re.sub(
    r'\n\s*\{canItemGoInPocket\(item\) && onPocketItem \? \(\n\s*<Button.*?\n\s*</Button>\n\s*\) : null\}',
    '',
    text,
    flags=re.S,
)
write(path, text)


# Character context owns atomic movement from equipment to inventory, pocket,
# or the shared ground inventory.
path = "src/contexts/characterContext.tsx"
text = read(path)
text = replace_once(
    text,
    '''import {
  removeHandOccupant,
  stowHandOccupant as stowCharacterHandOccupant,
  type HandOccupantReference,
} from "../models/characters/characterHands"''',
    '''import {
  removeHandOccupant,
  stowHandOccupant as stowCharacterHandOccupant,
  type HandOccupantReference,
} from "../models/characters/characterHands"
import {
  moveEquippedItemToCharacterStorage,
  removeEquippedItem as removeAnyEquippedItem,
  type EquippedItemDestination,
  type EquippedItemReference,
} from "../models/characters/characterEquippedItemMovement"''',
    "equipped item movement imports",
)
text = replace_once(
    text,
    '''  dropHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  transferItem: (request: TransferItemRequest) => void''',
    '''  dropHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  moveEquippedItem: (
    characterId: string,
    reference: EquippedItemReference,
    destination: EquippedItemDestination,
  ) => void
  transferItem: (request: TransferItemRequest) => void''',
    "context equipped item method type",
)
insert = '''
  function moveEquippedItem(
    characterId: string,
    reference: EquippedItemReference,
    destination: EquippedItemDestination,
  ) {
    if (destination !== "ground") {
      updateCharacter(characterId, (current) =>
        moveEquippedItemToCharacterStorage(
          current,
          reference,
          destination,
        ),
      )
      return
    }

    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const removed = removeAnyEquippedItem(
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
              heldHands: undefined,
              insideBagOfHolding: false,
            },
          },
          actorId,
        ),
      )
    })
  }

'''
text = replace_once(
    text,
    '''  function canTransferFromCharacter(characterId: string): boolean {''',
    insert + '''  function canTransferFromCharacter(characterId: string): boolean {''',
    "context equipped item method body",
)
text = replace_once(
    text,
    '''        stowHandOccupant,
        dropHandOccupant,
        transferItem,''',
    '''        stowHandOccupant,
        dropHandOccupant,
        moveEquippedItem,
        transferItem,''',
    "context equipped item provider",
)
write(path, text)


# The equipment weapons section opens the same hand-item popup instead of
# sending the weapon directly to the inventory.
path = "src/features/characters/equipment/EquipmentWeaponsSection.tsx"
text = read(path)
text = replace_once(
    text,
    'import { Crosshair, Hand, Scale, Sparkles, Swords } from "lucide-react"',
    'import { useState } from "react"\nimport { Crosshair, Hand, Scale, Sparkles, Swords } from "lucide-react"',
    "weapon section state import",
)
text = replace_once(
    text,
    'import { EquipmentFeaturesList } from "./equipmentFeaturesList"',
    '''import { EquipmentFeaturesList } from "./equipmentFeaturesList"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "../characterSheet/weaponAttackCardActionsDialog"''',
    "weapon section destination dialog import",
)
text = replace_once(
    text,
    '''  const weapons = character.get("equipment").weapons
  const usedHands = getUsedArmsIncludingShield(character)''',
    '''  const [dialogState, setDialogState] =
    useState<HandItemActionsDialogState | null>(null)
  const weapons = character.get("equipment").weapons
  const usedHands = getUsedArmsIncludingShield(character)''',
    "weapon section dialog state",
)
text = re.sub(
    r'\n  function unequipWeapon\(index: number\) \{\n    updateCharacter\(character\.get\("id"\), \(c\) => c\.unequipWeapon\(index\)\)\n  \}\n',
    '\n',
    text,
    count=1,
)
text = replace_once(
    text,
    'onClick={() => unequipWeapon(index)}',
    'onClick={() => setDialogState({ itemId: weapon.id })}',
    "weapon section open destination dialog",
)
text = replace_once(
    text,
    '''      )}
    </section>
  )
}''',
    '''      )}
    </section>

      <HandItemActionsDialog
        character={character}
        state={dialogState}
        onClose={() => setDialogState(null)}
      />
    </>
  )
}''',
    "weapon section render destination dialog",
)
text = replace_once(
    text,
    '''  return (
    <section>''',
    '''  return (
    <>
      <section>''',
    "weapon section fragment start",
)
write(path, text)


checks = {
    "src/models/characters/characterEquipmentInteractions.ts": [
        '{ type: "pocket" }',
        'destination.type === "pocket"',
    ],
    "src/features/characters/inventory/characterInventory.tsx": [
        "EquipItemDialog",
    ],
    "src/features/characters/inventory/inventoryEditorV2.tsx": [
        "onEquipItem",
    ],
    "src/contexts/characterContext.tsx": [
        "moveEquippedItemToCharacterStorage",
        "moveEquippedItem,",
    ],
    "src/features/characters/equipment/EquipmentWeaponsSection.tsx": [
        "HandItemActionsDialog",
        "setDialogState",
    ],
}

for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")

if "onPocketItem" in read("src/features/characters/inventory/inventoryEditorV2.tsx"):
    raise SystemExit("standalone onPocketItem action still exists")
