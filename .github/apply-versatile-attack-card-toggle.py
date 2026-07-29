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


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(
        pattern,
        lambda _match: replacement,
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# ---------------------------------------------------------------------------
# Every item can persist how many hands it currently occupies.
# ---------------------------------------------------------------------------
path = "src/models/items/item.ts"
text = read(path)
text = replace_once(
    text,
    "  insideBagOfHolding?: boolean\n",
    "  insideBagOfHolding?: boolean\n\n  /** Quantidade de mãos usadas enquanto o item está sendo segurado. */\n  heldHands?: 1 | 2\n",
    "item held hands field",
)
write(path, text)


# ---------------------------------------------------------------------------
# Every weapon accepts one- or two-handed grip. Only versatile and required
# two-handed weapons change their combat statistics.
# ---------------------------------------------------------------------------
path = "src/models/items/equipment/Weapon.ts"
text = read(path)
text = replace_once(
    text,
    "  /** Estado atual de empunhadura para armas versáteis ou de duas mãos. */\n  wieldedTwoHanded?: boolean",
    "  /** Estado atual de empunhadura. Qualquer arma pode ocupar uma ou duas mãos. */\n  wieldedTwoHanded?: boolean",
    "weapon grip comment",
)
text = replace_regex(
    text,
    r"export function getWeaponHandsUsed\(weapon: Partial<Weapon>\): 1 \| 2 \{.*?\n\}",
    '''export function getWeaponHandsUsed(weapon: Partial<Weapon>): 1 | 2 {
  if (weapon.wieldedTwoHanded === true) return 2
  if (weapon.wieldedTwoHanded === false) return 1
  return weapon.twoHanded ? 2 : 1
}''',
    "weapon hands calculation",
)
write(path, text)


# ---------------------------------------------------------------------------
# Central hand model for weapons, shields and generic held items.
# ---------------------------------------------------------------------------
write(
    "src/models/characters/characterHands.ts",
    '''import type { CharacterTemplate } from "./CharacterTemplate"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import {
  getWeaponHandsUsed,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"

export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID =
  "spellcasting-with-occupied-hands"
export const OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME =
  "Conjuração com mãos ocupadas"

export type HeldHands = 1 | 2

export type HandOccupantReference =
  | { type: "weapon"; index: number }
  | { type: "shield" }
  | { type: "held-item"; index: number }

export type HandOccupant = {
  key: string
  reference: HandOccupantReference
  item: Itemmable
  name: string
  hands: HeldHands
  arcaneFocus: boolean
  canReduceToOneHand: boolean
}

export type SpellcastingHandState = {
  canCast: boolean
  hasOccupiedHandsProficiency: boolean
  blockingHands: number
  totalHands: number
  blockers: HandOccupant[]
}

export function getItemHeldHands(item: Partial<Itemmable>): HeldHands {
  return item.heldHands === 2 ? 2 : 1
}

export function getHandOccupants(
  character: CharacterTemplate,
): HandOccupant[] {
  const equipment = character.get("equipment")
  const occupants: HandOccupant[] = equipment.weapons.map((weapon, index) => {
    const hands = getWeaponHandsUsed(weapon)
    return {
      key: `weapon:${index}:${weapon.id}`,
      reference: { type: "weapon", index },
      item: weapon,
      name: weapon.name || "Arma sem nome",
      hands,
      arcaneFocus: false,
      canReduceToOneHand: hands === 2,
    }
  })

  if (equipment.shield) {
    const hands = getItemHeldHands(equipment.shield)
    occupants.push({
      key: `shield:${equipment.shield.id}`,
      reference: { type: "shield" },
      item: equipment.shield,
      name: equipment.shield.name || "Escudo",
      hands,
      arcaneFocus: false,
      canReduceToOneHand: hands === 2,
    })
  }

  for (const [index, item] of (equipment.heldItems ?? []).entries()) {
    const hands = getItemHeldHands(item)
    occupants.push({
      key: `held:${index}:${item.id}`,
      reference: { type: "held-item", index },
      item,
      name: item.name || "Item sem nome",
      hands,
      arcaneFocus: item.kind === "focus",
      canReduceToOneHand: hands === 2,
    })
  }

  return occupants
}

export function findHandOccupantByItemId(
  character: CharacterTemplate,
  itemId: string,
): HandOccupant | undefined {
  return getHandOccupants(character).find(
    (occupant) => occupant.item.id === itemId,
  )
}

export function getUsedHands(character: CharacterTemplate): number {
  return getHandOccupants(character).reduce(
    (total, occupant) => total + occupant.hands,
    0,
  )
}

export function getFreeHands(character: CharacterTemplate): number {
  return Math.max(0, character.get("sheet").arms - getUsedHands(character))
}

export function hasOccupiedHandsSpellcastingProficiency(
  character: CharacterTemplate,
): boolean {
  const proficiencies = [
    ...(character.get("sheet").proficiencies ?? []),
    ...(character.get("sheet").race.proficiencies ?? []),
  ]
  const expectedName = normalizeName(
    OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )

  return proficiencies.some(
    (proficiency) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      (proficiency.category === "other" &&
        normalizeName(proficiency.name) === expectedName),
  )
}

export function getSpellcastingHandState(
  character: CharacterTemplate,
): SpellcastingHandState {
  const totalHands = Math.max(0, character.get("sheet").arms)
  const occupants = getHandOccupants(character)
  const blockers = occupants.filter((occupant) => !occupant.arcaneFocus)
  const blockingHands = blockers.reduce(
    (total, occupant) => total + occupant.hands,
    0,
  )
  const hasOccupiedHandsProficiency =
    hasOccupiedHandsSpellcastingProficiency(character)

  return {
    canCast:
      hasOccupiedHandsProficiency ||
      totalHands <= 0 ||
      blockingHands < totalHands,
    hasOccupiedHandsProficiency,
    blockingHands,
    totalHands,
    blockers,
  }
}

export function setHandOccupantHandsWithRules(
  character: CharacterTemplate,
  reference: HandOccupantReference,
  hands: HeldHands,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const occupant = getHandOccupants(character).find((entry) =>
    sameReference(entry.reference, reference),
  )
  if (!occupant) return character

  const nextUsedHands = getUsedHands(character) - occupant.hands + hands
  if (nextUsedHands > character.get("sheet").arms) return character

  if (reference.type === "weapon") {
    const weapon = equipment.weapons[reference.index]
    if (!weapon) return character

    const nextWeapon: Weapon = {
      ...weapon,
      wieldedTwoHanded: hands === 2,
    }
    return character.updateWeapon(reference.index, nextWeapon)
  }

  if (reference.type === "shield") {
    if (!equipment.shield) return character
    return character.with("equipment", {
      ...equipment,
      shield: {
        ...equipment.shield,
        heldHands: hands,
      },
    })
  }

  const item = (equipment.heldItems ?? [])[reference.index]
  if (!item) return character

  return character.with("equipment", {
    ...equipment,
    heldItems: (equipment.heldItems ?? []).map((entry, index) =>
      index === reference.index
        ? {
            ...entry,
            heldHands: hands,
          }
        : entry,
    ),
  })
}

export function setWeaponGripWithRules(
  character: CharacterTemplate,
  index: number,
  wieldedTwoHanded: boolean,
): CharacterTemplate {
  return setHandOccupantHandsWithRules(
    character,
    { type: "weapon", index },
    wieldedTwoHanded ? 2 : 1,
  )
}

export function setHeldItemHandsWithRules(
  character: CharacterTemplate,
  index: number,
  hands: HeldHands,
): CharacterTemplate {
  return setHandOccupantHandsWithRules(
    character,
    { type: "held-item", index },
    hands,
  )
}

export function removeHandOccupant(
  character: CharacterTemplate,
  reference: HandOccupantReference,
): { character: CharacterTemplate; item?: Itemmable } {
  const equipment = character.get("equipment")

  if (reference.type === "weapon") {
    const item = equipment.weapons[reference.index]
    if (!item) return { character }

    return {
      character: character.with("equipment", {
        ...equipment,
        weapons: equipment.weapons.filter(
          (_, index) => index !== reference.index,
        ),
      }),
      item,
    }
  }

  if (reference.type === "shield") {
    if (!equipment.shield) return { character }

    return {
      character: character.with("equipment", {
        ...equipment,
        shield: undefined,
      }),
      item: equipment.shield,
    }
  }

  const item = (equipment.heldItems ?? [])[reference.index]
  if (!item) return { character }

  return {
    character: character.with("equipment", {
      ...equipment,
      heldItems: (equipment.heldItems ?? []).filter(
        (_, index) => index !== reference.index,
      ),
    }),
    item,
  }
}

export function stowHandOccupant(
  character: CharacterTemplate,
  reference: HandOccupantReference,
): CharacterTemplate {
  const removed = removeHandOccupant(character, reference)
  if (!removed.item) return character

  return removed.character.with("inventory", [
    ...removed.character.get("inventory"),
    {
      ...removed.item,
      heldHands: undefined,
      insideBagOfHolding: false,
    },
  ])
}

export function isHeldItemActiveEquipment(item: Itemmable): item is Equipment {
  return item.kind === "focus"
}

function sameReference(
  first: HandOccupantReference,
  second: HandOccupantReference,
): boolean {
  if (first.type !== second.type) return false
  if (first.type === "shield" && second.type === "shield") return true
  if (first.type === "weapon" && second.type === "weapon") {
    return first.index === second.index
  }
  if (first.type === "held-item" && second.type === "held-item") {
    return first.index === second.index
  }
  return false
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
''',
)


# ---------------------------------------------------------------------------
# Inventory equipment destinations now carry an explicit hand count.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterEquipmentInteractions.ts"
text = read(path)
text = replace_once(
    text,
    '''  WEAPON_PROPERTIES,
  hasWeaponProperty,
  isVersatileWeapon,
  type Weapon,''',
    '''  WEAPON_PROPERTIES,
  getWeaponHandsUsed,
  hasWeaponProperty,
  isVersatileWeapon,
  type Weapon,''',
    "equipment interactions weapon hands import",
)
text = replace_once(
    text,
    '''export type EquipmentDestination =
  | { type: "natural" }
  | { type: "hand"; wieldedTwoHanded?: boolean }''',
    '''export type EquipmentDestination =
  | { type: "natural" }
  | {
      type: "hand"
      hands?: 1 | 2
      /** Compatibilidade com chamadas anteriores. */
      wieldedTwoHanded?: boolean
    }''',
    "equipment destination hand count",
)
text = replace_once(
    text,
    '''  if (destination.type === "hand") {
    return equipItemInHand(character, item, destination.wieldedTwoHanded)
  }''',
    '''  if (destination.type === "hand") {
    const hands =
      destination.hands ?? (destination.wieldedTwoHanded ? 2 : 1)
    return equipItemInHand(character, item, hands)
  }''',
    "equipment destination resolution",
)
text = replace_once(
    text,
    '''        shield: withShieldDefaults(itemToEquip),''',
    '''        shield: withShieldDefaults({
          ...itemToEquip,
          heldHands: 1,
        }),''',
    "shield natural hand count",
)
text = replace_regex(
    text,
    r'''function equipItemInHand\(.*?\n\}\n\nfunction getWeaponRequiredHands''',
    '''function equipItemInHand(
  character: CharacterTemplate,
  item: Itemmable,
  hands: 1 | 2 = 1,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const inventoryWithoutItem = character
    .get("inventory")
    .filter((entry) => entry.id !== item.id)

  if (getFreeHands(character) < hands) return character

  if (item.kind === "equipment" && item.equipSlot === "weapon") {
    const weapon = toWeapon(item)
    const nextWeapon: Weapon = {
      ...weapon,
      heldHands: undefined,
      wieldedTwoHanded: hands === 2,
    }

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        weapons: [...equipment.weapons, nextWeapon],
      })
  }

  return character
    .with("inventory", inventoryWithoutItem)
    .with("equipment", {
      ...equipment,
      heldItems: [
        ...(equipment.heldItems ?? []),
        {
          ...item,
          heldHands: hands,
          insideBagOfHolding: false,
        },
      ],
    })
}

function getWeaponRequiredHands''',
    "equip item in arbitrary hands",
)
text = replace_regex(
    text,
    r'''function getWeaponRequiredHands\(weapon: Weapon\): number \{.*?\n\}''',
    '''function getWeaponRequiredHands(weapon: Weapon): number {
  return getWeaponHandsUsed(weapon)
}''',
    "weapon required hands helper",
)
write(path, text)


# ---------------------------------------------------------------------------
# General inventory equip modal: every item offers one hand, two hands and its
# natural equipment slot when applicable.
# ---------------------------------------------------------------------------
write(
    "src/features/characters/inventory/equipItemDialog.tsx",
    '''import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getFreeHands } from "../../../models/characters/characterHands"
import type { EquipmentDestination } from "../../../models/characters/characterEquipmentInteractions"
import {
  isVersatileWeapon,
  type Weapon,
} from "../../../models/items/equipment/Weapon"
import type { EquipSlot, Itemmable } from "../../../models/items/item"

export function EquipItemDialog({
  open,
  character,
  item,
  onClose,
  onEquip,
}: {
  open: boolean
  character: CharacterTemplate
  item: Itemmable | null
  onClose: () => void
  onEquip: (destination: EquipmentDestination) => void
}) {
  const options = useMemo(
    () => (item ? getEquipmentOptions(character, item) : []),
    [character, item],
  )
  const [selectedKey, setSelectedKey] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedKey(options.find((option) => option.available)?.key ?? "")
  }, [open, options])

  if (!open || !item) return null

  const selected = options.find((option) => option.key === selectedKey)

  return (
    <Modal title="Equipar item" onClose={onClose} className="max-w-xl">
      <div className="grid gap-4">
        <div className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="text-sm font-semibold text-textH">
            {item.name || "Item sem nome"}
          </div>
          <div className="mt-1 text-xs leading-5 text-textMuted">
            Qualquer item pode ser segurado com uma ou duas mãos. Usar duas
            mãos só altera ataque e dano quando a arma possui uma regra própria,
            como Versátil ou Duas Mãos. Focos arcanos segurados não bloqueiam a
            conjuração.
          </div>
        </div>

        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={!option.available}
              onClick={() => setSelectedKey(option.key)}
              className={[
                "rounded-xl border p-3 text-left transition-colors",
                selectedKey === option.key
                  ? "border-accentBorder bg-accentBg"
                  : "border-border bg-bg hover:bg-bg-subtle",
                option.available
                  ? ""
                  : "cursor-not-allowed opacity-45",
              ].join(" ")}
            >
              <div className="text-sm font-semibold text-textH">
                {option.label}
              </div>
              <div className="mt-1 text-xs leading-5 text-textMuted">
                {option.description}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!selected?.available}
            onClick={() => {
              if (!selected?.available) return
              onEquip(selected.destination)
              onClose()
            }}
          >
            Equipar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

type EquipmentOption = {
  key: string
  label: string
  description: string
  available: boolean
  destination: EquipmentDestination
}

function getEquipmentOptions(
  character: CharacterTemplate,
  item: Itemmable,
): EquipmentOption[] {
  const options: EquipmentOption[] = []
  const freeHands = getFreeHands(character)
  const weapon =
    item.kind === "equipment" && item.equipSlot === "weapon"
      ? (item as Weapon)
      : undefined

  options.push({
    key: "hand-one",
    label: weapon?.twoHanded
      ? "Segurar com uma mão — arma improvisada"
      : "Segurar com uma mão",
    description: weapon?.twoHanded
      ? "Usa Força no ataque e causa 1d4 + Força, ignorando proficiência e estatísticas próprias da arma."
      : item.kind === "focus"
        ? "Ocupa uma mão, ativa o foco e não bloqueia a conjuração."
        : "Ocupa uma mão. A arma mantém suas estatísticas normais quando não exige duas mãos.",
    available: freeHands >= 1,
    destination: { type: "hand", hands: 1 },
  })

  options.push({
    key: "hand-two",
    label: "Segurar com duas mãos",
    description: weapon
      ? weapon.twoHanded
        ? "Usa normalmente as estatísticas da arma."
        : isVersatileWeapon(weapon)
          ? "Usa o dado de dano versátil definido para duas mãos."
          : "Ocupa duas mãos, mas não altera as estatísticas desta arma."
      : item.kind === "focus"
        ? "Ocupa duas mãos, ativa o foco e não bloqueia a conjuração."
        : "Ocupa duas mãos sem conceder benefícios adicionais por padrão.",
    available: freeHands >= 2,
    destination: { type: "hand", hands: 2 },
  })

  if (item.equippable && item.equipSlot && item.equipSlot !== "weapon") {
    const requiresHand = item.equipSlot === "shield"
    const replacingShield =
      requiresHand && Boolean(character.get("equipment").shield)

    options.push({
      key: `natural:${item.equipSlot}`,
      label: naturalSlotLabel(item.equipSlot),
      description:
        item.equipSlot === "shield"
          ? "Ocupa uma mão e ativa os benefícios do escudo."
          : "Ativa os benefícios próprios deste espaço de equipamento.",
      available: !requiresHand || replacingShield || freeHands >= 1,
      destination: { type: "natural" },
    })
  }

  return options
}

function naturalSlotLabel(slot: EquipSlot): string {
  const labels: Record<EquipSlot, string> = {
    armor: "Vestir como armadura",
    helmet: "Equipar como capacete",
    gloves: "Equipar como luvas",
    boots: "Equipar como botas",
    cape: "Equipar como capa",
    shield: "Empunhar como escudo",
    weapon: "Empunhar como arma",
    ring: "Usar como anel",
  }

  return labels[slot]
}
''',
)


# ---------------------------------------------------------------------------
# Shared popup for any item currently occupying hands.
# ---------------------------------------------------------------------------
write(
    "src/features/characters/characterSheet/weaponAttackCardActionsDialog.tsx",
    '''import { useState } from "react"
import { Hand, PackageOpen } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  findHandOccupantByItemId,
  getHandOccupants,
  getUsedHands,
  setHandOccupantHandsWithRules,
  type HandOccupant,
  type HeldHands,
} from "../../../models/characters/characterHands"
import { isWeaponImprovisedGrip } from "../../../models/items/equipment/Weapon"

export type HandItemActionsDialogState = {
  itemId: string
}

export function HandItemActionsDialog({
  character,
  state,
  onClose,
}: {
  character: CharacterTemplate
  state: HandItemActionsDialogState | null
  onClose: () => void
}) {
  const {
    updateCharacter,
    stowHandOccupant,
    dropHandOccupant,
  } = useCharacterContext()
  const [pendingHands, setPendingHands] = useState<HeldHands | null>(null)

  if (!state) return null

  const occupant = findHandOccupantByItemId(character, state.itemId)
  if (!occupant) return null

  const blockers = getHandOccupants(character).filter(
    (entry) => entry.item.id !== occupant.item.id,
  )
  const itemIsWeapon = occupant.reference.type === "weapon"
  const improvised =
    itemIsWeapon && isWeaponImprovisedGrip(occupant.item)

  function setHands(hands: HeldHands) {
    const availableAfterRemovingCurrent =
      character.get("sheet").arms -
      (getUsedHands(character) - occupant.hands)

    if (availableAfterRemovingCurrent < hands) {
      setPendingHands(hands)
      return
    }

    updateCharacter(character.get("id"), (current) => {
      const currentOccupant = findHandOccupantByItemId(
        current,
        state.itemId,
      )
      if (!currentOccupant) return current
      return setHandOccupantHandsWithRules(
        current,
        currentOccupant.reference,
        hands,
      )
    })
    onClose()
  }

  function removeSelected(destination: "inventory" | "ground") {
    const currentOccupant = findHandOccupantByItemId(
      character,
      state.itemId,
    )
    if (!currentOccupant) return

    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), currentOccupant.reference)
    } else {
      dropHandOccupant(character.get("id"), currentOccupant.reference)
    }
    onClose()
  }

  function freeBlocker(
    blocker: HandOccupant,
    destination: "inventory" | "ground",
  ) {
    if (!pendingHands) return

    if (destination === "inventory") {
      stowHandOccupant(character.get("id"), blocker.reference)
    } else {
      dropHandOccupant(character.get("id"), blocker.reference)
    }

    updateCharacter(character.get("id"), (current) => {
      const currentOccupant = findHandOccupantByItemId(
        current,
        state.itemId,
      )
      if (!currentOccupant) return current
      return setHandOccupantHandsWithRules(
        current,
        currentOccupant.reference,
        pendingHands,
      )
    })
    onClose()
  }

  return (
    <Modal
      title={`Gerenciar: ${occupant.name}`}
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="grid gap-4">
        <div className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="flex items-start gap-3">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div>
              <div className="text-sm font-semibold text-textH">
                Empunhadura atual: {occupant.hands} {occupant.hands === 1 ? "mão" : "mãos"}
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                {improvised
                  ? "Esta arma exige duas mãos. Com uma mão, usa Força e causa 1d4 + Força como arma improvisada."
                  : itemIsWeapon
                    ? "Qualquer arma pode ocupar uma ou duas mãos. Apenas propriedades específicas alteram ataque ou dano."
                    : occupant.arcaneFocus
                      ? "Este foco não bloqueia conjuração, mesmo quando ocupa duas mãos."
                      : "O item pode ocupar uma ou duas mãos sem benefício adicional por padrão."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={occupant.hands === 1 ? "primary" : "secondary"}
            onClick={() => setHands(1)}
          >
            Uma mão
          </Button>
          <Button
            variant={occupant.hands === 2 ? "primary" : "secondary"}
            onClick={() => setHands(2)}
          >
            Duas mãos
          </Button>
          <Button
            variant="secondary"
            onClick={() => removeSelected("inventory")}
          >
            Guardar
          </Button>
          <Button
            variant="danger"
            onClick={() => removeSelected("ground")}
          >
            Largar no chão
          </Button>
        </div>

        {pendingHands ? (
          <div className="grid gap-3 border-t border-border pt-4">
            <div className="rounded-xl border border-warning bg-warningBg p-3">
              <div className="text-sm font-semibold text-textH">
                Não há mãos livres suficientes
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Escolha outro item para guardar ou largar. Depois disso,
                {" "}{occupant.name} passará automaticamente para {pendingHands}
                {" "}{pendingHands === 1 ? "mão" : "mãos"}.
              </p>
            </div>

            {blockers.map((blocker) => (
              <article
                key={blocker.key}
                className="rounded-xl border border-border bg-bg-subtle p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {blocker.name}
                    </div>
                    <div className="mt-1 text-xs text-textMuted">
                      Ocupa {blocker.hands} {blocker.hands === 1 ? "mão" : "mãos"}
                      {blocker.arcaneFocus ? " · foco arcano" : ""}
                    </div>
                  </div>
                  <PackageOpen className="h-4 w-4 shrink-0 text-textMuted" />
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => freeBlocker(blocker, "inventory")}
                  >
                    Guardar este item
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => freeBlocker(blocker, "ground")}
                  >
                    Largar este item
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
''',
)


# ---------------------------------------------------------------------------
# Generic held-item cards open the same management popup.
# ---------------------------------------------------------------------------
write(
    "src/features/characters/equipment/EquipmentHeldItemsSection.tsx",
    '''import { useState } from "react"
import { Hand, Sparkles } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getItemHeldHands } from "../../../models/characters/characterHands"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "../characterSheet/weaponAttackCardActionsDialog"

export function EquipmentHeldItemsSection({
  character,
}: {
  character: CharacterTemplate
}) {
  const [dialogState, setDialogState] =
    useState<HandItemActionsDialogState | null>(null)
  const items = character.get("equipment").heldItems ?? []

  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-textH">
          <Hand className="h-4 w-4 text-accent" />
          Itens nas mãos
        </div>
        <div className="mt-1 text-xs text-textMuted">
          Toque em qualquer item para mudar entre uma ou duas mãos, guardar ou
          largar.
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-5 text-center text-xs text-textMuted">
          Nenhum item adicional está sendo segurado.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item, index) => {
            const hands = getItemHeldHands(item)
            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => setDialogState({ itemId: item.id })}
                className="rounded-xl border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {item.name || "Item sem nome"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-textMuted">
                      <span>{hands} {hands === 1 ? "mão" : "mãos"}</span>
                      {item.kind === "focus" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 font-semibold text-accent">
                          <Sparkles className="h-3 w-3" />
                          Foco arcano
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <HandItemActionsDialog
        character={character}
        state={dialogState}
        onClose={() => setDialogState(null)}
      />
    </section>
  )
}
''',
)


# ---------------------------------------------------------------------------
# Spellcasting warning can reduce any two-handed item to one hand.
# ---------------------------------------------------------------------------
write(
    "src/features/characters/characterSheet/spellcastingHandsWarning.tsx",
    '''import { useState } from "react"
import { AlertTriangle, Hand } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getSpellcastingHandState,
  setHandOccupantHandsWithRules,
  type HandOccupant,
} from "../../../models/characters/characterHands"

export function SpellcastingHandsWarning({
  character,
}: {
  character: CharacterTemplate
}) {
  const {
    updateCharacter,
    stowHandOccupant,
    dropHandOccupant,
  } = useCharacterContext()
  const [selectedOccupant, setSelectedOccupant] =
    useState<HandOccupant | null>(null)
  const state = getSpellcastingHandState(character)

  if (state.canCast) return null

  function handleOccupant(occupant: HandOccupant) {
    if (occupant.hands === 2) {
      updateCharacter(character.get("id"), (current) =>
        setHandOccupantHandsWithRules(
          current,
          occupant.reference,
          1,
        ),
      )
      return
    }

    setSelectedOccupant(occupant)
  }

  return (
    <>
      <div className="rounded-xl border border-danger bg-dangerBg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-danger">
              Não pode conjurar com as mãos ocupadas
            </div>
            <p className="mt-1 text-xs leading-5 text-text">
              Todas as mãos úteis estão ocupadas. Um foco arcano segurado não
              causa esse bloqueio. Libere uma mão ou adquira a proficiência
              “Conjuração com mãos ocupadas”.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {state.blockers.map((occupant) => (
            <button
              key={occupant.key}
              type="button"
              onClick={() => handleOccupant(occupant)}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-bg px-2.5 py-1.5 text-xs font-medium text-textH hover:bg-bg-subtle"
            >
              <Hand className="h-3.5 w-3.5 text-danger" />
              <span>{occupant.name}</span>
              <span className="text-[10px] text-textMuted">
                {occupant.hands} {occupant.hands === 1 ? "mão" : "mãos"}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-2 text-[10px] leading-4 text-textMuted">
          Itens em duas mãos passam para uma mão ao serem tocados. Itens em uma
          mão abrem as opções de guardar ou largar.
        </p>
      </div>

      {selectedOccupant ? (
        <Modal
          title={`Liberar mão: ${selectedOccupant.name}`}
          onClose={() => setSelectedOccupant(null)}
          className="max-w-md"
        >
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-text">
              Guardar devolve o item ao inventário pessoal. Largar envia o item
              para o Inventário do chão, onde qualquer jogador poderá pegá-lo.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  stowHandOccupant(
                    character.get("id"),
                    selectedOccupant.reference,
                  )
                  setSelectedOccupant(null)
                }}
              >
                Guardar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  dropHandOccupant(
                    character.get("id"),
                    selectedOccupant.reference,
                  )
                  setSelectedOccupant(null)
                }}
              >
                Largar no chão
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
''',
)


# ---------------------------------------------------------------------------
# Unarmed attack profile, including 2014 Monk Martial Arts progression.
# ---------------------------------------------------------------------------
write(
    "src/models/characters/unarmedAttack.ts",
    '''import type { Die } from "../dice/Die"
import type { Attribute } from "../sheet/Attribute"
import type { Weapon } from "../items/equipment/Weapon"
import type { CharacterTemplate } from "./CharacterTemplate"

export type UnarmedAttackProfile = {
  attribute: Attribute
  attack: number
  damageBonus: number
  damageDie?: Die
  monkLevel: number
}

const UNARMED_DAMAGE_PROXY: Weapon = {
  id: "unarmed-strike",
  name: "Ataque desarmado",
  desc: "",
  notes: "",
  quantity: 1,
  weight: 0,
  pocketable: false,
  kind: "equipment",
  equippable: true,
  equipSlot: "weapon",
  properties: [],
  damage: { quantity: 1, sides: "d4" },
  modifierAttribute: "str",
  proficient: false,
}

export function getUnarmedAttackProfile(
  character: CharacterTemplate,
): UnarmedAttackProfile {
  const monkLevel = character.getClassLevel("monk")
  const strengthModifier = character.getEffectiveAttributeModifier("str")
  const dexterityModifier = character.getEffectiveAttributeModifier("dex")
  const attribute: Attribute =
    monkLevel > 0 && dexterityModifier > strengthModifier ? "dex" : "str"
  const modifier = character.getEffectiveAttributeModifier(attribute)
  const attack = character.getEffectiveAttackBonus(
    modifier + character.getProficiencyBonus(),
  )
  const damageBonus = character.getEffectiveWeaponDamageBonus(
    {
      ...UNARMED_DAMAGE_PROXY,
      modifierAttribute: attribute,
    },
    modifier,
  )

  return {
    attribute,
    attack,
    damageBonus,
    damageDie: monkLevel > 0 ? getMonkMartialArtsDie(monkLevel) : undefined,
    monkLevel,
  }
}

export function formatUnarmedDamage(
  profile: UnarmedAttackProfile,
): string {
  const base = profile.damageDie
    ? `${profile.damageDie.quantity}${profile.damageDie.sides}`
    : "1"

  if (profile.damageBonus === 0) return base
  return `${base} ${profile.damageBonus > 0 ? "+" : "-"} ${Math.abs(profile.damageBonus)}`
}

export function getMonkMartialArtsDie(level: number): Die {
  if (level >= 17) return { quantity: 1, sides: "d10" }
  if (level >= 11) return { quantity: 1, sides: "d8" }
  if (level >= 5) return { quantity: 1, sides: "d6" }
  return { quantity: 1, sides: "d4" }
}
''',
)


# ---------------------------------------------------------------------------
# Full attacks/DC section: every weapon card opens the popup; unarmed attack is
# shown when no weapon is equipped.
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/attributeCalculators.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { ReactNode } from "react"',
    'import { useState, type ReactNode } from "react"',
    "full sheet state import",
)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    '''import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  formatUnarmedDamage,
  getUnarmedAttackProfile,
} from "../../../models/characters/unarmedAttack"''',
    "full sheet unarmed import",
)
text = replace_once(
    text,
    'import { SpellcastingHandsWarning } from "./spellcastingHandsWarning"',
    '''import { SpellcastingHandsWarning } from "./spellcastingHandsWarning"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "./weaponAttackCardActionsDialog"''',
    "full sheet hand dialog import",
)
text = replace_once(
    text,
    '''export function AttributeCalculators({ character }: Props) {
  const proficiencyBonus = character.getProficiencyBonus()''',
    '''export function AttributeCalculators({ character }: Props) {
  const [handDialog, setHandDialog] =
    useState<HandItemActionsDialogState | null>(null)
  const proficiencyBonus = character.getProficiencyBonus()''',
    "full sheet dialog state",
)
text = replace_once(
    text,
    '''  function getWeaponDamage(weapon: Weapon): number {
    const attribute = weapon.modifierAttribute ?? "str"''',
    '''  function getWeaponDamage(weapon: Weapon): number {
    const attribute = getWeaponAttackAttribute(weapon)''',
    "full sheet weapon damage attribute",
)
text = replace_once(
    text,
    '''          {weapons.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {weapons.map((weapon, index) => (
                <WeaponAttackCard
                  key={`${weapon.id}-${index}`}
                  weapon={weapon}
                  attack={getWeaponAttack(weapon)}
                  damageBonus={getWeaponDamage(weapon)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-4 text-center text-xs text-textMuted">
              Nenhuma arma equipada.
            </div>
          )}''',
    '''          <div className="grid gap-2 sm:grid-cols-2">
            {weapons.length ? (
              weapons.map((weapon, index) => (
                <WeaponAttackCard
                  key={`${weapon.id}-${index}`}
                  weapon={weapon}
                  attack={getWeaponAttack(weapon)}
                  damageBonus={getWeaponDamage(weapon)}
                  onClick={() => setHandDialog({ itemId: weapon.id })}
                />
              ))
            ) : (
              <UnarmedAttackCard character={character} />
            )}
          </div>''',
    "full sheet weapon list and unarmed fallback",
)
text = replace_once(
    text,
    '''      </div>
    </section>
  )
}''',
    '''      </div>

      <HandItemActionsDialog
        character={character}
        state={handDialog}
        onClose={() => setHandDialog(null)}
      />
    </section>
  )
}''',
    "full sheet dialog render",
)

