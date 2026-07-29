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


# Full character sheet attack/DC card.
path = "src/features/characters/characterSheet/attributeCalculators.tsx"
text = read(path)
text = replace_once(
    text,
    'import { formatSigned } from "../../../lib/formatSigned"',
    'import { formatSigned } from "../../../lib/formatSigned"\nimport { useCharacterContext } from "../../../contexts/characterContext"',
    "full sheet character context import",
)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport { setWeaponGripWithRules } from "../../../models/characters/characterHands"',
    "full sheet grip helper import",
)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,''',
    '''  getWeaponDamageDie,
  isVersatileWeapon,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "full sheet versatile helper import",
)
text = replace_once(
    text,
    '''export function AttributeCalculators({ character }: Props) {
  const proficiencyBonus = character.getProficiencyBonus()''',
    '''export function AttributeCalculators({ character }: Props) {
  const { updateCharacter } = useCharacterContext()
  const proficiencyBonus = character.getProficiencyBonus()''',
    "full sheet context use",
)
text = replace_once(
    text,
    '''  function getAbilityDc(attribute: Attribute): number {
    return character.getEffectiveAbilitySaveDc(
      attribute,
      8 + getModifier(attribute) + proficiencyBonus,
    )
  }

  return (''',
    '''  function getAbilityDc(attribute: Attribute): number {
    return character.getEffectiveAbilitySaveDc(
      attribute,
      8 + getModifier(attribute) + proficiencyBonus,
    )
  }

  function toggleVersatileWeapon(index: number) {
    updateCharacter(character.get("id"), (current) => {
      const weapon = current.get("equipment").weapons[index]
      if (!weapon || !isVersatileWeapon(weapon)) return current

      return setWeaponGripWithRules(
        current,
        index,
        !weapon.wieldedTwoHanded,
      )
    })
  }

  return (''',
    "full sheet toggle function",
)
text = replace_once(
    text,
    '''                  damageBonus={getWeaponDamage(weapon)}
                />''',
    '''                  damageBonus={getWeaponDamage(weapon)}
                  onToggle={
                    isVersatileWeapon(weapon)
                      ? () => toggleVersatileWeapon(index)
                      : undefined
                  }
                />''',
    "full sheet card callback",
)

full_card = '''function WeaponAttackCard({
  weapon,
  attack,
  damageBonus,
  onToggle,
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
  onToggle?: () => void
}) {
  const attribute = getWeaponAttackAttribute(weapon)
  const die = getWeaponDamageDie(weapon) ?? weapon.damage
  const damage = `${die.quantity}${die.sides}${damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""}`
  const gripLabel = weapon.wieldedTwoHanded ? "2 mãos" : "1 mão"
  const toggleTitle = weapon.wieldedTwoHanded
    ? "Clique para empunhar com uma mão"
    : "Clique para empunhar com duas mãos"

  return (
    <button
      type="button"
      disabled={!onToggle}
      aria-pressed={onToggle ? Boolean(weapon.wieldedTwoHanded) : undefined}
      title={onToggle ? toggleTitle : weapon.name}
      onClick={onToggle}
      className={[
        "rounded-lg border border-border bg-bg-subtle p-3 text-left",
        onToggle
          ? "cursor-pointer transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : "cursor-default",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-textH">
          {weapon.name || "Arma sem nome"}
          {isWeaponImprovisedGrip(weapon) ? " · improvisada" : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase text-textMuted">
          {onToggle ? (
            <span className="rounded-full border border-accentBorder bg-accentBg px-1.5 py-0.5 normal-case text-accent">
              {gripLabel}
            </span>
          ) : null}
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
}'''
text, count = re.subn(
    r'function WeaponAttackCard\(\{.*?\n\}\n\n(?=function SpellcastingCard)',
    lambda _match: full_card + "\n\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"full weapon attack card matched {count} times")
write(path, text)


# Minimal character sheet attack/DC tile.
path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"',
    'import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"\nimport { setWeaponGripWithRules } from "../../../models/characters/characterHands"',
    "minimal grip helper import",
)
text = replace_once(
    text,
    '''  getWeaponDamageDie,
  isWeaponImprovisedGrip,
  type Weapon,''',
    '''  getWeaponDamageDie,
  isVersatileWeapon,
  isWeaponImprovisedGrip,
  type Weapon,''',
    "minimal versatile helper import",
)
text = replace_once(
    text,
    '''                       damageBonus={damageBonus}
                     />''',
    '''                       damageBonus={damageBonus}
                       onToggle={
                         isVersatileWeapon(weapon)
                           ? () =>
                               updateCharacter(
                                 character.get("id"),
                                 (current) => {
                                   const currentWeapon = current
                                     .get("equipment")
                                     .weapons[index]
                                   if (
                                     !currentWeapon ||
                                     !isVersatileWeapon(currentWeapon)
                                   ) {
                                     return current
                                   }

                                   return setWeaponGripWithRules(
                                     current,
                                     index,
                                     !currentWeapon.wieldedTwoHanded,
                                   )
                                 },
                               )
                           : undefined
                       }
                     />''',
    "minimal card callback",
)

compact_card = '''function CompactWeaponTile({
  weapon,
  attack,
  damageBonus,
  onToggle,
}: {
  weapon: Weapon
  attack: number
  damageBonus: number
  onToggle?: () => void
}) {
  const die = getWeaponDamageDie(weapon) ?? weapon.damage
  const damage = `${die.quantity}${die.sides}${
    damageBonus !== 0 ? ` ${formatSigned(damageBonus)}` : ""
  }`
  const gripLabel = weapon.wieldedTwoHanded ? "2M" : "1M"
  const toggleTitle = weapon.wieldedTwoHanded
    ? "Clique para empunhar com uma mão"
    : "Clique para empunhar com duas mãos"

  return (
    <button
      type="button"
      disabled={!onToggle}
      aria-pressed={onToggle ? Boolean(weapon.wieldedTwoHanded) : undefined}
      title={onToggle ? toggleTitle : weapon.name}
      onClick={onToggle}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center",
        onToggle
          ? "cursor-pointer transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : "cursor-default",
      )}
    >
      <div className="flex min-w-0 items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-textMuted">
        <span className="truncate">
          {weapon.name || "Arma"}
          {isWeaponImprovisedGrip(weapon) ? " · imp." : ""}
        </span>
        {onToggle ? (
          <span className="shrink-0 rounded-full border border-accentBorder bg-accentBg px-1 py-0.5 text-[9px] font-semibold text-accent">
            {gripLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-lg font-bold text-textH">{formatSigned(attack)}</div>
      <div className="text-[10px] font-medium text-textMuted">{damage}</div>
    </button>
  )
}'''
text, count = re.subn(
    r'function CompactWeaponTile\(\{.*?\n\}\n\n(?=function DerivedTile)',
    lambda _match: compact_card + "\n\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"compact weapon tile matched {count} times")
write(path, text)


for filename, needles in {
    "src/features/characters/characterSheet/attributeCalculators.tsx": [
        "toggleVersatileWeapon",
        "Clique para empunhar com duas mãos",
        "isVersatileWeapon",
    ],
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": [
        "setWeaponGripWithRules",
        "onToggle?: () => void",
        'const gripLabel = weapon.wieldedTwoHanded ? "2M" : "1M"',
    ],
}.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
