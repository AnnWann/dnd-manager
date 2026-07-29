from pathlib import Path


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


# ---------------------------------------------------------------------------
# Compact, informational casting warning without item action buttons.
# ---------------------------------------------------------------------------
write(
    "src/features/characters/characterSheet/spellcastingHandsWarning.tsx",
    '''import { AlertTriangle } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSpellcastingHandState } from "../../../models/characters/characterHands"

export function SpellcastingHandsWarning({
  character,
}: {
  character: CharacterTemplate
}) {
  const state = getSpellcastingHandState(character)

  if (state.canCast) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/35 bg-dangerBg/45 px-2.5 py-2 text-[11px] leading-4 text-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
      <p>
        <span className="font-semibold text-danger">Conjuração bloqueada:</span>{" "}
        com todas as mãos ocupadas, o personagem não pode conjurar magias com
        componentes verbais e somáticos. Libere uma mão pelo card do item ou use
        a proficiência “Conjuração com mãos ocupadas”.
      </p>
    </div>
  )
}
''',
)


# ---------------------------------------------------------------------------
# Portuguese attribute abbreviations.
# ---------------------------------------------------------------------------
write(
    "src/lib/attributeShorts.ts",
    '''import type { Attribute } from "../models/sheet/Attribute"

export type AttributeShort = "FOR" | "DES" | "CON" | "INT" | "SAB" | "CAR"

export function attributeShort(attribute: Attribute): AttributeShort {
  switch (attribute) {
    case "str":
      return "FOR"
    case "dex":
      return "DES"
    case "con":
      return "CON"
    case "int":
      return "INT"
    case "wis":
      return "SAB"
    case "cha":
      return "CAR"
  }
}
''',
)


# ---------------------------------------------------------------------------
# Bonus schema: scoped weapon and magical damage, mirroring attack scopes.
# ---------------------------------------------------------------------------
path = "src/models/bonuses/Bonus.ts"
text = read(path)
text = replace_once(
    text,
    '''  damageBonus?: Bonus[]
  speed?: Bonus[]''',
    '''  /** Bônus global aplicado a qualquer rolagem de dano. */
  damageBonus?: Bonus[]
  /** Bônus aplicado apenas a danos com armas. */
  weaponDamageBonus?: AttributeScopedBonus[]
  /** Bônus aplicado apenas a danos mágicos. */
  spellDamageBonus?: AttributeScopedBonus[]
  speed?: Bonus[]''',
    "damage bonus schema",
)
text = replace_once(
    text,
    '''  | "spellAttackBonus"
  | "spellSaveDcBonus"''',
    '''  | "spellAttackBonus"
  | "weaponDamageBonus"
  | "spellDamageBonus"
  | "spellSaveDcBonus"''',
    "scoped damage bonus keys",
)
write(path, text)


# ---------------------------------------------------------------------------
# Generic bonus editor exposes global/weapon/magic scopes for damage and uses
# localized attribute abbreviations.
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/equipmentBonusFields.tsx"
text = read(path)
text = replace_once(
    text,
    'import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"',
    'import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"\nimport { attributeShort } from "../../../lib/attributeShorts"',
    "bonus editor attribute label import",
)
text = replace_once(
    text,
    '''  { value: "abilitySaveDcBonus", label: "CD de habilidades" },
  { value: "damageBonus", label: "Dano" },''',
    '''  { value: "abilitySaveDcBonus", label: "CD de habilidades" },
  { value: "damageBonus", label: "Dano — global" },
  { value: "weaponDamageBonus", label: "Dano com arma" },
  { value: "spellDamageBonus", label: "Dano mágico" },''',
    "damage target options",
)
text = replace_once(
    text,
    '''  "spellAttackBonus",
  "spellSaveDcBonus",''',
    '''  "spellAttackBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",''',
    "scoped damage targets",
)
text = text.replace("entry.attribute.toUpperCase()", "attributeShort(entry.attribute)")
write(path, text)


