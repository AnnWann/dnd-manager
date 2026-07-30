import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { ATTRIBUTES, DIE_SIDES } from "../../../contexts/consts"
import type { Ability } from "../../../models/abilities/Ability"
import type { Bonus } from "../../../models/bonuses/Bonus"
import type { Die, DieSides } from "../../../models/dice/Die"
import type { Armor } from "../../../models/items/equipment/Armor"
import type {
  Equipment,
  EquipmentSpellGrant,
} from "../../../models/items/equipment/EquipmentSlot"
import { withShieldDefaults as withShieldModelDefaults } from "../../../models/items/equipment/Shield"
import {
  WEAPON_PROPERTIES,
  hasWeaponProperty,
  type Weapon,
  type WeaponPropertyId,
} from "../../../models/items/equipment/Weapon"
import type { EquipSlot, Itemmable } from "../../../models/items/item"
import type { Attribute } from "../../../models/sheet/Attribute"
import { AbilityDialog } from "../abilities/abilityDialog"
import {
  GrantedSpellsEditor,
  type EditableSpellGrant,
} from "../magic/grantedSpellsEditor"
import { EquipmentBonusesFields } from "./equipmentBonusFields"

const CONFIGURABLE_WEAPON_PROPERTIES = Object.values(WEAPON_PROPERTIES)

