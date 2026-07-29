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


def replace_regex(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# ---------------------------------------------------------------------------
# Abilities can grant proficiencies.
# ---------------------------------------------------------------------------
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    'import type { SpellGrant } from "../magic/spells/SpellGrant"',
    'import type { SpellGrant } from "../magic/spells/SpellGrant"\nimport type { Proficiency } from "../sheet/Proficiency"',
    "ability proficiency import",
)
text = replace_once(
    text,
    '  grantedSpells?: SpellGrant[]\n  bonuses?: BonusCollection',
    '  grantedSpells?: SpellGrant[]\n  grantedProficiencies?: Proficiency[]\n  bonuses?: BonusCollection',
    "ability proficiency field",
)
write(path, text)

path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import { BonusesFields } from "../inventory/equipmentBonusFields"',
    'import { BonusesFields } from "../inventory/equipmentBonusFields"\nimport { GrantedProficienciesEditor } from "./grantedProficienciesEditor"',
    "ability proficiency editor import",
)
text = replace_once(
    text,
    '    grantedSpells: [],\n    bonuses: {},',
    '    grantedSpells: [],\n    grantedProficiencies: [],\n    bonuses: {},',
    "empty ability proficiency default",
)
text = replace_once(
    text,
    'Configure categoria, comportamento, usos, bônus e magias concedidas.',
    'Configure categoria, comportamento, usos, bônus, proficiências e magias concedidas.',
    "ability dialog description",
)
text = replace_once(
    text,
    '''          <BonusesFields
            bonuses={draft.bonuses ?? {}}
            onChange={(bonuses) => setDraft({ ...draft, bonuses })}
          />

          <GrantedSpellsEditor''',
    '''          <BonusesFields
            bonuses={draft.bonuses ?? {}}
            onChange={(bonuses) => setDraft({ ...draft, bonuses })}
          />

          <GrantedProficienciesEditor
            proficiencies={draft.grantedProficiencies ?? []}
            onChange={(grantedProficiencies) =>
              setDraft({ ...draft, grantedProficiencies })
            }
          />

          <GrantedSpellsEditor''',
    "render ability proficiency editor",
)
write(path, text)

path = "src/models/characters/characterProficiencies.ts"
text = read(path)
text = replace_once(
    text,
    '} from "../sheet/Proficiency"',
    '} from "../sheet/Proficiency"\nimport { getEquippedItems } from "./characterEquipment"',
    "proficiency equipment import",
)
append = '''

export type AbilityGrantedProficiency = {
  proficiency: Proficiency
  abilityId: string
  abilityName: string
}

export function getAbilityGrantedProficiencies(
  character: CharacterTemplate,
): AbilityGrantedProficiency[] {
  const abilities = [
    ...(character.get("abilities") ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap((item) => item.abilities ?? []),
  ].filter(
    (ability) =>
      ability.kind === "passive" || ability.modifiersActive !== false,
  )

  return abilities.flatMap((ability) =>
    (ability.grantedProficiencies ?? []).map((proficiency) => ({
      proficiency,
      abilityId: ability.id,
      abilityName: ability.name || "Habilidade sem nome",
    })),
  )
}

export function getCharacterProficiencies(
  character: CharacterTemplate,
): Proficiency[] {
  const proficiencies = [
    ...(character.get("sheet").proficiencies ?? []),
    ...(character.get("sheet").race.proficiencies ?? []),
    ...getAbilityGrantedProficiencies(character).map(
      (entry) => entry.proficiency,
    ),
  ]
  const seen = new Set<string>()

  return proficiencies.filter((proficiency) => {
    const key = `${proficiency.category}:${normalizeProficiencyName(proficiency.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeProficiencyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
'''
if "export function getAbilityGrantedProficiencies" not in text:
    text += append
