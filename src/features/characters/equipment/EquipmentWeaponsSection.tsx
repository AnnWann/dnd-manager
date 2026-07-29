import { Crosshair, Hand, Scale, Sparkles, Swords } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatBonusName, formatBonusValue } from "../../../lib/formatBonus"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getUsedArmsIncludingShield } from "../../../models/characters/characterEquipmentInteractions"
import { setWeaponGripWithRules } from "../../../models/characters/characterHands"
import {
  getWeaponAttackAttribute,
  getWeaponDamageDie,
  getWeaponHandsUsed,
  isVersatileWeapon,
  isWeaponImprovisedGrip,
  type Weapon,
} from "../../../models/items/equipment/Weapon"
import { EquipmentFeaturesList } from "./equipmentFeaturesList"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

type DisplayBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "saveDcBonus"
  | "damageBonus"
  | "speed"

const NORMAL_BONUS_KEYS: DisplayBonusKey[] = [
  "armorClass",
  "initiative",
  "maxHp",
  "temporaryHp",
  "passivePerception",
  "attackBonus",
  "saveDcBonus",
  "damageBonus",
  "speed",
]

const SCOPED_BONUS_KEYS = [
  "weaponAttackBonus",
  "spellAttackBonus",
  "spellSaveDcBonus",
  "abilitySaveDcBonus",
] as const

function formatDie(die: Weapon["damage"] | undefined) {
  if (!die) return "—"
  return `${die.quantity}${die.sides}`
}

function weaponAttackBonus(character: CharacterTemplate, weapon: Weapon) {
  const modifierAttribute = getWeaponAttackAttribute(weapon)

  const attributeMod = character.getEffectiveAttributeModifier(
    modifierAttribute,
  )

  const proficiency =
    weapon.proficient && !isWeaponImprovisedGrip(weapon)
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
  const usedHands = getUsedArmsIncludingShield(character)
  const totalHands = character.get("sheet").arms

  function unequipWeapon(index: number) {
    updateCharacter(character.get("id"), (c) => c.unequipWeapon(index))
  }

  function setWeaponGrip(index: number, wieldedTwoHanded: boolean) {
    updateCharacter(character.get("id"), (current) =>
      setWeaponGripWithRules(current, index, wieldedTwoHanded),
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-textH">
            <Swords className="h-4 w-4 text-accent" />
            Armas
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Equipamentos empunhados e seus recursos ativos.
          </div>
        </div>
        <div className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-text">
          {usedHands}/{totalHands} mãos
        </div>
      </div>

      {weapons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
          Nenhuma arma equipada.
        </div>
      ) : (
        <div className="grid gap-3">
          {weapons.map((weapon, index) => {
            const modifierAttribute = getWeaponAttackAttribute(weapon)
            const attackBonus = weaponAttackBonus(character, weapon)
            const damageBonus = weaponDamageBonus(character, weapon)
            const damageText = formatDie(getWeaponDamageDie(weapon))
            const handUsage = getWeaponHandsUsed(weapon)
            const versatile = isVersatileWeapon(weapon)
            const improvised = isWeaponImprovisedGrip(weapon)
            const supportsGripChoice = versatile || weapon.twoHanded === true
            const canUseTwoHands =
              usedHands - handUsage + 2 <= totalHands

            return (
              <article
                key={`${weapon.id}-${index}`}
                className="overflow-hidden rounded-xl border border-border bg-bg-subtle shadow-theme-sm"
              >
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-textH">
                        {weapon.name || "Arma sem nome"}
                      </h3>
                      <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {weapon.proficient ? "Proficiente" : "Não proficiente"}
                      </span>
                      <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-textMuted">
                        {improvised
                          ? "Improvisada · uma mão"
                          : versatile
                            ? `Versátil · ${handUsage} ${handUsage === 1 ? "mão" : "mãos"}`
                            : handUsage === 2
                              ? "Duas mãos"
                              : "Uma mão"}
                      </span>
                    </div>

                    {weapon.desc?.trim() ? (
                      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-xs leading-5 text-textMuted">
                        {weapon.desc}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {supportsGripChoice ? (
                      <div className="flex rounded-lg border border-border bg-bg p-0.5">
                        <button
                          type="button"
                          className={
                            !weapon.wieldedTwoHanded
                              ? "rounded-md bg-accentBg px-2.5 py-1.5 text-xs font-semibold text-textH"
                              : "rounded-md px-2.5 py-1.5 text-xs text-textMuted"
                          }
                          onClick={() => setWeaponGrip(index, false)}
                        >
                          {weapon.twoHanded
                            ? "Uma mão — improvisada"
                            : "Uma mão"}
                        </button>
                        <button
                          type="button"
                          disabled={!canUseTwoHands}
                          title={
                            canUseTwoHands
                              ? "Empunhar com duas mãos"
                              : "Não há uma mão livre"
                          }
                          className={
                            weapon.wieldedTwoHanded
                              ? "rounded-md bg-accentBg px-2.5 py-1.5 text-xs font-semibold text-textH"
                              : "rounded-md px-2.5 py-1.5 text-xs text-textMuted disabled:cursor-not-allowed disabled:opacity-40"
                          }
                          onClick={() => setWeaponGrip(index, true)}
                        >
                          Duas mãos
                        </button>
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unequipWeapon(index)}
                    >
                      Desequipar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
                  <WeaponStat
                    icon={<Crosshair className="h-4 w-4" />}
                    label="Ataque"
                    value={formatSigned(attackBonus)}
                  />
                  <WeaponStat
                    icon={<Swords className="h-4 w-4" />}
                    label="Dano"
                    value={`${damageText}${damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}`}
                  />
                  <WeaponStat
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Atributo"
                    value={attributeShort(modifierAttribute)}
                  />
                  <WeaponStat
                    icon={handUsage === 2 ? <Hand className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                    label="Peso"
                    value={String(weapon.weight ?? 0)}
                  />
                </div>

                <div className="p-4">
                  {weapon.properties?.length ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
                        Propriedades
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {weapon.properties.map((property) => (
                          <span
                            key={property.id}
                            title={property.desc}
                            className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text"
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
                        const currentWeapons = [...equipment.weapons]
                        currentWeapons[index] = updater(currentWeapons[index])
                        return c.with("equipment", {
                          ...equipment,
                          weapons: currentWeapons,
                        })
                      })
                    }
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function WeaponStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-bg px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>

      <div className="mt-1 text-base font-bold text-textH">
        {value}
      </div>
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

  for (const key of SCOPED_BONUS_KEYS) {
    for (const entry of bonuses[key] ?? []) {
      const scope = entry.attribute
        ? ` ${entry.attribute.toUpperCase()}`
        : " — todos"
      rows.push(`${formatBonusName(key)}${scope}: ${formatBonusValue(entry.bonus)}`)
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
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
        Bônus
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row}
            className="rounded-full bg-accentBg px-2.5 py-1 text-xs font-medium text-textH"
          >
            {row}
          </span>
        ))}
      </div>
    </div>
  )
}
