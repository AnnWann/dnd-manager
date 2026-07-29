from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# ---------------------------------------------------------------------------
# Bonus schema
# ---------------------------------------------------------------------------
write(
    "src/models/bonuses/Bonus.ts",
    '''import type { Attribute } from "../sheet/Attribute"

export type Bonus = {
  type: "add" | "sub" | "flat"
  /** Fallback numérico e compatibilidade com bônus antigos. */
  value: number
  /** Fórmula recalculada com as variáveis atuais da ficha. */
  formula?: string
  label?: string
}

export type AttributeScopedBonus = {
  /** Ausente significa todos os atributos válidos para o escopo. */
  attribute?: Attribute
  bonus: Bonus
}

export type BonusCollection = {
  armorClass?: Bonus[]
  initiative?: Bonus[]
  maxHp?: Bonus[]
  temporaryHp?: Bonus[]
  passivePerception?: Bonus[]
  /** Bônus global aplicado a qualquer jogada de ataque. */
  attackBonus?: Bonus[]
  /** Bônus aplicado apenas a ataques com armas. */
  weaponAttackBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a ataques mágicos. */
  spellAttackBonus?: AttributeScopedBonus[]
  /** Bônus global aplicado a qualquer CD calculada. */
  saveDcBonus?: Bonus[]
  /** Bônus aplicado apenas a CDs de magia. */
  spellSaveDcBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a CDs de habilidades e efeitos. */
  abilitySaveDcBonus?: AttributeScopedBonus[]
  damageBonus?: Bonus[]
  speed?: Bonus[]
  attribute?: Array<{
    attribute: Attribute
    bonus: Bonus
  }>
  attributeModifier?: Array<{
    attribute: Attribute
    bonus: Bonus
  }>
  attack?: {
    type: "always" | "equipment" | "conditional"
    condition?: string
    bonus: Bonus
  }
  damage?: {
    type: "always" | "equipment" | "conditional"
    condition?: string
    bonus: Bonus
  }
}

export type NormalBonusKey =
  | "armorClass"
  | "initiative"
  | "maxHp"
  | "temporaryHp"
  | "passivePerception"
  | "attackBonus"
  | "saveDcBonus"
  | "damageBonus"
  | "speed"

export type ScopedBonusKey =
  | "weaponAttackBonus"
  | "spellAttackBonus"
  | "spellSaveDcBonus"
  | "abilitySaveDcBonus"

export type BonusTarget =
  | NormalBonusKey
  | ScopedBonusKey
  | "attribute"
  | "attributeModifier"
''',
)

# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------
path = "src/lib/formatBonus.ts"
text = read(path)
text = replace_once(
    text,
    '    case "attackBonus":\n      return "Ataque"\n    case "saveDcBonus":\n      return "CD"\n',
    '    case "attackBonus":\n      return "Ataque geral"\n    case "weaponAttackBonus":\n      return "Ataque com arma"\n    case "spellAttackBonus":\n      return "Ataque mágico"\n    case "saveDcBonus":\n      return "CD geral"\n    case "spellSaveDcBonus":\n      return "CD de magia"\n    case "abilitySaveDcBonus":\n      return "CD de habilidade"\n',
    "bonus labels",
)
write(path, text)

# ---------------------------------------------------------------------------
# Calculations
# ---------------------------------------------------------------------------
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Bonus, NormalBonusKey } from "../bonuses/Bonus"',
    'import type { Bonus, NormalBonusKey, ScopedBonusKey } from "../bonuses/Bonus"',
    "character stats scoped import",
)