# ---------------------------------------------------------------------------
# Weapon editor has matching own-weapon attack and damage fields.
# ---------------------------------------------------------------------------
path = "src/features/characters/inventory/equipmentFields.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Ability } from "../../../models/abilities/Ability"',
    'import type { Ability } from "../../../models/abilities/Ability"\nimport type { Bonus } from "../../../models/bonuses/Bonus"',
    "weapon bonus type import",
)
text = replace_once(
    text,
    '''  const ownAttackBonus = (() => {
    const bonus = weapon.bonuses?.attack?.bonus
    if (!bonus) return 0
    if (bonus.type === "sub") return -Math.abs(bonus.value)
    return bonus.value
  })()

  function setOwnAttackBonus(value: number) {
    onUpdate((current) => {
      const currentEquipment = current as Equipment
      const bonuses = { ...(currentEquipment.bonuses ?? {}) }

      if (value === 0) {
        delete bonuses.attack
      } else {
        bonuses.attack = {
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
  }''',
    '''  const ownAttackBonus = getSignedOwnBonus(weapon.bonuses?.attack?.bonus)
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
  }''',
    "own weapon bonus state",
)
text = replace_once(
    text,
    '''          onChange={(event) =>
            setOwnAttackBonus(Number(event.target.value) || 0)
          }
        />
      </div>

      <label className="flex items-center gap-2 self-end text-xs text-text">''',
    '''          onChange={(event) =>
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

      <label className="flex items-center gap-2 self-end text-xs text-text">''',
    "own weapon damage input",
)
text = replace_once(
    text,
    '''function WeaponDamageFields({''',
    '''function getSignedOwnBonus(bonus: Bonus | undefined): number {
  if (!bonus) return 0
  if (bonus.type === "sub") return -Math.abs(bonus.value)
  return bonus.value
}

function WeaponDamageFields({''',
    "signed own bonus helper",
)
write(path, text)


# ---------------------------------------------------------------------------
# Calculations consume global, scoped and own-weapon damage modifiers.
# ---------------------------------------------------------------------------
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    '''export function getEffectiveSaveDc(''',
    '''export function getEffectiveSpellDamageBonus(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...getScopedCharacterBonuses(character, "spellDamageBonus", attribute),
  ])
}

export function getEffectiveSaveDc(''',
    "spell damage calculation",
)
text = replace_once(
    text,
    '''  if (isWeaponImprovisedGrip(weapon)) {
    return getEffectiveAttributeModifier(character, "str")
  }

  const weaponDamageBonus = weapon.bonuses?.damage?.bonus
    ? resolveBonus(character, weapon.bonuses.damage.bonus)
    : undefined
  const weaponGeneralBonuses = (weapon.bonuses?.damageBonus ?? [])
    .map((bonus) => resolveBonus(character, bonus))
  const abilityBonuses = getAbilityBonuses(character, "damageBonus")

  return applyBonuses(baseValue, [
    ...weaponGeneralBonuses,
    ...abilityBonuses,
    ...(weaponDamageBonus ? [weaponDamageBonus] : []),
  ])''',
    '''  const modifierAttribute = isWeaponImprovisedGrip(weapon)
    ? "str"
    : getWeaponAttackAttribute(weapon)
  const effectiveBase = isWeaponImprovisedGrip(weapon)
    ? getEffectiveAttributeModifier(character, "str")
    : baseValue
  const weaponDamageBonus =
    !isWeaponImprovisedGrip(weapon) && weapon.bonuses?.damage?.bonus
      ? resolveBonus(character, weapon.bonuses.damage.bonus)
      : undefined

  return applyBonuses(effectiveBase, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...getScopedCharacterBonuses(
      character,
      "weaponDamageBonus",
      modifierAttribute,
    ),
    ...(weaponDamageBonus ? [weaponDamageBonus] : []),
  ])''',
    "weapon damage calculation",
)
write(path, text)


# ---------------------------------------------------------------------------
# CharacterTemplate exposes spell damage aggregation like spell attack/DC.
# ---------------------------------------------------------------------------
path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '''  getEffectiveSpellAttackBonus,
  getEffectiveSpellSaveDc,''',
    '''  getEffectiveSpellAttackBonus,
  getEffectiveSpellDamageBonus,
  getEffectiveSpellSaveDc,''',
    "spell damage import",
)
text = replace_once(
    text,
    '''  getEffectiveSpellAttackBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellAttackBonus(this, attribute, baseValue)}
  getEffectiveSaveDc''',
    '''  getEffectiveSpellAttackBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellAttackBonus(this, attribute, baseValue)}
  getEffectiveSpellDamageBonus(attribute: Attribute, baseValue: number): number {return getEffectiveSpellDamageBonus(this, attribute, baseValue)}
  getEffectiveSaveDc''',
    "spell damage method",
)
write(path, text)


