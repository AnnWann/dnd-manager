import { Button } from "../../../components/ui/Button"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import { EquipmentFeaturesList } from "./equipmentFeaturesList"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "speed"

const NORMAL_BONUS_KEYS: NormalBonusKey[] = [
  "armorClass",
  "initiative",
  "maxHp",
  "temporaryHp",
  "passivePerception",
  "attackBonus",
  "speed",
]

function formatDie(die: Weapon["damage"] | undefined) {
  if (!die) return "—"
  return `${die.quantity}${die.sides}`
}

function weaponAttackBonus(character: CharacterTemplate, weapon: Weapon) {
  const modifierAttribute = weapon.modifierAttribute ?? "str"

  const attributeMod = character.getEffectiveAttributeModifier(
    modifierAttribute,
  )

  const proficiency = weapon.proficient
    ? character.getProficiencyBonus()
    : 0

  return character.getEffectiveWeaponAttackBonus(
    weapon,
    attributeMod + proficiency,
  )
}

function weaponDamageBonus(character: CharacterTemplate, weapon: Weapon) {
  const modifierAttribute = weapon.modifierAttribute ?? "str"

  const attributeMod = character.getEffectiveAttributeModifier(
    modifierAttribute,
  )

  return character.getEffectiveWeaponDamageBonus(
    weapon,
    attributeMod,
  )
}

export function EquipmentWeaponsSection({
  character,
  updateCharacter,
}: Props) {
  const weapons = character.get("equipment").weapons

  function unequipWeapon(index: number) {
    updateCharacter(character.get("id"), (c) =>
      c.unequipWeapon(index),
    )
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3">
        <div className="text-sm font-medium text-textH">
          Armas
        </div>

        <div className="text-xs text-text">
          {character.getUsedArms()}/{character.get("sheet").arms} braços usados
        </div>
      </div>

      {weapons.length === 0 ? (
        <div className="text-xs text-text">
          Nenhuma arma equipada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {weapons.map((weapon, index) => {
            const modifierAttribute = weapon.modifierAttribute ?? "str"
            const attackBonus = weaponAttackBonus(character, weapon)
            const damageBonus = weaponDamageBonus(character, weapon)
            const damageText = formatDie(weapon.damage)

            return (
              <div
                key={`${weapon.id}-${index}`}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-textH">
                      {weapon.name || "Arma sem nome"}
                    </div>

                    <div className="mt-1 text-xs text-text">
                      Dano base: {damageText}
                      {" • "}
                      Atributo: {attributeShort(modifierAttribute)}
                      {" • "}
                      {weapon.proficient ? "Proficiente" : "Não proficiente"}
                    </div>

                    <div className="mt-1 text-xs text-text">
                      Ataque: {formatSigned(attackBonus)}
                      {" • "}
                      Dano: {damageText}
                      {damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}
                    </div>

                    <div className="mt-1 text-xs text-text">
                      Peso: {weapon.weight ?? 0}
                      {" • "}
                      {weapon.twoHanded ? "Duas mãos" : "Uma mão"}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => unequipWeapon(index)}
                  >
                    Desequipar
                  </Button>
                </div>

                {weapon.desc?.trim() ? (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-textH">
                      Descrição
                    </div>

                    <div className="mt-1 whitespace-pre-wrap text-xs text-text">
                      {weapon.desc}
                    </div>
                  </div>
                ) : null}

                {weapon.properties?.length ? (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-textH">
                      Propriedades
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {weapon.properties.map((property) => (
                        <span
                          key={property.id}
                          title={property.desc}
                          className="rounded-md border border-border px-2 py-1 text-xs text-text"
                        >
                          {property.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <WeaponBonusList weapon={weapon} />
                
                <EquipmentFeaturesList
                  equipment={weapon}
                  onUpdate={(updater) =>
                    updateCharacter(character.get("id"), (c) => {
                      const equipment = c.get("equipment")
                      const weapons = [...equipment.weapons]

                      weapons[index] = updater(weapons[index])

                      return c.with("equipment", {
                        ...equipment,
                        weapons,
                      })
                    })
                  }
                />

              </div>

              
            )
          })}
        </div>
      )}
    </div>
  )
}

type WeaponBonusListProps = {
  weapon: Weapon
}

function WeaponBonusList({ weapon }: WeaponBonusListProps) {
  const bonuses = weapon.bonuses

  if (!bonuses) return null

  const rows: string[] = []

  for (const key of NORMAL_BONUS_KEYS) {
    const value = bonuses[key]
    if (!Array.isArray(value)) continue

    for (const bonus of value) {
      rows.push(`${formatBonusName(key)}: ${formatBonusValue(bonus)}`)
    }
  }

  for (const entry of bonuses.attribute ?? []) {
    rows.push(
      `Atributo ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  for (const entry of bonuses.attributeModifier ?? []) {
    rows.push(
      `Mod. ${entry.attribute.toUpperCase()}: ${formatBonusValue(
        entry.bonus,
      )}`,
    )
  }

  if (bonuses.attack) {
    rows.push(
      `Ataque da arma: ${formatBonusValue(bonuses.attack.bonus)}`,
    )
  }

  if (bonuses.damage) {
    rows.push(
      `Dano da arma: ${formatBonusValue(bonuses.damage.bonus)}`,
    )
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-textH">
        Bônus
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row}
            className="rounded-md border border-border px-2 py-1 text-xs text-text"
          >
            {row}
          </span>
        ))}
      </div>
    </div>
  )
}