old_helpers = '''export function getEffectiveAttackBonus(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "attackBonus"),
  )
}

export function getEffectiveSaveDc(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "saveDcBonus"),
  )
}
'''
new_helpers = '''export function getScopedCharacterBonuses(
  character: CharacterTemplate,
  key: ScopedBonusKey,
  attribute: Attribute,
): Bonus[] {
  const collect = (
    collection: { bonuses?: Partial<Record<ScopedBonusKey, Array<{ attribute?: Attribute; bonus: Bonus }>>> },
  ) =>
    (collection.bonuses?.[key] ?? [])
      .filter((entry) => !entry.attribute || entry.attribute === attribute)
      .map((entry) => resolveBonus(character, entry.bonus))

  return [
    ...getEquippedItems(character).flatMap(collect),
    ...getActiveAbilities(character).flatMap(collect),
    ...getCharacterConditions(character)
      .filter(isConditionActive)
      .flatMap(collect),
  ]
}

export function getEffectiveAttackBonus(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "attackBonus"),
  )
}

export function getEffectiveSpellAttackBonus(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...getScopedCharacterBonuses(character, "spellAttackBonus", attribute),
  ])
}

export function getEffectiveSaveDc(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "saveDcBonus"),
  )
}

export function getEffectiveSpellSaveDc(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "saveDcBonus"),
    ...getScopedCharacterBonuses(character, "spellSaveDcBonus", attribute),
  ])
}

export function getEffectiveAbilitySaveDc(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "saveDcBonus"),
    ...getScopedCharacterBonuses(character, "abilitySaveDcBonus", attribute),
  ])
}
'''
text = replace_once(text, old_helpers, new_helpers, "scoped calculation helpers")

old_weapon = '''export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined

  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}'''
new_weapon = '''export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined
  const modifierAttribute = weapon.modifierAttribute ?? "str"

  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...getScopedCharacterBonuses(
      character,
      "weaponAttackBonus",
      modifierAttribute,
    ),
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}'''
text = replace_once(text, old_weapon, new_weapon, "scoped weapon attack")
write(path, text)

# ---------------------------------------------------------------------------
# CharacterTemplate API
# ---------------------------------------------------------------------------
path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '  getEffectiveArmorClass,\n  getEffectiveAttackBonus,\n',
    '  getEffectiveAbilitySaveDc,\n  getEffectiveArmorClass,\n  getEffectiveAttackBonus,\n',
    "ability DC import",
)
text = replace_once(
    text,
    '  getEffectivePassivePerception,\n  getEffectiveSaveDc,\n',
    '  getEffectivePassivePerception,\n  getEffectiveSaveDc,\n  getEffectiveSpellAttackBonus,\n  getEffectiveSpellSaveDc,\n',
    "spell scoped imports",
)
text = replace_once(
    text,
    '  getEffectiveAttackBonus(baseValue: number): number {return getEffectiveAttackBonus(this, baseValue)}\n  getEffectiveSaveDc(baseValue: number): number {return getEffectiveSaveDc(this, baseValue)}\n',
    '  getEffectiveAttackBonus(baseValue: number): number {return getEffectiveAttackBonus(this, baseValue)}\n  getEffectiveSpellAttackBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellAttackBonus(this, attribute, baseValue)}\n  getEffectiveSaveDc(baseValue: number): number {return getEffectiveSaveDc(this, baseValue)}\n  getEffectiveSpellSaveDc(attribute: Attribute, baseValue: number): number {return getEffectiveSpellSaveDc(this, attribute, baseValue)}\n  getEffectiveAbilitySaveDc(attribute: Attribute, baseValue: number): number {return getEffectiveAbilitySaveDc(this, attribute, baseValue)}\n',
    "character scoped methods",
)
write(path, text)

# ---------------------------------------------------------------------------
# Full character sheet attacks and DCs
# ---------------------------------------------------------------------------
write(
    "src/features/characters/characterSheet/attributeCalculators.tsx",
    '''import type { ReactNode } from "react"
import { Crosshair, ShieldCheck, Sparkles, Swords } from "lucide-react"

import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Weapon } from "../../../models/items/equipment/Weapon"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"

type Props = {
  character: CharacterTemplate
}

const SPELLCASTING_ATTRIBUTES: Attribute[] = ["int", "wis", "cha"]

export function AttributeCalculators({ character }: Props) {
  const proficiencyBonus = character.getProficiencyBonus()
  const weapons = character.get("equipment").weapons

  function getModifier(attribute: Attribute): number {
    return character.getEffectiveAttributeModifier(attribute)
  }

  function getWeaponAttack(weapon: Weapon): number {
    const attribute = weapon.modifierAttribute ?? "str"
    const proficiency = weapon.proficient ? proficiencyBonus : 0
    return character.getEffectiveWeaponAttackBonus(
      weapon,
      getModifier(attribute) + proficiency,
    )
  }

  function getWeaponDamage(weapon: Weapon): number {
    const attribute = weapon.modifierAttribute ?? "str"
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
        <CalculatorGroup
          icon={<Swords className="h-4 w-4" />}
          title="Armas equipadas"
          description="Cada valor usa a arma, seu atributo, proficiência e bônus de ataque com arma aplicáveis."
        >
          {weapons.length ? (
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
          )}
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
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
}) {
  const attribute = weapon.modifierAttribute ?? "str"
  const die = weapon.damage
  const damage = `${die.quantity}${die.sides}${damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}`

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-textH" title={weapon.name}>
          {weapon.name || "Arma sem nome"}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase text-textMuted">
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
''',
)