full_weapon_card = '''function WeaponAttackCard({
  weapon,
  attack,
  damageBonus,
  onClick,
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
  onClick: () => void
}) {
  const attribute = getWeaponAttackAttribute(weapon)
  const die = getWeaponDamageDie(weapon) ?? weapon.damage
  const damage = `${die.quantity}${die.sides}${damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}`
  const hands = weapon.wieldedTwoHanded ? 2 : 1

  return (
    <button
      type="button"
      title="Abrir opções de empunhadura, guardar ou largar"
      onClick={onClick}
      className="rounded-lg border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-textH">
          {weapon.name || "Arma sem nome"}
          {isWeaponImprovisedGrip(weapon) ? " · improvisada" : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase text-textMuted">
          <span className="rounded-full border border-accentBorder bg-accentBg px-1.5 py-0.5 normal-case text-accent">
            {hands} {hands === 1 ? "mão" : "mãos"}
          </span>
          {attributeShort(attribute)}
        </span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-textMuted">Ataque</div>
          <div className="text-xl font-bold text-textH">{formatSigned(attack)}</div>
          <div className="mt-0.5 text-xs font-medium text-textMuted">{damage}</div>
        </div>
        <Crosshair className="mt-1 h-3.5 w-3.5 shrink-0 text-textMuted" />
      </div>
    </button>
  )
}

function UnarmedAttackCard({
  character,
}: {
  character: CharacterTemplate
}) {
  const profile = getUnarmedAttackProfile(character)

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-textH">
          Ataque desarmado
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase text-textMuted">
          {profile.monkLevel > 0 ? (
            <span className="rounded-full border border-accentBorder bg-accentBg px-1.5 py-0.5 normal-case text-accent">
              Monge {profile.monkLevel}
            </span>
          ) : null}
          {attributeShort(profile.attribute)}
        </span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-textMuted">Ataque</div>
          <div className="text-xl font-bold text-textH">
            {formatSigned(profile.attack)}
          </div>
          <div className="mt-0.5 text-xs font-medium text-textMuted">
            {formatUnarmedDamage(profile)}
          </div>
        </div>
        <Crosshair className="mt-1 h-3.5 w-3.5 shrink-0 text-textMuted" />
      </div>
    </div>
  )
}'''
text = replace_regex(
    text,
    r'''function WeaponAttackCard\(.*?\n\}\n\n(?=function SpellcastingCard)''',
    full_weapon_card + "\n\n",
    "full weapon and unarmed cards",
)
write(path, text)


