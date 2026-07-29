import type { ReactNode } from "react"
import { Crosshair, ShieldCheck, Sparkles, Swords } from "lucide-react"

import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"

type Props = {
  character: CharacterTemplate
}

const SPELLCASTING_ATTRIBUTES: Attribute[] = [
  "int",
  "wis",
  "cha",
]

const WEAPON_ATTRIBUTES: Attribute[] = [
  "str",
  "dex",
]

export function AttributeCalculators({
  character,
}: Props) {
  const proficiencyBonus =
    character.getProficiencyBonus()

  function getModifier(attribute: Attribute): number {
    return character.getEffectiveAttributeModifier(attribute)
  }

  function getProficientAttack(attribute: Attribute): number {
    return character.getEffectiveAttackBonus(
      getModifier(attribute) + proficiencyBonus,
    )
  }

  function getDc(attribute: Attribute): number {
    return character.getEffectiveSaveDc(
      8 + getModifier(attribute) + proficiencyBonus,
    )
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-textH">
            Ataques e CDs
          </h2>

          <p className="mt-1 text-xs text-textMuted">
            Valores derivados dos atributos e da proficiência, incluindo bônus ativos de equipamentos, habilidades e condições.
          </p>
        </div>

        <div className="rounded-lg border border-accentBorder bg-accentBg px-2.5 py-1 text-xs font-semibold text-textH">
          Proficiência {formatSigned(proficiencyBonus)}
        </div>
      </div>

      <div className="grid gap-4">
        <CalculatorGroup
          icon={<Swords className="h-4 w-4" />}
          title="Ataques com arma"
          description="Ataque proficiente com bônus gerais ativos; bônus específicos da arma entram no ataque real."
        >
          <div className="grid grid-cols-2 gap-2">
            {WEAPON_ATTRIBUTES.map((attribute) => (
              <AttackCard
                key={attribute}
                attribute={attribute}
                modifier={getModifier(attribute)}
                attack={getProficientAttack(attribute)}
              />
            ))}
          </div>
        </CalculatorGroup>

        <CalculatorGroup
          icon={<Sparkles className="h-4 w-4" />}
          title="Conjuração"
          description="Modificador, ataque mágico e CD com bônus ativos."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {SPELLCASTING_ATTRIBUTES.map((attribute) => (
              <SpellcastingCard
                key={attribute}
                attribute={attribute}
                modifier={getModifier(attribute)}
                spellAttack={getProficientAttack(attribute)}
                spellDc={getDc(attribute)}
              />
            ))}
          </div>
        </CalculatorGroup>

        <CalculatorGroup
          icon={<ShieldCheck className="h-4 w-4" />}
          title="CD por atributo"
          description="8 + modificador do atributo + proficiência + bônus ativos de CD."
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
            {ATTRIBUTE_KEYS.map((attribute) => (
              <DcCard
                key={attribute}
                attribute={attribute}
                dc={getDc(attribute)}
              />
            ))}
          </div>
        </CalculatorGroup>
      </div>
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
          <div className="text-xs font-semibold text-textH">
            {title}
          </div>

          <div className="text-[11px] text-textMuted">
            {description}
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}

function AttackCard({
  attribute,
  modifier,
  attack,
}: {
  attribute: Attribute
  modifier: number
  attack: number
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-textH">
          {attributeShort(attribute)}
        </span>

        <Crosshair className="h-3.5 w-3.5 text-textMuted" />
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-textMuted">
            Ataque
          </div>

          <div className="text-xl font-bold text-textH">
            {formatSigned(attack)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-textMuted">
            Mod.
          </div>

          <div className="text-sm font-semibold text-text">
            {formatSigned(modifier)}
          </div>
        </div>
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
      <div className="text-xs font-bold text-textH">
        {attributeShort(attribute)}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <DerivedValue
          label="Mod."
          value={formatSigned(modifier)}
        />

        <DerivedValue
          label="Ataque"
          value={formatSigned(spellAttack)}
        />

        <DerivedValue
          label="CD"
          value={String(spellDc)}
        />
      </div>
    </div>
  )
}

function DcCard({
  attribute,
  dc,
}: {
  attribute: Attribute
  dc: number
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {attributeShort(attribute)}
      </div>

      <div className="mt-1 text-lg font-bold text-textH">
        {dc}
      </div>
    </div>
  )
}

function DerivedValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-textMuted">
        {label}
      </div>

      <div className="mt-0.5 text-base font-bold text-textH">
        {value}
      </div>
    </div>
  )
}