# ---------------------------------------------------------------------------
# Legacy equipment editor gets the same damage scopes and CAR labels.
# ---------------------------------------------------------------------------
path = "src/features/characters/equipment/equipmentEditDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { BonusTarget, NormalBonusKey, ScopedBonusKey } from "../../../models/bonuses/Bonus"',
    'import type { BonusTarget, NormalBonusKey, ScopedBonusKey } from "../../../models/bonuses/Bonus"\nimport { attributeShort } from "../../../lib/attributeShorts"',
    "legacy editor attribute label import",
)
text = replace_once(
    text,
    '''  { value: "abilitySaveDcBonus", label: "CD de habilidade" },
  { value: "speed", label: "Velocidade" },''',
    '''  { value: "abilitySaveDcBonus", label: "CD de habilidade" },
  { value: "damageBonus", label: "Dano — global" },
  { value: "weaponDamageBonus", label: "Dano com arma" },
  { value: "spellDamageBonus", label: "Dano mágico" },
  { value: "speed", label: "Velocidade" },''',
    "legacy damage targets",
)
text = replace_once(
    text,
    '''  "spellAttackBonus",
  "spellSaveDcBonus",''',
    '''  "spellAttackBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",''',
    "legacy scoped damage targets",
)
text = text.replace("entry.attribute.toUpperCase()", "attributeShort(entry.attribute)")
write(path, text)


# ---------------------------------------------------------------------------
# Equipment displays include scoped damage and localized attribute labels.
# ---------------------------------------------------------------------------
for path in [
    "src/features/characters/equipment/equipmentItemCard.tsx",
    "src/features/characters/equipment/EquipmentWeaponsSection.tsx",
]:
    text = read(path)
    if 'import { attributeShort } from "../../../lib/attributeShorts"' not in text:
        text = replace_once(
            text,
            'import { Button } from "../../../components/ui/Button"',
            'import { Button } from "../../../components/ui/Button"\nimport { attributeShort } from "../../../lib/attributeShorts"',
            f"{path} attribute label import",
        )
    text = replace_once(
        text,
        '''  "spellAttackBonus",
  "spellSaveDcBonus",''',
        '''  "spellAttackBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",''',
        f"{path} scoped damage display",
    )
    text = text.replace("entry.attribute.toUpperCase()", "attributeShort(entry.attribute)")
    write(path, text)


# ---------------------------------------------------------------------------
# Shared bonus display names.
# ---------------------------------------------------------------------------
path = "src/lib/formatBonus.ts"
text = read(path)
text = replace_once(
    text,
    '''    case "spellAttackBonus":
      return "Ataque mágico"
    case "saveDcBonus":''',
    '''    case "spellAttackBonus":
      return "Ataque mágico"
    case "weaponDamageBonus":
      return "Dano com arma"
    case "spellDamageBonus":
      return "Dano mágico"
    case "saveDcBonus":''',
    "damage bonus display names",
)
text = text.replace('case "damageBonus": \n      return "Dano"', 'case "damageBonus":\n      return "Dano geral"')
write(path, text)


checks = {
    "src/features/characters/characterSheet/spellcastingHandsWarning.tsx": [
        "componentes verbais e somáticos",
    ],
    "src/lib/attributeShorts.ts": ['return "CAR"'],
    "src/models/bonuses/Bonus.ts": ["weaponDamageBonus", "spellDamageBonus"],
    "src/features/characters/inventory/equipmentFields.tsx": [
        "Bônus próprio de ataque",
        "Bônus próprio de dano",
    ],
    "src/models/characters/characterStats.ts": [
        "getEffectiveSpellDamageBonus",
        '"weaponDamageBonus"',
    ],
    "src/features/characters/equipment/equipmentEditDialog.tsx": [
        'label: "Dano com arma"',
        "attributeShort(entry.attribute)",
    ],
}

for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