# ---------------------------------------------------------------------------
# Minimal character sheet attacks and DCs
# ---------------------------------------------------------------------------
path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\n',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport type { Weapon } from "../../../models/items/equipment/Weapon"\n',
    "minimal weapon import",
)
new_section = '''      <CompactSection title="Ataques e CDs">
        <div className="grid gap-3">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Armas equipadas
            </div>
            {character.get("equipment").weapons.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {character.get("equipment").weapons.map((weapon, index) => {
                  const attribute = weapon.modifierAttribute ?? "str"
                  const baseAttack =
                    character.getEffectiveAttributeModifier(attribute) +
                    (weapon.proficient ? proficiency : 0)
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
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Magias
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["int", "wis", "cha"] as Attribute[]).map((attribute) => {
                const modifier = character.getEffectiveAttributeModifier(attribute)
                return (
                  <div
                    key={attribute}
                    className="rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
                      {attributeShort(attribute)}
                    </div>
                    <div className="mt-1 flex items-baseline justify-center gap-2">
                      <span className="text-sm font-bold text-textH">
                        {formatSigned(
                          character.getEffectiveSpellAttackBonus(
                            attribute,
                            modifier + proficiency,
                          ),
                        )}
                      </span>
                      <span className="text-[10px] text-textMuted">CD</span>
                      <span className="text-sm font-bold text-textH">
                        {character.getEffectiveSpellSaveDc(
                          attribute,
                          8 + modifier + proficiency,
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <span
              key={attribute}
              className="rounded-full border border-border bg-bg px-2 py-1 text-[10px] text-text"
            >
              CD {attributeShort(attribute)}{" "}
              {character.getEffectiveAbilitySaveDc(
                attribute,
                8 + character.getEffectiveAttributeModifier(attribute) + proficiency,
              )}
            </span>
          ))}
        </div>
      </CompactSection>

'''
text = replace_regex(
    text,
    r'      <CompactSection title="Ataques e CDs">.*?      </CompactSection>\n\n(?=      <CompactSection title="Perícias">)',
    new_section,
    "minimal attacks section",
    re.S,
)
insert_before = '''function DerivedTile({ label, value }: { label: string; value: string }) {'''
weapon_tile = '''function CompactWeaponTile({
  weapon,
  attack,
  damageBonus,
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
}) {
  const damage = `${weapon.damage.quantity}${weapon.damage.sides}${
    damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""
  }`

  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center">
      <div className="truncate text-[10px] uppercase tracking-wide text-textMuted" title={weapon.name}>
        {weapon.name || "Arma"}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{formatSigned(attack)}</div>
      <div className="text-[10px] font-medium text-textMuted">{damage}</div>
    </div>
  )
}

'''
text = replace_once(text, insert_before, weapon_tile + insert_before, "minimal weapon tile")
write(path, text)