text = replace_regex(
    text,
    r'export function hasProficiency\(.*?\n\}',
    '''export function hasProficiency(
  character: CharacterTemplate,
  category: ProficiencyCategory,
  name: string,
): boolean {
  const normalizedName = normalizeProficiencyName(name)

  return getCharacterProficiencies(character).some(
    (proficiency) =>
      proficiency.category === category &&
      normalizeProficiencyName(proficiency.name) === normalizedName,
  )
}''',
    "aggregate has proficiency",
    re.S,
)
write(path, text)

path = "src/models/characters/characterHands.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Itemmable } from "../items/item"',
    'import type { Itemmable } from "../items/item"\nimport { getCharacterProficiencies } from "./characterProficiencies"',
    "hands proficiency import",
)
text = replace_regex(
    text,
    r'export function hasOccupiedHandsSpellcastingProficiency\(.*?\n\}',
    '''export function hasOccupiedHandsSpellcastingProficiency(
  character: CharacterTemplate,
): boolean {
  const expectedName = normalizeName(
    OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )

  return getCharacterProficiencies(character).some(
    (proficiency) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      (proficiency.category === "other" &&
        normalizeName(proficiency.name) === expectedName),
  )
}''',
    "ability granted occupied hands proficiency",
    re.S,
)
write(path, text)

# Functional skill and saving-throw grants.
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    'import { getCharacterConditions } from "./characterConditionStorage"',
    'import { getCharacterConditions } from "./characterConditionStorage"\nimport { hasProficiency } from "./characterProficiencies"\nimport { attributeShort } from "../../lib/attributeShorts"',
    "stats proficiency imports",
)
text = replace_once(
    text,
    '    equipment.cape,\n    ...equipment.rings,',
    '    equipment.cape,\n    ...(equipment.necklaces ?? []),\n    ...equipment.rings,',
    "stats necklaces",
)
text = replace_regex(
    text,
    r'export function isSavingThrowProficient\(.*?\n\}',
    '''export function isSavingThrowProficient(
  character: CharacterTemplate,
  attribute: Attribute,
): boolean {
  const direct =
    character.get("sheet").savingThrowProficiencies?.[attribute] ?? false
  if (direct) return true

  const fullNames: Record<Attribute, string> = {
    str: "Força",
    dex: "Destreza",
    con: "Constituição",
    int: "Inteligência",
    wis: "Sabedoria",
    cha: "Carisma",
  }

  return [attribute, attributeShort(attribute), fullNames[attribute]].some(
    (name) => hasProficiency(character, "saving-throw", name),
  )
}''',
    "ability saving throw proficiency",
    re.S,
)
write(path, text)

path = "src/features/characters/characterSheet/skills/selectCharacterSkills.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"',
    'import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"\nimport { hasProficiency } from "../../../../models/characters/characterProficiencies"',
    "skill proficiency import",
)
text = replace_once(
    text,
    '''  const proficiency = sheet.skills[skillKey] ?? "none"
  const abilityMod = character.getEffectiveAttributeModifier(ability)

  const bonus =
    abilityMod +
    (proficiency === "proficient" ? profBonus : 0) +
    (proficiency === "expertise" ? profBonus * 2 : 0)''',
    '''  const proficiency = sheet.skills[skillKey] ?? "none"
  const grantedProficiency =
    hasProficiency(character, "skill", label) ||
    hasProficiency(character, "skill", skillKey)
  const effectiveProficiency =
    proficiency === "expertise"
      ? "expertise"
      : proficiency === "proficient" || grantedProficiency
        ? "proficient"
        : "none"
  const abilityMod = character.getEffectiveAttributeModifier(ability)

  const bonus =
    abilityMod +
    (effectiveProficiency === "proficient" ? profBonus : 0) +
    (effectiveProficiency === "expertise" ? profBonus * 2 : 0)''',
    "effective granted skill proficiency",
)
text = text.replace(
    'proficiency === "proficient" || proficiency === "expertise"',
    'effectiveProficiency === "proficient" || effectiveProficiency === "expertise"',
)
text = text.replace(
    'proficiency === "expertise"\n               ?',
    'effectiveProficiency === "expertise"\n               ?',
)
write(path, text)