# ---------------------------------------------------------------------------
# Minimal attacks/DC section receives the same interactions and fallback.
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    '''import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  formatUnarmedDamage,
  getUnarmedAttackProfile,
} from "../../../models/characters/unarmedAttack"''',
    "minimal unarmed import",
)
text = replace_once(
    text,
    'import { SpellcastingHandsWarning } from "./spellcastingHandsWarning"',
    '''import { SpellcastingHandsWarning } from "./spellcastingHandsWarning"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "./weaponAttackCardActionsDialog"''',
    "minimal hand dialog import",
)
text = replace_once(
    text,
    '''  const [skillQuery, setSkillQuery] = useState("")''',
    '''  const [skillQuery, setSkillQuery] = useState("")
  const [handDialog, setHandDialog] =
    useState<HandItemActionsDialogState | null>(null)''',
    "minimal dialog state",
)
text = replace_once(
    text,
    '''            {character.get("equipment").weapons.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {character.get("equipment").weapons.map((weapon, index) => {
                  const attribute = getWeaponAttackAttribute(weapon)
                  const baseAttack =
                    character.getEffectiveAttributeModifier(attribute) +
                    (weapon.proficient && !isWeaponImprovisedGrip(weapon)
                      ? proficiency
                      : 0)
                  const attack = character.getEffectiveWeaponAttackBonus(
                    weapon,
                    baseAttack,
                  )
                  const damageBonus = character.getEffectiveWeaponDamageBonus(
                    weapon,
                    character.getEffectiveAttributeModifier(attribute),
                  )

                  return (
                    <CompactWeaponTile
                      key={`${weapon.id}-${index}`}
                      weapon={weapon}
                      attack={attack}
                      damageBonus={damageBonus}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-center text-xs text-textMuted">
                Nenhuma arma equipada.
              </div>
            )}''',
    '''            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {character.get("equipment").weapons.length ? (
                character.get("equipment").weapons.map((weapon, index) => {
                  const attribute = getWeaponAttackAttribute(weapon)
                  const baseAttack =
                    character.getEffectiveAttributeModifier(attribute) +
                    (weapon.proficient && !isWeaponImprovisedGrip(weapon)
                      ? proficiency
                      : 0)
                  const attack = character.getEffectiveWeaponAttackBonus(
                    weapon,
                    baseAttack,
                  )
                  const damageBonus = character.getEffectiveWeaponDamageBonus(
                    weapon,
                    character.getEffectiveAttributeModifier(attribute),
                  )

                  return (
                    <CompactWeaponTile
                      key={`${weapon.id}-${index}`}
                      weapon={weapon}
                      attack={attack}
                      damageBonus={damageBonus}
                      onClick={() => setHandDialog({ itemId: weapon.id })}
                    />
                  )
                })
              ) : (
                <CompactUnarmedTile character={character} />
              )}
            </div>''',
    "minimal weapon list and unarmed fallback",
)
text = replace_once(
    text,
    '''      </CompactSection>
    </div>
  )
}''',
    '''      </CompactSection>

      <HandItemActionsDialog
        character={character}
        state={handDialog}
        onClose={() => setHandDialog(null)}
      />
    </div>
  )
}''',
    "minimal dialog render",
)

