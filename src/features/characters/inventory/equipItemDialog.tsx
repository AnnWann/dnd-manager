import { useEffect, useMemo, useState } from "react"

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
            Escolha onde o item será usado. Segurar um item ocupa uma mão, mas
            não concede os benefícios de armaduras, anéis ou outros espaços
            específicos. Focos arcanos segurados não bloqueiam a conjuração.
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

  if (item.kind === "equipment" && item.equipSlot === "weapon") {
    const weapon = item as Weapon

    options.push({
      key: "weapon-one-hand",
      label: weapon.twoHanded
        ? "Empunhar com uma mão — improvisada"
        : "Empunhar com uma mão",
      description: weapon.twoHanded
        ? "Usa Força para o ataque e causa 1d4 + Força, ignorando as estatísticas próprias da arma."
        : "Usa o dado normal da arma e ocupa uma mão.",
      available: freeHands >= 1,
      destination: { type: "hand", wieldedTwoHanded: false },
    })

    if (weapon.twoHanded || isVersatileWeapon(weapon)) {
      options.push({
        key: "weapon-two-hands",
        label: "Empunhar com duas mãos",
        description: weapon.twoHanded
          ? "Usa normalmente as estatísticas e o dado da arma."
          : "Usa o dado de dano versátil definido para duas mãos.",
        available: freeHands >= 2,
        destination: { type: "hand", wieldedTwoHanded: true },
      })
    }
  } else {
    options.push({
      key: "generic-hand",
      label: item.kind === "focus" ? "Segurar como foco arcano" : "Segurar na mão",
      description:
        item.kind === "focus"
          ? "Ocupa uma mão, ativa o foco e não conta como mão bloqueada para conjuração."
          : "Ocupa uma mão. Benefícios ligados a outro espaço de equipamento não são ativados.",
      available: freeHands >= 1,
      destination: { type: "hand" },
    })
  }

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