# Proficiency tab displays ability sources and all proficiency categories.
path = "src/features/characters/proficiencies/characterProficiencies.tsx"
text = read(path)
text = replace_once(
    text,
    '} from "../../../models/sheet/Proficiency"',
    '} from "../../../models/sheet/Proficiency"\nimport { getAbilityGrantedProficiencies } from "../../../models/characters/characterProficiencies"',
    "proficiency tab ability import",
)
text = replace_regex(
    text,
    r'type ManagedProficiencyCategory = Exclude<.*?>',
    'type ManagedProficiencyCategory = ProficiencyCategory',
    "managed proficiency category",
    re.S,
)
text = replace_once(
    text,
    '  source: "character" | "race"\n}',
    '  source: "character" | "race" | "ability"\n  sourceName?: string\n}',
    "display proficiency ability source",
)
text = replace_once(
    text,
    '''  {
    value: "other",
    label: "Outros",''',
    '''  {
    value: "skill",
    label: "Perícias",
    description: "Perícias concedidas por habilidades ou outras origens.",
  },
  {
    value: "saving-throw",
    label: "Testes de resistência",
    description: "Proficiência em resistências de atributos específicos.",
  },
  {
    value: "other",
    label: "Outros",''',
    "skill and save proficiency categories",
)
text = replace_once(
    text,
    '''  const displayedProficiencies: DisplayProficiency[] = [
    ...characterProficiencies.map''',
    '''  const abilityProficiencies = getAbilityGrantedProficiencies(character)
    .map((entry) => ({
      proficiency: entry.proficiency,
      source: "ability" as const,
      sourceName: entry.abilityName,
    }))
    .filter(
      ({ proficiency }) =>
        proficiency.id !== OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID,
    )

  const displayedProficiencies: DisplayProficiency[] = [
    ...characterProficiencies.map''',
    "ability proficiency display collection",
)
text = replace_once(
    text,
    '''    ...racialProficiencies.map((proficiency) => ({
      proficiency,
      source: "race" as const,
    })),
  ]''',
    '''    ...racialProficiencies.map((proficiency) => ({
      proficiency,
      source: "race" as const,
    })),
    ...abilityProficiencies,
  ]''',
    "add ability proficiencies to display",
)
text = replace_once(
    text,
    'Proficiências próprias e concedidas pela raça do personagem.',
    'Proficiências próprias e concedidas pela raça ou por habilidades ativas.',
    "proficiency tab description",
)
text = replace_once(
    text,
    '''          ...characterProficiencies,
          ...racialProficiencies,
        ]}''',
    '''          ...characterProficiencies,
          ...racialProficiencies,
          ...abilityProficiencies.map((entry) => entry.proficiency),
        ]}''',
    "existing ability proficiencies",
)
text = replace_once(
    text,
    '''  const racialProficiency = (
    character.get("sheet").race.proficiencies ?? []
  ).some(''',
    '''  const racialProficiency = (
    character.get("sheet").race.proficiencies ?? []
  ).some(''',
    "keep racial proficiency anchor",
)
text = replace_once(
    text,
    '''  const enabled = hasOccupiedHandsSpellcastingProficiency(character)

  function toggle() {
    if (racialProficiency) return''',
    '''  const abilityProficiency = getAbilityGrantedProficiencies(character).some(
    ({ proficiency }) =>
      proficiency.id === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_ID ||
      proficiency.name === OCCUPIED_HANDS_SPELLCASTING_PROFICIENCY_NAME,
  )
  const enabled = hasOccupiedHandsSpellcastingProficiency(character)

  function toggle() {
    if (racialProficiency || abilityProficiency) return''',
    "special ability proficiency state",
)
text = replace_once(
    text,
    '          disabled={racialProficiency}',
    '          disabled={racialProficiency || abilityProficiency}',
    "disable ability granted toggle",
)
text = replace_once(
    text,
    '''          {racialProficiency
            ? "Concedida pela raça"
            : enabled''',
    '''          {racialProficiency
            ? "Concedida pela raça"
            : abilityProficiency
              ? "Concedida por habilidade"
              : enabled''',
    "ability granted special label",
)
text = replace_once(
    text,
    '''                {source === "race" ? (
                  <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Raça
                  </span>
                ) : null}''',
    '''                {source === "race" || source === "ability" ? (
                  <span className="rounded-full bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                    {source === "race" ? "Raça" : sourceName || "Habilidade"}
                  </span>
                ) : null}''',
    "ability source badge",
)
text = replace_once(
    text,
    '''            ) : (
              <span className="text-[10px] font-medium text-textMuted">
                Gerenciada em Raça
              </span>
            )}''',
    '''            ) : (
              <span className="text-[10px] font-medium text-textMuted">
                {source === "race" ? "Gerenciada em Raça" : "Gerenciada na habilidade"}
              </span>
            )}''',
    "ability source management label",
)
write(path, text)


