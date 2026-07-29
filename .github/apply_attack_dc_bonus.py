from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


path = Path("src/models/bonuses/Bonus.ts")
text = path.read_text()
text = replace_once(
    text,
    '  attackBonus?: Bonus[]\n  damageBonus?: Bonus[]\n',
    '  attackBonus?: Bonus[]\n  saveDcBonus?: Bonus[]\n  damageBonus?: Bonus[]\n',
    "bonus collection",
)
text = replace_once(
    text,
    '  | "attackBonus"\n  | "damageBonus"\n',
    '  | "attackBonus"\n  | "saveDcBonus"\n  | "damageBonus"\n',
    "normal bonus key",
)
path.write_text(text)

path = Path("src/lib/formatBonus.ts")
text = path.read_text()
text = replace_once(
    text,
    '    case "attackBonus":\n      return "Ataque"\n    case "speed":\n',
    '    case "attackBonus":\n      return "Ataque"\n    case "saveDcBonus":\n      return "CD"\n    case "speed":\n',
    "bonus formatter",
)
path.write_text(text)

path = Path("src/features/characters/inventory/equipmentBonusFields.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  { value: "attackBonus", label: "Ataques" },\n  { value: "damageBonus", label: "Dano" },\n',
    '  { value: "attackBonus", label: "Ataques" },\n  { value: "saveDcBonus", label: "CD de magia e habilidades" },\n  { value: "damageBonus", label: "Dano" },\n',
    "bonus field target",
)
path.write_text(text)

path = Path("src/features/characters/equipment/equipmentEditDialog.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  | "attackBonus"\n  | "speed"\n',
    '  | "attackBonus"\n  | "saveDcBonus"\n  | "speed"\n',
    "legacy target type",
)
text = replace_once(
    text,
    '  { value: "attackBonus", label: "Ataque" },\n  { value: "speed", label: "Velocidade" },\n',
    '  { value: "attackBonus", label: "Ataque" },\n  { value: "saveDcBonus", label: "CD de magia e habilidades" },\n  { value: "speed", label: "Velocidade" },\n',
    "legacy target option",
)
path.write_text(text)

path = Path("src/models/characters/characterStats.ts")
text = path.read_text()
marker = "export function getEffectiveAttribute(\n"
helpers = '''export function getEffectiveAttackBonus(
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
if "export function getEffectiveSaveDc(" not in text:
    if marker not in text:
        raise SystemExit("stat helper marker not found")
    text = text.replace(marker, helpers + marker, 1)
old_weapon_attack = '''export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined
  const weaponGeneralBonuses = (weapon.bonuses?.attackBonus ?? [])
    .map((bonus) => resolveBonus(character, bonus))
  const abilityBonuses = getAbilityBonuses(character, "attackBonus")

  return applyBonuses(baseValue, [
    ...weaponGeneralBonuses,
    ...abilityBonuses,
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}'''
new_weapon_attack = '''export function getEffectiveWeaponAttackBonus(
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
text = replace_once(
    text,
    old_weapon_attack,
    new_weapon_attack,
    "weapon attack calculation",
)
path.write_text(text)

path = Path("src/models/characters/CharacterTemplate.ts")
text = path.read_text()
text = replace_once(
    text,
    "  getEffectiveArmorClass,\n  getEffectiveAttribute,\n",
    "  getEffectiveArmorClass,\n  getEffectiveAttackBonus,\n  getEffectiveAttribute,\n",
    "template attack import",
)
text = replace_once(
    text,
    "  getEffectivePassivePerception,\n  getEffectiveStat,\n",
    "  getEffectivePassivePerception,\n  getEffectiveSaveDc,\n  getEffectiveStat,\n",
    "template DC import",
)
text = replace_once(
    text,
    '  getEffectiveStat<K extends keyof Sheet["stats"]>(stat: K,): Sheet["stats"][K] {return getEffectiveStat(this, stat)}\n  getEffectiveWeaponAttackBonus',
    '  getEffectiveStat<K extends keyof Sheet["stats"]>(stat: K,): Sheet["stats"][K] {return getEffectiveStat(this, stat)}\n  getEffectiveAttackBonus(baseValue: number): number {return getEffectiveAttackBonus(this, baseValue)}\n  getEffectiveSaveDc(baseValue: number): number {return getEffectiveSaveDc(this, baseValue)}\n  getEffectiveWeaponAttackBonus',
    "template methods",
)
path.write_text(text)

path = Path("src/features/characters/characterSheet/attributeCalculators.tsx")
text = path.read_text()
text = replace_once(
    text,
    "    return getModifier(attribute) + proficiencyBonus\n",
    "    return character.getEffectiveAttackBonus(\n      getModifier(attribute) + proficiencyBonus,\n    )\n",
    "full attack calculation",
)
text = replace_once(
    text,
    "    return 8 + getModifier(attribute) + proficiencyBonus\n",
    "    return character.getEffectiveSaveDc(\n      8 + getModifier(attribute) + proficiencyBonus,\n    )\n",
    "full DC calculation",
)
text = text.replace(
    "Valores derivados dos atributos e da proficiência.",
    "Valores derivados dos atributos e da proficiência, incluindo bônus ativos de equipamentos, habilidades e condições.",
    1,
)
text = text.replace(
    'description="Ataque proficiente, sem bônus específico da arma."',
    'description="Ataque proficiente com bônus gerais ativos; bônus específicos da arma entram no ataque real."',
    1,
)
text = text.replace(
    'description="Modificador, ataque mágico e CD da magia."',
    'description="Modificador, ataque mágico e CD com bônus ativos."',
    1,
)
text = text.replace(
    'description="8 + modificador do atributo + proficiência."',
    'description="8 + modificador do atributo + proficiência + bônus ativos de CD."',
    1,
)
path.write_text(text)

path = Path("src/features/characters/characterSheet/minimalCharacterSheet.tsx")
text = path.read_text()
text = replace_once(
    text,
    "                  character.getEffectiveAttributeModifier(attribute) + proficiency,\n",
    "                  character.getEffectiveAttackBonus(\n                    character.getEffectiveAttributeModifier(attribute) + proficiency,\n                  ),\n",
    "minimal weapon attack",
)
text = replace_once(
    text,
    "{formatSigned(modifier + proficiency)}",
    "{formatSigned(\n                        character.getEffectiveAttackBonus(modifier + proficiency),\n                      )}",
    "minimal spell attack",
)
text = replace_once(
    text,
    "{8 + modifier + proficiency}",
    "{character.getEffectiveSaveDc(\n                        8 + modifier + proficiency,\n                      )}",
    "minimal spell DC",
)
text = replace_once(
    text,
    "CD {attributeShort(attribute)} {8 + character.getEffectiveAttributeModifier(attribute) + proficiency}",
    'CD {attributeShort(attribute)}{" "}\n              {character.getEffectiveSaveDc(\n                8 + character.getEffectiveAttributeModifier(attribute) + proficiency,\n              )}',
    "minimal attribute DC",
)
path.write_text(text)

checks = {
    "src/models/bonuses/Bonus.ts": "saveDcBonus?: Bonus[]",
    "src/models/characters/characterStats.ts": "export function getEffectiveSaveDc(",
    "src/models/characters/CharacterTemplate.ts": "getEffectiveSaveDc(baseValue: number)",
    "src/features/characters/characterSheet/attributeCalculators.tsx": "character.getEffectiveSaveDc(",
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": "character.getEffectiveSaveDc(",
}
for filename, needle in checks.items():
    if needle not in Path(filename).read_text():
        raise SystemExit(f"{needle} missing from {filename}")