export function EquipmentFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  return (
    <>
      <div className="grid gap-2 md:col-span-3">
        <label className="text-xs text-text">Slot</label>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            ["armor", "Armadura"],
            ["shield", "Escudo"],
            ["helmet", "Capacete"],
            ["gloves", "Luvas"],
            ["boots", "Botas"],
            ["weapon", "Arma"],
            ["ring", "Anel"],
            ["necklace", "Colar"],
            ["cape", "Capa"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                item.equipSlot === value
                  ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                  : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
              }
              onClick={() =>
                onUpdate((current) =>
                  withEquipmentDefaults(current, value as EquipSlot),
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {item.equipSlot === "armor" ? (
        <div className="grid gap-2 md:col-span-3">
          <label className="text-xs text-text">Tipo de armadura</label>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["light", "Leve"],
              ["medium", "Média"],
              ["heavy", "Pesada"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  (item as Partial<Armor>).armorType === value
                    ? "rounded-md border border-accentBorder bg-textH px-2 py-2 text-xs font-medium text-background"
                    : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
                }
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    armorType: value as Armor["armorType"],
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {item.equipSlot === "weapon" ? (
        <WeaponFields item={item} onUpdate={onUpdate} />
      ) : null}

      <EquipmentBonusesFields item={item} onUpdate={onUpdate} />
      <EquipmentAbilitiesFields item={item} onUpdate={onUpdate} />
      <EquipmentSpellsFields item={item} onUpdate={onUpdate} />
    </>
  )
}

export function WeaponFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const weapon = item as Partial<Weapon>
  const versatile = hasWeaponProperty(weapon, "versatile")
  const ownAttackBonus = getSignedOwnBonus(weapon.bonuses?.attack?.bonus)
  const ownDamageBonus = getSignedOwnBonus(weapon.bonuses?.damage?.bonus)

  function setOwnWeaponBonus(
    target: "attack" | "damage",
    value: number,
  ) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment
      const bonuses = { ...(currentEquipment.bonuses ?? {}) }

      if (value === 0) {
        delete bonuses[target]
      } else {
        bonuses[target] = {
          type: "equipment",
          bonus: {
            type: value < 0 ? "sub" : "add",
            value: Math.abs(value),
          },
        }
      }

      return {
        ...current,
        bonuses,
      }
    })
  }

  function toggleProperty(propertyId: WeaponPropertyId, enabled: boolean) {
    onUpdate((current) => {
      const currentWeapon = current as Partial<Weapon>
      let properties = (currentWeapon.properties ?? []).filter(
        (property) => property.id !== propertyId,
      )
      const baseDamage = currentWeapon.damage ?? {
        quantity: 1,
        sides: "d6" as DieSides,
      }

      if (propertyId === "two-handed") {
        properties = properties.filter((property) => property.id !== "versatile")
        if (enabled) properties.push(WEAPON_PROPERTIES["two-handed"])

        return {
          ...current,
          properties,
          twoHanded: undefined,
          wieldedTwoHanded: enabled,
          versatileDamage: undefined,
        }
      }

      if (propertyId === "versatile") {
        properties = properties.filter((property) => property.id !== "two-handed")
        if (enabled) properties.push(WEAPON_PROPERTIES.versatile)

        return {
          ...current,
          properties,
          twoHanded: undefined,
          wieldedTwoHanded: enabled
            ? (currentWeapon.wieldedTwoHanded ?? false)
            : false,
          versatileDamage: enabled
            ? (currentWeapon.versatileDamage ?? { ...baseDamage })
            : undefined,
        }
      }

      if (enabled) properties.push(WEAPON_PROPERTIES[propertyId])

      return {
        ...current,
        properties,
      }
    })
  }

  return (
    <div className="grid gap-3 md:col-span-3 md:grid-cols-4">
      <WeaponDamageFields
        title={versatile ? "Dano com uma mão" : "Dano"}
        die={weapon.damage ?? { quantity: 1, sides: "d6" }}
        onChange={(damage) =>
          onUpdate((current) => ({
            ...current,
            damage,
          }))
        }
      />

      <div className="grid gap-2">
        <label className="text-xs text-text">Atributo</label>
        <Select
          value={weapon.modifierAttribute ?? "str"}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              modifierAttribute: event.target.value as Attribute,
            }))
          }
        >
          {ATTRIBUTES.map((attribute) => (
            <option key={attribute.value} value={attribute.value}>
              {attribute.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Bônus próprio de ataque</label>
        <Input
          type="number"
          value={ownAttackBonus}
          onChange={(event) =>
            setOwnWeaponBonus("attack", Number(event.target.value) || 0)
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">Bônus próprio de dano</label>
        <Input
          type="number"
          value={ownDamageBonus}
          onChange={(event) =>
            setOwnWeaponBonus("damage", Number(event.target.value) || 0)
          }
        />
      </div>

      <label className="flex items-center gap-2 self-end text-xs text-text">
        <input
          type="checkbox"
          checked={weapon.proficient ?? false}
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              proficient: event.target.checked,
            }))
          }
        />
        Proficiente
      </label>

      {versatile ? (
        <WeaponDamageFields
          title="Dano com duas mãos"
          die={
            weapon.versatileDamage ??
            weapon.damage ?? { quantity: 1, sides: "d6" }
          }
          onChange={(versatileDamage) =>
            onUpdate((current) => ({
              ...current,
              versatileDamage,
            }))
          }
        />
      ) : null}

      <div className="grid gap-2 md:col-span-4">
        <div>
          <div className="text-xs font-medium text-textH">Propriedades</div>
          <div className="mt-0.5 text-[11px] text-textMuted">
            Selecione todas as propriedades aplicáveis à arma.
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIGURABLE_WEAPON_PROPERTIES.map((property) => (
            <label
              key={property.id}
              title={property.desc}
              className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-2 text-xs text-text"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={hasWeaponProperty(weapon, property.id)}
                onChange={(event) =>
                  toggleProperty(property.id, event.target.checked)
                }
              />
              <span>
                <span className="font-medium text-textH">{property.name}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-textMuted">
                  {property.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function getSignedOwnBonus(bonus: Bonus | undefined): number {
  if (!bonus) return 0
  if (bonus.type === "sub") return -Math.abs(bonus.value)
  return bonus.value
}

function WeaponDamageFields({
  title,
  die,
  onChange,
}: {
  title: string
  die: Die
  onChange: (die: Die) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:col-span-2">
      <div className="grid gap-2">
        <label className="text-xs text-text">{title}: qtd. dados</label>
        <Input
          type="number"
          min={1}
          value={die.quantity}
          onChange={(event) =>
            onChange({
              ...die,
              quantity: Number(event.target.value) || 1,
            })
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-text">{title}: dado</label>
        <Select
          value={die.sides}
          onChange={(event) =>
            onChange({
              ...die,
              sides: event.target.value as DieSides,
            })
          }
        >
          {DIE_SIDES.map((side) => (
            <option key={side} value={side}>
              {side}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

function EquipmentAbilitiesFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment
  const [creating, setCreating] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const editingAbility =
    editingIndex === null
      ? null
      : equipment.abilities?.[editingIndex] ?? null

  function saveAbility(ability: Ability) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment
      const abilities = [...(currentEquipment.abilities ?? [])]

      if (editingIndex === null) abilities.push(ability)
      else abilities[editingIndex] = ability

      return {
        ...currentEquipment,
        abilities,
      }
    })

    setCreating(false)
    setEditingIndex(null)
  }

  return (
    <div className="grid gap-3 md:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-textH">Habilidades</div>
          <div className="mt-0.5 text-[11px] text-textMuted">
            Habilidades concedidas enquanto o item estiver equipado.
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          + Habilidade
        </Button>
      </div>

      {(equipment.abilities ?? []).map((ability, index) => (
        <div
          key={ability.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle p-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-textH">
              {ability.name || "Habilidade sem nome"}
            </div>
            <div className="mt-0.5 text-xs text-textMuted">
              {ability.grantedSpells?.length
                ? `${ability.grantedSpells.length} magia(s) concedida(s)`
                : ability.usage
                  ? `${ability.usage.max - ability.usage.used}/${ability.usage.max} usos`
                  : "Sem contador"}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingIndex(index)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  abilities: ((current as Equipment).abilities ?? []).filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                }))
              }
            >
              Remover
            </Button>
          </div>
        </div>
      ))}

      <AbilityDialog
        open={creating || editingIndex !== null}
        ability={editingAbility}
        onClose={() => {
          setCreating(false)
          setEditingIndex(null)
        }}
        onSave={saveAbility}
      />
    </div>
  )
}

function EquipmentSpellsFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment

  return (
    <div className="md:col-span-3">
      <GrantedSpellsEditor
        variant="equipment"
        grants={(equipment.spells ?? []) as EditableSpellGrant[]}
        onChange={(grants) =>
          onUpdate((current) => ({
            ...current,
            spells: grants as EquipmentSpellGrant[],
          }))
        }
      />
    </div>
  )
}

export function withEquipmentDefaults(
  item: Itemmable,
  equipSlot: EquipSlot,
): Itemmable {
  if (equipSlot === "shield") return withShieldModelDefaults(item)

  const base = {
    ...item,
    kind: "equipment" as const,
    equippable: true,
    equipSlot,
    pocketable: equipSlot === "weapon" || equipSlot === "ring",
  }

  if (equipSlot === "weapon") return withWeaponDefaults(base)

  if (equipSlot === "armor") {
    return {
      ...base,
      armorType: (item as Partial<Armor>).armorType ?? "light",
    }
  }

  return {
    ...base,
    armorType: undefined,
  }
}

function withWeaponDefaults(item: Itemmable): Itemmable {
  const weapon = item as Partial<Weapon>
  const properties = [...(weapon.properties ?? [])]
  const versatile =
    properties.some((property) => property.id === "versatile") ||
    Boolean(weapon.versatileDamage)

  if (versatile && !properties.some((property) => property.id === "versatile")) {
    properties.push(WEAPON_PROPERTIES.versatile)
  }

  if (
    !versatile &&
    weapon.twoHanded &&
    !properties.some((property) => property.id === "two-handed")
  ) {
    properties.push(WEAPON_PROPERTIES["two-handed"])
  }

  const damage = weapon.damage ?? {
    quantity: 1,
    sides: "d6" as DieSides,
  }

  return {
    ...item,
    properties: properties.filter((property) =>
      versatile ? property.id !== "two-handed" : property.id !== "versatile",
    ),
    twoHanded: versatile ? false : (weapon.twoHanded ?? false),
    wieldedTwoHanded: versatile
      ? (weapon.wieldedTwoHanded ?? false)
      : (weapon.twoHanded ?? false),
    damage,
    versatileDamage: versatile
      ? (weapon.versatileDamage ?? { ...damage })
      : undefined,
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  }
}