# ---------------------------------------------------------------------------
# Necklace equipment slot with three spaces.
# ---------------------------------------------------------------------------
path = "src/models/items/item.ts"
text = read(path)
text = replace_once(
    text,
    '  | "ring"\n',
    '  | "ring"\n  | "necklace"\n',
    "necklace equip slot",
)
write(path, text)

path = "src/models/items/equipment/Equipment.ts"
text = read(path)
text = replace_once(
    text,
    '  rings: Equipment[]\n',
    '  rings: Equipment[]\n  necklaces?: Equipment[]\n',
    "necklace equipment collection",
)
write(path, text)

path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '        rings: props.equipment?.rings ?? [],\n        weapons:',
    '        rings: props.equipment?.rings ?? [],\n        necklaces: props.equipment?.necklaces ?? [],\n        weapons:',
    "character necklace normalization",
)
text = text.replace(
    '"weapons" | "rings" | "pockets" | "heldItems"',
    '"weapons" | "rings" | "necklaces" | "pockets" | "heldItems"',
)
write(path, text)

path = "src/lib/newCharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '      rings: [],\n      weapons:',
    '      rings: [],\n      necklaces: [],\n      weapons:',
    "new character necklaces",
)
write(path, text)

path = "src/models/characters/characterEquipment.ts"
text = read(path)
text = text.replace(
    '"weapons" | "rings" | "pockets" | "heldItems"',
    '"weapons" | "rings" | "necklaces" | "pockets" | "heldItems"',
)
text = replace_once(
    text,
    '''  const weaponsWeight = equipment.weapons.reduce(''',
    '''  const necklacesWeight = (equipment.necklaces ?? []).reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const weaponsWeight = equipment.weapons.reduce(''',
    "necklace weight",
)
text = replace_once(
    text,
    '    ringsWeight +\n    weaponsWeight +',
    '    ringsWeight +\n    necklacesWeight +\n    weaponsWeight +',
    "necklace total weight",
)
text = replace_once(
    text,
    '''  if (itemToEquip.equipSlot === "ring") {
    if (getUsedFingers(character) >= getTotalFingers(character)) {
      return character
    }

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  const slot''',
    '''  if (itemToEquip.equipSlot === "ring") {
    if (getUsedFingers(character) >= getTotalFingers(character)) {
      return character
    }

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  if (itemToEquip.equipSlot === "necklace") {
    if ((equipment.necklaces ?? []).length >= 3) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        necklaces: [
          ...(equipment.necklaces ?? []),
          itemToEquip as Equipment,
        ],
      })
  }

  const slot''',
    "legacy necklace equip",
)
text = replace_once(
    text,
    '    equipment.helmet,\n    ...equipment.rings,',
    '    equipment.helmet,\n    ...(equipment.necklaces ?? []),\n    ...equipment.rings,',
    "character equipment necklaces",
)
text = replace_once(
    text,
    '    helmet: updateItem(equipment.helmet),\n    rings:',
    '    helmet: updateItem(equipment.helmet),\n    necklaces: (equipment.necklaces ?? []).map(updateItem),\n    rings:',
    "update necklaces by id",
)
write(path, text)