# ---------------------------------------------------------------------------
# Modern bonus editor
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/equipmentBonusFields.tsx"
text = read(path)
text = replace_once(
    text,
    '  BonusTarget,\n} from "../../../models/bonuses/Bonus"',
    '  BonusTarget,\n  ScopedBonusKey,\n} from "../../../models/bonuses/Bonus"',
    "bonus editor scoped import",
)
text = replace_once(
    text,
    '  { value: "attackBonus", label: "Ataques" },\n  { value: "saveDcBonus", label: "CD de magia e habilidades" },\n',
    '  { value: "attackBonus", label: "Ataques — global" },\n  { value: "weaponAttackBonus", label: "Ataques com arma" },\n  { value: "spellAttackBonus", label: "Ataques mágicos" },\n  { value: "saveDcBonus", label: "CD — global" },\n  { value: "spellSaveDcBonus", label: "CD de magias" },\n  { value: "abilitySaveDcBonus", label: "CD de habilidades" },\n',
    "bonus editor scoped options",
)
text = replace_once(
    text,
    ']\n\nexport function EquipmentBonusesFields',
    ']\n\nconst SCOPED_TARGETS = new Set<BonusTarget>([\n  "weaponAttackBonus",\n  "spellAttackBonus",\n  "spellSaveDcBonus",\n  "abilitySaveDcBonus",\n])\n\nfunction isScopedTarget(target: BonusTarget): target is ScopedBonusKey {\n  return SCOPED_TARGETS.has(target)\n}\n\nexport function EquipmentBonusesFields',
    "bonus editor scoped helper",
)
text = replace_once(
    text,
    '        onAdd={({ target, attribute, bonus }) => {\n          if (target === "attribute" || target === "attributeModifier") {',
    '        onAdd={({ target, attribute, scopeAttribute, bonus }) => {\n          if (target === "attribute" || target === "attributeModifier") {',
    "bonus editor add signature",
)
text = replace_once(
    text,
    '          } else {\n            onChange({\n              ...bonuses,\n              [target]: [...(bonuses[target] ?? []), bonus],\n            })\n          }',
    '          } else if (isScopedTarget(target)) {\n            onChange({\n              ...bonuses,\n              [target]: [\n                ...(bonuses[target] ?? []),\n                { attribute: scopeAttribute, bonus },\n              ],\n            })\n          } else {\n            onChange({\n              ...bonuses,\n              [target]: [...(bonuses[target] ?? []), bonus],\n            })\n          }',
    "bonus editor scoped add branch",
)
text = replace_once(
    text,
    '    const values = bonuses[option.value] ?? []\n    values.forEach((bonus, index) => {',
    '    if (isScopedTarget(option.value)) {\n      const values = bonuses[option.value] ?? []\n      values.forEach((entry, index) => {\n        const scope = entry.attribute\n          ? ` ${entry.attribute.toUpperCase()}`\n          : " — todos os atributos"\n        entries.push({\n          id: `${option.value}-${index}`,\n          label: `${option.label}${scope}: ${formatBonus(entry.bonus)}`,\n          remove: (current) => ({\n            ...current,\n            [option.value]: (current[option.value] ?? []).filter(\n              (_, currentIndex) => currentIndex !== index,\n            ),\n          }),\n        })\n      })\n      continue\n    }\n\n    const values = bonuses[option.value] ?? []\n    values.forEach((bonus, index) => {',
    "bonus editor flatten scoped",
)
text = replace_once(
    text,
    '    attribute: Attribute\n    bonus: Bonus\n',
    '    attribute: Attribute\n    scopeAttribute?: Attribute\n    bonus: Bonus\n',
    "bonus editor callback type",
)
text = replace_once(
    text,
    '  const [attribute, setAttribute] = useState<Attribute>("str")\n',
    '  const [attribute, setAttribute] = useState<Attribute>("str")\n  const [scopeAttribute, setScopeAttribute] = useState<"all" | Attribute>("all")\n',
    "bonus editor scope state",
)
text = replace_once(
    text,
    '    setAttribute("str")\n    setType("add")',
    '    setAttribute("str")\n    setScopeAttribute("all")\n    setType("add")',
    "bonus editor scope reset",
)
text = replace_once(
    text,
    '  const needsAttribute =\n    target === "attribute" || target === "attributeModifier"\n',
    '  const needsAttribute =\n    target === "attribute" || target === "attributeModifier"\n  const supportsAttributeScope = isScopedTarget(target)\n',
    "bonus editor scoped condition",
)
text = replace_once(
    text,
    '          {needsAttribute ? (\n            <label className="grid gap-1">',
    '          {needsAttribute ? (\n            <label className="grid gap-1">',
    "bonus editor attribute anchor",
)
attribute_block_end = '''          ) : null}

          <label className="flex items-center gap-2 text-xs font-medium text-textH">'''
scope_block = '''          ) : null}

          {supportsAttributeScope ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Limitar ao atributo</span>
              <Select
                value={scopeAttribute}
                onChange={(event) =>
                  setScopeAttribute(event.target.value as "all" | Attribute)
                }
              >
                <option value="all">Todos os atributos</option>
                {ATTRIBUTES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-xs font-medium text-textH">'''
