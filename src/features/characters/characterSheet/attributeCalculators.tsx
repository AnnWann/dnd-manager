import { useState, type ReactNode } from "react"
import { Crosshair, ShieldCheck, Sparkles, Swords } from "lucide-react"

import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  formatUnarmedDamage,
  getUnarmedAttackProfile,
} from "../../../models/characters/unarmedAttack"
import {
  getWeaponAttackAttribute,
  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,
} from "../../../models/items/equipment/Weapon"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import { SpellcastingHandsWarning } from "./spellcastingHandsWarning"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "./weaponAttackCardActionsDialog"

type Props = {
  character: CharacterTemplate
}

const SPELLCASTING_ATTRIBUTES: Attribute[] = ["int", "wis", "cha"]

export function AttributeCalculators({ character }: Props) {
  const [handDialog, setHandDialog] =
    useState<HandItemActionsDialogState | null>(null)
  const proficiencyBonus = character.getProficiencyBonus()
  const weapons = character.get("equipment").weapons

  function getModifier(attribute: Attribute): number {
    return character.getEffectiveAttributeModifier(attribute)
  }

  function getWeaponAttack(weapon: Weapon): number {
    const attribute = getWeaponAttackAttribute(weapon)
    const proficiency =
      weapon.proficient && !isWeaponImprovisedGrip(weapon)
        ? proficiencyBonus
        : 0
    return character.getEffectiveWeaponAttackBonus(
      weapon,
      getModifier(attribute) + proficiency,
    )
  }

  function getWeaponDamage(weapon: Weapon): number {
    const attribute = getWeaponAttackAttribute(weapon)
    return character.getEffectiveWeaponDamageBonus(weapon, getModifier(attribute))
  }

  function getSpellAttack(attribute: Attribute): number {
    return character.getEffectiveSpellAttackBonus(
      attribute,
      getModifier(attribute) + proficiencyBonus,
    )
  }

  function getSpellDc(attribute: Attribute): number {
    return character.getEffectiveSpellSaveDc(
      attribute,
      8 + getModifier(attribute) + proficiencyBonus,
    )
  }

  function getAbilityDc(attribute: Attribute): number {
    return character.getEffectiveAbilitySaveDc(
      attribute,
      8 + getModifier(attribute) + proficiencyBonus,
    )
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-textH">Ataques e CDs</h2>
          <p className="mt-1 text-xs text-textMuted">
            Armas equipadas e valores mágicos derivados, com bônus globais,
            específicos e limitados por atributo.
          </p>
        </div>
        <div className="rounded-lg border border-accentBorder bg-accentBg px-2.5 py-1 text-xs font-semibold text-textH">
          Proficiência {formatSigned(proficiencyBonus)}
        </div>
      </div>

      <div className="grid gap-4">
        <SpellcastingHandsWarning character={character} />

        <CalculatorGroup
          icon={<Swords className="h-4 w-4" />}
          title="Armas equipadas"
          description="Cada valor usa a arma, seu atributo, proficiência e bônus de ataque com arma aplicáveis."
        >
          <div className="grid gap-2 sm:grid-cols-2">
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
          </div>
        </CalculatorGroup>

        <CalculatorGroup
          icon={<Sparkles className="h-4 w-4" />}
          title="Conjuração"
          description="Ataque mágico e CD de magia usam apenas bônus globais, mágicos e do atributo correspondente."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {SPELLCASTING_ATTRIBUTES.map((attribute) => (
              <SpellcastingCard
                key={attribute}
                attribute={attribute}
                modifier={getModifier(attribute)}
                spellAttack={getSpellAttack(attribute)}
                spellDc={getSpellDc(attribute)}
              />
            ))}
          </div>
        </CalculatorGroup>

        <CalculatorGroup
          icon={<ShieldCheck className="h-4 w-4" />}
          title="CD de habilidades por atributo"
          description="8 + atributo + proficiência, com bônus globais e de CD de habilidade correspondentes."
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
            {ATTRIBUTE_KEYS.map((attribute) => (
              <DcCard
                key={attribute}
                attribute={attribute}
                dc={getAbilityDc(attribute)}
              />
            ))}
          </div>
        </CalculatorGroup>
      </div>

      <HandItemActionsDialog
        character={character}
        state={handDialog}
        onClose={() => setHandDialog(null)}
      />
    </section>
  )
}

function CalculatorGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-bg-subtle text-accent">
          {icon}
        </span>
        <div>
          <div className="text-xs font-semibold text-textH">{title}</div>
          <div className="text-[11px] text-textMuted">{description}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function WeaponAttackCard({
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
}

function SpellcastingCard({
  attribute,
  modifier,
  spellAttack,
  spellDc,
}: {
  attribute: Attribute
  modifier: number
  spellAttack: number
  spellDc: number
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="text-xs font-bold text-textH">{attributeShort(attribute)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <DerivedValue label="Mod." value={formatSigned(modifier)} />
        <DerivedValue label="Ataque" value={formatSigned(spellAttack)} />
        <DerivedValue label="CD" value={String(spellDc)} />
      </div>
    </div>
  )
}

function DcCard({ attribute, dc }: { attribute: Attribute; dc: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {attributeShort(attribute)}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{dc}</div>
    </div>
  )
}

function DerivedValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      <div className="mt-0.5 text-base font-bold text-textH">{value}</div>
    </div>
  )
}
