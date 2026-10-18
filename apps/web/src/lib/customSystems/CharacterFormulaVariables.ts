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

export function listCharacterFormulaVariables(character?: CharacterTemplate): CustomFormulaVariable[] {
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

  const customSystemVariables = character
    ? (character.get('sheet').customSystems ?? []).flatMap((state) => {
        const fields = Object.entries(state.fields ?? {}).flatMap(([fieldId, value]) => {
          const valueType = typeof value === 'number'
            ? 'number' as const
            : typeof value === 'boolean'
              ? 'boolean' as const
              : typeof value === 'string'
                ? 'text' as const
                : undefined
          return valueType
            ? [{
                path: `character.customSystem.${state.systemId}.field.${fieldId}`,
                label: `${state.systemId} — campo ${fieldId}`,
                valueType,
              }]
            : []
        })
        const resources = Object.entries(state.resources ?? {}).flatMap(([resourceId, resource]) => [
          variable(`character.customSystem.${state.systemId}.resource.${resourceId}.current`, `${state.systemId} — ${resourceId} atual`),
          variable(`character.customSystem.${state.systemId}.resource.${resourceId}.maximum`, `${state.systemId} — ${resourceId} máximo`),
          variable(`character.customSystem.${state.systemId}.resource.${resourceId}.temporary`, `${state.systemId} — ${resourceId} temporário`),
        ])
        return [...fields, ...resources]
      })
    : []

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
    ...customSystemVariables,
  ]
}

export function getCharacterFormulaValues(
  character?: CharacterTemplate,
  requestedPaths?: Iterable<string>,
): CharacterFormulaValues {
  const paths = requestedPaths
    ? Array.from(new Set(requestedPaths))
    : listCharacterFormulaVariables(character).map((entry) => entry.path)

  if (!character) return createEmptyValues(paths)

  const sheet = character.get('sheet')
  const values: CharacterFormulaValues = {}

  for (const path of paths) {
    if (path === 'character.level') {
      values[path] = (sheet.classes ?? []).reduce(
        (total, entry) => total + Math.max(0, Number(entry.level) || 0),
        0,
      )
      continue
    }
    if (path === 'character.proficiencyBonus') {
      values[path] = character.getProficiencyBonus()
      continue
    }
    if (path === 'character.armorClass') {
      values[path] = character.getEffectiveArmorClass()
      continue
    }
    if (path === 'character.initiative') {
      values[path] = character.getEffectiveInitiative()
      continue
    }
    if (path === 'character.passivePerception') {
      values[path] = character.getEffectivePassivePerception()
      continue
    }
    if (path === 'character.mobility') {
      values[path] = character.getEffectiveMobility()
      continue
    }
    if (path === 'character.hp.current') {
      values[path] = Number(sheet.HP.current) || 0
      continue
    }
    if (path === 'character.hp.maximum') {
      values[path] = character.getEffectiveMaxHp()
      continue
    }
    if (path === 'character.hp.temporary') {
      values[path] = character.getEffectiveTemporaryHp()
      continue
    }
    if (path === 'character.exhaustion') {
      values[path] = Math.max(0, Number(sheet.stats.exhaustion) || 0)
      continue
    }
    if (path === 'character.inspiration') {
      values[path] = Boolean(sheet.stats.inspiration)
      continue
    }

    const customMatch = path.match(/^character\.customSystem\.([^.]+)\.(field|resource)\.([^.]+)(?:\.(current|maximum|temporary))?$/)
    if (customMatch) {
      const [, systemId, kind, id, property] = customMatch
      const state = (sheet.customSystems ?? []).find((entry) => entry.systemId === systemId)
      if (kind === 'field') {
        const value = state?.fields?.[id]
        values[path] = typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
          ? value
          : 0
      } else {
        const resource = state?.resources?.[id]
        const value = property === 'maximum'
          ? resource?.maximum
          : property === 'temporary'
            ? resource?.temporary
            : resource?.current
        values[path] = Number(value) || 0
      }
      continue
    }

    const attribute = ATTRIBUTES.find(({ id }) =>
      path === `character.attribute.${id}` ||
      path === `character.attributeModifier.${id}` ||
      path === `character.save.${id}`
    )
    if (attribute) {
      if (path === `character.attribute.${attribute.id}`) {
        values[path] = character.getEffectiveAttribute(attribute.id)
      } else if (path === `character.attributeModifier.${attribute.id}`) {
        values[path] = character.getEffectiveAttributeModifier(attribute.id)
      } else {
        values[path] = character.getSavingThrowBonus(attribute.id)
      }
      continue
    }

    const classDefinition = CLASSES.find(({ id }) =>
      path === `character.class.${id}.level` ||
      path === `character.class.${id}.present`
    )
    if (classDefinition) {
      const level = Math.max(
        0,
        Number(character.getClassLevel(classDefinition.id)) || 0,
      )
      values[path] = path.endsWith('.present') ? level > 0 : level
      continue
    }

    const skill = SKILLS.find(({ id }) => path === `character.skill.${id}`)
    if (skill) {
      const modifier = character.getEffectiveAttributeModifier(skill.attribute)
      const proficiency = sheet.skills?.[skill.id] ?? 'none'
      const multiplier =
        proficiency === 'expertise'
          ? 2
          : proficiency === 'proficient'
            ? 1
            : 0
      values[path] = modifier + character.getProficiencyBonus() * multiplier
    }
  }

  return values
}

function createEmptyValues(
  requestedPaths: Iterable<string> = listCharacterFormulaVariables().map(
    (entry) => entry.path,
  ),
): CharacterFormulaValues {
  const definitions = new Map(
    listCharacterFormulaVariables().map((entry) => [entry.path, entry]),
  )

  return Object.fromEntries(
    Array.from(requestedPaths).map((path) => {
      const entry = definitions.get(path)
      return [
        path,
        entry?.valueType === 'boolean'
          ? false
          : entry?.valueType === 'text'
            ? ''
            : 0,
      ]
    }),
  )
}

function variable(path: string, label: string): CustomFormulaVariable {
  return { path, label, valueType: 'number' }
}