text = replace_once(text, attribute_block_end, scope_block, "bonus editor scope selector")
text = replace_once(
    text,
    '               target,\n               attribute,\n               bonus: {',
    '               target,\n               attribute,\n               scopeAttribute: scopeAttribute === "all" ? undefined : scopeAttribute,\n               bonus: {',
    "bonus editor scope payload",
)
write(path, text)

# ---------------------------------------------------------------------------
# Legacy equipment editor
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/equipmentEditDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Attribute } from "../../../models/sheet/Attribute"\n\ntype BonusTarget =\n  | "armorClass"\n  | "initiative"\n  | "maxHp"\n  | "temporaryHp"\n  | "passivePerception"\n  | "attackBonus"\n  | "saveDcBonus"\n  | "speed"\n  | "attribute"\n  | "attributeModifier"\n\ntype NormalBonusTarget = Exclude<\n  BonusTarget,\n  "attribute" | "attributeModifier"\n>\n',
    'import type { Attribute } from "../../../models/sheet/Attribute"\nimport type { BonusTarget, NormalBonusKey, ScopedBonusKey } from "../../../models/bonuses/Bonus"\n\ntype NormalBonusTarget = NormalBonusKey\n',
    "legacy bonus types",
)
text = replace_once(
    text,
    '  { value: "attackBonus", label: "Ataque" },\n  { value: "saveDcBonus", label: "CD de magia e habilidades" },\n',
    '  { value: "attackBonus", label: "Ataque — global" },\n  { value: "weaponAttackBonus", label: "Ataque com arma" },\n  { value: "spellAttackBonus", label: "Ataque mágico" },\n  { value: "saveDcBonus", label: "CD — global" },\n  { value: "spellSaveDcBonus", label: "CD de magia" },\n  { value: "abilitySaveDcBonus", label: "CD de habilidade" },\n',
    "legacy scoped options",
)
text = replace_once(
    text,
    ']\n\nconst ATTRIBUTES:',
    ']\n\nconst SCOPED_TARGETS = new Set<BonusTarget>([\n  "weaponAttackBonus",\n  "spellAttackBonus",\n  "spellSaveDcBonus",\n  "abilitySaveDcBonus",\n])\n\nfunction isScopedTarget(target: BonusTarget): target is ScopedBonusKey {\n  return SCOPED_TARGETS.has(target)\n}\n\nconst ATTRIBUTES:',
    "legacy scoped helper",
)
text = replace_once(
    text,
    '  const [bonusAttribute, setBonusAttribute] = useState<Attribute>("str")\n',
    '  const [bonusAttribute, setBonusAttribute] = useState<Attribute>("str")\n  const [bonusScopeAttribute, setBonusScopeAttribute] = useState<"all" | Attribute>("all")\n',
    "legacy scope state",
)
text = replace_once(
    text,
    '    const bonusKey = bonusTarget as NormalBonusTarget\n\n    updateDraft({',
    '    if (isScopedTarget(bonusTarget)) {\n      updateDraft({\n        bonuses: {\n          ...(currentDraft.bonuses ?? {}),\n          [bonusTarget]: [\n            ...(currentDraft.bonuses?.[bonusTarget] ?? []),\n            {\n              attribute: bonusScopeAttribute === "all" ? undefined : bonusScopeAttribute,\n              bonus: nextBonus,\n            },\n          ],\n        },\n      })\n      return\n    }\n\n    const bonusKey = bonusTarget as NormalBonusTarget\n\n    updateDraft({',
    "legacy scoped add",
)
text = replace_once(
    text,
    '    const bonusKey = target as NormalBonusTarget\n    const next = asBonusArray(currentDraft.bonuses[bonusKey]).filter(',
    '    if (isScopedTarget(target)) {\n      const next = (currentDraft.bonuses[target] ?? []).filter(\n        (_, i) => i !== index,\n      )\n      if (next.length) nextBonuses[target] = next\n      else delete nextBonuses[target]\n      updateDraft({ bonuses: nextBonuses })\n      return\n    }\n\n    const bonusKey = target as NormalBonusTarget\n    const next = asBonusArray(currentDraft.bonuses[bonusKey]).filter(',
    "legacy scoped remove",
)
legacy_attribute_end = '''          ) : null}

          <div className="mt-4 grid gap-2">'''