path = "src/models/characters/characterEquipmentInteractions.ts"
text = read(path)
text = replace_once(
    text,
    '''  if (item.equipSlot === "ring") {
    if (equipment.rings.length >= character.getTotalFingers()) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  const slot''',
    '''  if (item.equipSlot === "ring") {
    if (equipment.rings.length >= character.getTotalFingers()) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  if (item.equipSlot === "necklace") {
    if ((equipment.necklaces ?? []).length >= 3) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        necklaces: [
          ...(equipment.necklaces ?? []),
          itemToEquip as Equipment,
        ],
      })
  }

  const slot''',
    "rule necklace equip",
)
text = text.replace(
    '"weapons" | "rings" | "pockets" | "heldItems"',
    '"weapons" | "rings" | "necklaces" | "pockets" | "heldItems"',
)
write(path, text)

path = "src/features/characters/inventory/equipmentFields.tsx"
text = read(path)
text = replace_once(
    text,
    '            ["ring", "Anel"],\n            ["cape", "Capa"],',
    '            ["ring", "Anel"],\n            ["necklace", "Colar"],\n            ["cape", "Capa"],',
    "necklace equipment option",
)
write(path, text)

path = "src/features/characters/inventory/equipItemDialog.tsx"
text = read(path)
text = replace_once(
    text,
    '''    const requiresHand = item.equipSlot === "shield"
    const replacingShield =
      requiresHand && Boolean(character.get("equipment").shield)

    options.push({''',
    '''    const requiresHand = item.equipSlot === "shield"
    const replacingShield =
      requiresHand && Boolean(character.get("equipment").shield)
    const necklaceSpaceAvailable =
      item.equipSlot !== "necklace" ||
      (character.get("equipment").necklaces ?? []).length < 3

    options.push({''',
    "necklace availability",
)
text = replace_once(
    text,
    '      available: !requiresHand || replacingShield || freeHands >= 1,',
    '      available:\n        necklaceSpaceAvailable &&\n        (!requiresHand || replacingShield || freeHands >= 1),',
    "necklace natural availability",
)
text = replace_once(
    text,
    '    ring: "Usar como anel",\n',
    '    ring: "Usar como anel",\n    necklace: "Usar como colar",\n',
    "necklace natural label",
)
write(path, text)

path = "src/features/characters/equipment/characterEquipment.tsx"
text = read(path)
text = replace_once(
    text,
    'import { EquipmentRingsSection } from "./equipmentRingSection"',
    'import { EquipmentRingsSection } from "./equipmentRingSection"\nimport { EquipmentNecklacesSection } from "./equipmentNecklaceSection"',
    "necklace section import",
)
text = replace_once(
    text,
    'Itens vestidos, empunhados, segurados, anéis, bolsos legados e sintonias.',
    'Itens vestidos, empunhados, segurados, anéis, colares, bolsos e sintonias.',
    "equipment description necklaces",
)
text = replace_once(
    text,
    '''        <EquipmentRingsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentPocketsSection''',
    '''        <EquipmentRingsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentNecklacesSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentPocketsSection''',
    "render necklace section",
)
write(path, text)