compact_cards = '''function CompactWeaponTile({
  weapon,
  attack,
  damageBonus,
  onClick,
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
  onClick: () => void
}) {
  const die = getWeaponDamageDie(weapon) ?? weapon.damage
  const damage = `${die.quantity}${die.sides}${
    damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""
  }`
  const hands = weapon.wieldedTwoHanded ? 2 : 1

  return (
    <button
      type="button"
      title="Abrir opções de empunhadura, guardar ou largar"
      onClick={onClick}
      className="min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex min-w-0 items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-textMuted">
        <span className="truncate">
          {weapon.name || "Arma"}
          {isWeaponImprovisedGrip(weapon) ? " · imp." : ""}
        </span>
        <span className="shrink-0 rounded-full border border-accentBorder bg-accentBg px-1 py-0.5 text-[9px] font-semibold text-accent">
          {hands}M
        </span>
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{formatSigned(attack)}</div>
      <div className="text-[10px] font-medium text-textMuted">{damage}</div>
    </button>
  )
}

function CompactUnarmedTile({
  character,
}: {
  character: CharacterTemplate
}) {
  const profile = getUnarmedAttackProfile(character)

  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
      <div className="truncate text-[10px] uppercase tracking-wide text-textMuted">
        Ataque desarmado
        {profile.monkLevel > 0 ? ` · M${profile.monkLevel}` : ""}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">
        {formatSigned(profile.attack)}
      </div>
      <div className="text-[10px] font-medium text-textMuted">
        {formatUnarmedDamage(profile)}
      </div>
    </div>
  )
}'''
text = replace_regex(
    text,
    r'''function CompactWeaponTile\(.*?\n\}\n\n(?=function DerivedTile)''',
    compact_cards + "\n\n",
    "minimal weapon and unarmed cards",
)
write(path, text)


