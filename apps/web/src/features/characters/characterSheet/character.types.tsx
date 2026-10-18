export type Skill = 
  |  'acrobatics' 
  | 'arcana' 
  | 'athletics' 
  | 'animalHandling'
  | 'performance' 
  | 'deception' 
  | 'stealth' 
  | 'history' 
  | 'intimidation' 
  | 'insight' 
  | 'investigation' 
  | 'medicine' 
  | 'nature' 
  | 'perception' 
  | 'persuasion' 
  | 'sleightOfHand' 
  | 'religion' 
  | 'survival'

export type SkillProficiency =
  | "none"
  | "proficient"
  | "expertise"

export type CharacterSkills = Partial<
  Record<Skill, SkillProficiency>
>

export type HitDice = Array<{
  dice: number
  diceValue: number
  max: number
  current: number
}>