legacy_scope = '''          ) : null}

          {isScopedTarget(bonusTarget) ? (
            <div className="mt-3">
              <label className="text-xs text-text">Limitar ao atributo</label>
              <Select
                className="mt-1"
                value={bonusScopeAttribute}
                onChange={(e) =>
                  setBonusScopeAttribute(e.target.value as "all" | Attribute)
                }
              >
                <option value="all">Todos os atributos</option>
                {ATTRIBUTES.map((attribute) => (
                  <option key={attribute.key} value={attribute.key}>
                    {attribute.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">'''
text = replace_once(text, legacy_attribute_end, legacy_scope, "legacy scope selector")
text = replace_once(
    text,
    '              const bonusKey = target.value as NormalBonusTarget\n              const bonuses = asBonusArray(draft.bonuses[bonusKey])\n',
    '              if (isScopedTarget(target.value)) {\n                return (draft.bonuses[target.value] ?? []).map((entry, index) => (\n                  <div\n                    key={`${target.value}-${index}`}\n                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-text"\n                  >\n                    <span>\n                      {target.label}{entry.attribute ? ` ${entry.attribute.toUpperCase()}` : " — todos"}{" "}\n                      {bonusTypeLabel(entry.bonus.type)} {entry.bonus.value}\n                    </span>\n                    <button\n                      type="button"\n                      className="rounded-md border border-border px-2 py-1"\n                      onClick={() => removeBonus(target.value, index)}\n                    >\n                      ✕\n                    </button>\n                  </div>\n                ))\n              }\n\n              const bonusKey = target.value as NormalBonusTarget\n              const bonuses = asBonusArray(draft.bonuses[bonusKey])\n',
    "legacy scoped listing",
)
write(path, text)

# ---------------------------------------------------------------------------
# Equipment bonus displays
# ---------------------------------------------------------------------------
for path in [
    "src/features/characters/equipment/equipmentItemCard.tsx",
    "src/features/characters/equipment/EquipmentWeaponsSection.tsx",
]:
    text = read(path)
    text = replace_regex(
        text,
        r'type NormalBonusKey =.*?const NORMAL_BONUS_KEYS: NormalBonusKey\[\] = \[(.*?)\]\n',
        'type DisplayBonusKey =\n  | "armorClass"\n  | "initiative"\n  | "maxHp"\n  | "temporaryHp"\n  | "passivePerception"\n  | "attackBonus"\n  | "saveDcBonus"\n  | "damageBonus"\n  | "speed"\n\nconst NORMAL_BONUS_KEYS: DisplayBonusKey[] = [\1]\n\nconst SCOPED_BONUS_KEYS = [\n  "weaponAttackBonus",\n  "spellAttackBonus",\n  "spellSaveDcBonus",\n  "abilitySaveDcBonus",\n] as const\n',
        f"display key types in {path}",
        re.S,
    )
    # Ensure saveDcBonus is present in the normal display array.
    text = text.replace('  "attackBonus",\n  "damageBonus",', '  "attackBonus",\n  "saveDcBonus",\n  "damageBonus",', 1)
    anchor = '  for (const entry of bonuses.attribute ?? []) {'
    scoped_display = '''  for (const key of SCOPED_BONUS_KEYS) {
    for (const entry of bonuses[key] ?? []) {
      const scope = entry.attribute
        ? ` ${entry.attribute.toUpperCase()}`
        : " — todos"
      rows.push(`${formatBonusName(key)}${scope}: ${formatBonusValue(entry.bonus)}`)
    }
  }

'''
    text = replace_once(text, anchor, scoped_display + anchor, f"scoped display in {path}")
    write(path, text)

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------
checks = {
    "src/models/bonuses/Bonus.ts": ["weaponAttackBonus", "spellAttackBonus", "spellSaveDcBonus", "abilitySaveDcBonus"],
    "src/models/characters/characterStats.ts": ["getEffectiveSpellAttackBonus", "getEffectiveSpellSaveDc", "getEffectiveAbilitySaveDc"],
    "src/features/characters/characterSheet/attributeCalculators.tsx": ["Armas equipadas", "damageBonus"],
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": ["CompactWeaponTile", "getEffectiveSpellSaveDc"],
    "src/features/characters/inventory/equipmentBonusFields.tsx": ["Limitar ao atributo", "weaponAttackBonus"],
}
for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