# ---------------------------------------------------------------------------
# Equipment weapon section exposes one/two-hand controls for every weapon.
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/EquipmentWeaponsSection.tsx"
text = read(path)
text = replace_once(
    text,
    '''            const supportsGripChoice = versatile || weapon.twoHanded === true''',
    '''            const supportsGripChoice = true''',
    "all weapons support grip choice",
)
text = replace_once(
    text,
    '''                          {weapon.twoHanded
                            ? "Uma mão — improvisada"
                            : "Uma mão"}''',
    '''                          {weapon.twoHanded
                            ? "Uma mão — improvisada"
                            : "Uma mão"}''',
    "keep one hand label",
)
write(path, text)


checks = {
    "src/models/items/item.ts": ["heldHands?: 1 | 2"],
    "src/models/items/equipment/Weapon.ts": [
        "if (weapon.wieldedTwoHanded === true) return 2",
    ],
    "src/models/characters/characterHands.ts": [
        "setHandOccupantHandsWithRules",
        "findHandOccupantByItemId",
    ],
    "src/models/characters/characterEquipmentInteractions.ts": [
        "hands?: 1 | 2",
        "heldHands: hands",
    ],
    "src/features/characters/inventory/equipItemDialog.tsx": [
        "Segurar com duas mãos",
        'destination: { type: "hand", hands: 2 }',
    ],
    "src/features/characters/characterSheet/weaponAttackCardActionsDialog.tsx": [
        "Uma mão",
        "Duas mãos",
        "Guardar",
        "Largar no chão",
    ],
    "src/models/characters/unarmedAttack.ts": [
        "getMonkMartialArtsDie",
        'sides: "d10"',
    ],
    "src/features/characters/characterSheet/attributeCalculators.tsx": [
        "UnarmedAttackCard",
        "HandItemActionsDialog",
    ],
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": [
        "CompactUnarmedTile",
        "HandItemActionsDialog",
    ],
}

for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
