import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type { Attribute } from '../../models/sheet/Attribute'
import type { ClassName } from '../../models/sheet/Class'
import type { Skill } from '../../models/sheet/Skills'
import type { CustomFormulaVariable } from './CustomFormulaEngine'

export type CharacterFormulaValues = Record<string, number | boolean | string>

type SkillDefinition = {
  id: Skill
  label: string
  attribute: Attribute
}

const ATTRIBUTES: Array<{ id: Attribute; label: string }> = [
  { id: 'str', label: 'Força' },
  { id: 'dex', label: 'Destreza' },
  { id: 'con', label: 'Constituição' },
  { id: 'int', label: 'Inteligência' },
  { id: 'wis', label: 'Sabedoria' },
  { id: 'cha', label: 'Carisma' },
]

const CLASSES: Array<{ id: ClassName; label: string }> = [
  { id: 'artificer', label: 'Artífice' },
  { id: 'barbarian', label: 'Bárbaro' },
  { id: 'bard', label: 'Bardo' },
  { id: 'cleric', label: 'Clérigo' },
  { id: 'druid', label: 'Druida' },
  { id: 'fighter', label: 'Guerreiro' },
  { id: 'monk', label: 'Monge' },
  { id: 'paladin', label: 'Paladino' },
  { id: 'ranger', label: 'Patrulheiro' },
  { id: 'rogue', label: 'Ladino' },
  { id: 'sorcerer', label: 'Feiticeiro' },
  { id: 'warlock', label: 'Bruxo' },
  { id: 'wizard', label: 'Mago' },
]

const SKILLS: SkillDefinition[] = [
  { id: 'acrobatics', label: 'Acrobacia', attribute: 'dex' },
  { id: 'animalHandling', label: 'Adestrar Animais', attribute: 'wis' },
  { id: 'arcana', label: 'Arcanismo', attribute: 'int' },
  { id: 'athletics', label: 'Atletismo', attribute: 'str' },
  { id: 'deception', label: 'Enganação', attribute: 'cha' },
  { id: 'history', label: 'História', attribute: 'int' },
  { id: 'insight', label: 'Intuição', attribute: 'wis' },
  { id: 'intimidation', label: 'Intimidação', attribute: 'cha' },
  { id: 'investigation', label: 'Investigação', attribute: 'int' },
  { id: 'medicine', label: 'Medicina', attribute: 'wis' },
  { id: 'nature', label: 'Natureza', attribute: 'int' },
  { id: 'perception', label: 'Percepção', attribute: 'wis' },
  { id: 'performance', label: 'Atuação', attribute: 'cha' },
  { id: 'persuasion', label: 'Persuasão', attribute: 'cha' },
  { id: 'religion', label: 'Religião', attribute: 'int' },
  { id: 'sleightOfHand', label: 'Prestidigitação', attribute: 'dex' },
  { id: 'stealth', label: 'Furtividade', attribute: 'dex' },
  { id: 'survival', label: 'Sobrevivência', attribute: 'wis' },
]

export function listCharacterFormulaVariables(): CustomFormulaVariable[] {
  const attributes = ATTRIBUTES.flatMap(({ id, label }) => [
    variable(`character.attribute.${id}`, `${label} — valor`),
    variable(`character.attributeModifier.${id}`, `${label} — modificador`),
    variable(`character.save.${id}`, `${label} — salvamento`),
  ])

  const classes = CLASSES.flatMap(({ id, label }) => [
    variable(`character.class.${id}.level`, `${label} — nível`),
    {
      path: `character.class.${id}.present`,
      label: `${label} — possui a classe`,
      valueType: 'boolean' as const,
    },
  ])

  const skills = SKILLS.map(({ id, label }) =>
    variable(`character.skill.${id}`, `${label} — bônus`),
  )

  return [
    variable('character.level', 'Nível total'),
    variable('character.proficiencyBonus', 'Bônus de proficiência'),
    variable('character.armorClass', 'Classe de Armadura'),
    variable('character.initiative', 'Iniciativa'),
    variable('character.passivePerception', 'Percepção passiva'),
    variable('character.mobility', 'Mobilidade'),
    variable('character.hp.current', 'Pontos de vida — atuais'),
    variable('character.hp.maximum', 'Pontos de vida — máximo'),
    variable('character.hp.temporary', 'Pontos de vida — temporários'),
    variable('character.exhaustion', 'Exaustão'),
    {
      path: 'character.inspiration',
      label: 'Inspiração',
      valueType: 'boolean',
    },
    ...attributes,
    ...classes,
    ...skills,
  ]
}

export function getCharacterFormulaValues(
  character?: CharacterTemplate,
): CharacterFormulaValues {
  if (!character) return createEmptyValues()

  const sheet = character.get('sheet')
  const proficiencyBonus = character.getProficiencyBonus()
  const values = createEmptyValues()

  values['character.level'] = (sheet.classes ?? []).reduce(
    (total, entry) => total + Math.max(0, Number(entry.level) || 0),
    0,
  )
  values['character.proficiencyBonus'] = proficiencyBonus
  values['character.armorClass'] = character.getEffectiveArmorClass()
  values['character.initiative'] = character.getEffectiveInitiative()
  values['character.passivePerception'] = character.getEffectivePassivePerception()
  values['character.mobility'] = character.getEffectiveMobility()
  values['character.hp.current'] = Number(sheet.HP.current) || 0
  values['character.hp.maximum'] = character.getEffectiveMaxHp()
  values['character.hp.temporary'] = character.getEffectiveTemporaryHp()
  values['character.exhaustion'] = Math.max(0, Number(sheet.stats.exhaustion) || 0)
  values['character.inspiration'] = Boolean(sheet.stats.inspiration)

  for (const { id } of ATTRIBUTES) {
    values[`character.attribute.${id}`] = character.getEffectiveAttribute(id)
    values[`character.attributeModifier.${id}`] =
      character.getEffectiveAttributeModifier(id)
    values[`character.save.${id}`] = character.getSavingThrowBonus(id)
  }

  for (const { id } of CLASSES) {
    const level = Math.max(0, Number(character.getClassLevel(id)) || 0)
    values[`character.class.${id}.level`] = level
    values[`character.class.${id}.present`] = level > 0
  }

  for (const skill of SKILLS) {
    const modifier = character.getEffectiveAttributeModifier(skill.attribute)
    const proficiency = sheet.skills?.[skill.id] ?? 'none'
    const multiplier = proficiency === 'expertise' ? 2 : proficiency === 'proficient' ? 1 : 0
    values[`character.skill.${skill.id}`] = modifier + proficiencyBonus * multiplier
  }

  return values
}

function createEmptyValues(): CharacterFormulaValues {
  return Object.fromEntries(
    listCharacterFormulaVariables().map((entry) => [
      entry.path,
      entry.valueType === 'boolean' ? false : entry.valueType === 'text' ? '' : 0,
    ]),
  )
}

function variable(path: string, label: string): CustomFormulaVariable {
  return { path, label, valueType: 'number' }
}