path = "src/features/characters/inventory/inventoryEditorV2.tsx"
text = read(path)
text = replace_once(
    text,
    '  onEquipItem?: (itemId: string) => void\n',
    '  onEquipItem?: (itemId: string) => void\n  onPocketItem?: (itemId: string) => void\n',
    "pocket prop",
)
text = replace_once(
    text,
    '  | "ring"\n  | "bagOfHolding"',
    '  | "ring"\n  | "necklace"\n  | "bagOfHolding"',
    "necklace inventory filter type",
)
text = replace_once(
    text,
    '  { value: "ring", label: "Anéis" },\n',
    '  { value: "ring", label: "Anéis" },\n  { value: "necklace", label: "Colares" },\n',
    "necklace inventory filter",
)
text = replace_once(
    text,
    '    filter === "ring"\n',
    '    filter === "ring" ||\n    filter === "necklace"\n',
    "necklace matching filter",
)
text = replace_once(
    text,
    '  onEquipItem,\n  onToggleBagOfHolding,',
    '  onEquipItem,\n  onPocketItem,\n  onToggleBagOfHolding,',
    "pocket prop destructure",
)
text = replace_once(
    text,
    '''          onEquipItem={onEquipItem}
          transferLabel={transferLabel}''',
    '''          onEquipItem={onEquipItem}
          onPocketItem={onPocketItem}
          transferLabel={transferLabel}''',
    "currency wallet pocket prop",
)
text = replace_once(
    text,
    '''                        {onEquipItem ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEquipItem(item.id)}
                          >
                            Equipar
                          </Button>
                        ) : null}

                        {onToggleBagOfHolding ? (''',
    '''                        {onEquipItem ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onEquipItem(item.id)}
                          >
                            Equipar
                          </Button>
                        ) : null}

                        {canItemGoInPocket(item) && onPocketItem ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onPocketItem(item.id)}
                          >
                            Enviar ao bolso
                          </Button>
                        ) : null}

                        {onToggleBagOfHolding ? (''',
    "regular pocket button",
)
text = replace_once(
    text,
    '''  onEquipItem,
  transferLabel,''',
    '''  onEquipItem,
  onPocketItem,
  transferLabel,''',
    "currency wallet pocket destructure",
)
text = replace_once(
    text,
    '''  onEquipItem?: (itemId: string) => void
  transferLabel: string''',
    '''  onEquipItem?: (itemId: string) => void
  onPocketItem?: (itemId: string) => void
  transferLabel: string''',
    "currency wallet pocket type",
)
text = replace_once(
    text,
    '''                {onTransferItem ? (
                  <Button''',
    '''                {canItemGoInPocket(item) && onPocketItem ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPocketItem(item.id)}
                  >
                    Enviar ao bolso
                  </Button>
                ) : null}
                {onTransferItem ? (
                  <Button''',
    "currency pocket button",
)
text = replace_once(
    text,
    '    if (item.equipSlot === "ring") return "Anel"\n',
    '    if (item.equipSlot === "ring") return "Anel"\n    if (item.equipSlot === "necklace") return "Colar"\n',
    "necklace inventory label",
)
write(path, text)

path = "src/features/characters/inventory/characterInventory.tsx"
text = read(path)
text = replace_once(
    text,
    'import { equipInventoryItemWithRules } from "../../../models/characters/characterEquipmentInteractions"',
    'import {\n  equipInventoryItemWithRules,\n  pocketInventoryItemWithRules,\n} from "../../../models/characters/characterEquipmentInteractions"',
    "pocket interaction import",
)
text = replace_once(
    text,
    '''        onEquipItem={(itemId) =>
          setEquippingItem(items.find((item) => item.id === itemId) ?? null)
        }
        onToggleBagOfHolding''',
    '''        onEquipItem={(itemId) =>
          setEquippingItem(items.find((item) => item.id === itemId) ?? null)
        }
        onPocketItem={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            pocketInventoryItemWithRules(current, itemId),
          )
        }
        onToggleBagOfHolding''',
    "restore character pocket action",
)
write(path, text)

checks = {
    "src/models/abilities/Ability.ts": ["grantedProficiencies"],
    "src/features/characters/abilities/abilityDialog.tsx": ["GrantedProficienciesEditor"],
    "src/models/characters/characterProficiencies.ts": ["getAbilityGrantedProficiencies", "getCharacterProficiencies"],
    "src/models/items/item.ts": ['| "necklace"'],
    "src/models/items/equipment/Equipment.ts": ["necklaces"],
    "src/features/characters/inventory/inventoryEditorV2.tsx": ["Enviar ao bolso", 'value: "necklace"'],
    "src/features/characters/equipment/characterEquipment.tsx": ["EquipmentNecklacesSection"],
}
for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
