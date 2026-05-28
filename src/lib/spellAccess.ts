import type { CharacterClass, DndSpell } from '../types'

export function spellListClassIndex(classIndex: string): string {
  if (classIndex === 'eldritch_knight') return 'wizard'
  if (classIndex === 'arcane_trickster') return 'wizard'
  return classIndex
}

export function spellListClassIndexForClass(cls: CharacterClass): string {
  if (cls.classIndex === 'fighter' && cls.spellcastingProgression === 'third') return 'wizard'
  if (cls.classIndex === 'rogue' && cls.spellcastingProgression === 'third') return 'wizard'
  return spellListClassIndex(cls.classIndex)
}

export function isAllowedSchoolForClass(classIndex: string, spell?: DndSpell): boolean {
  if (!spell?.school?.name) return true
  const school = spell.school.name
  if (classIndex === 'eldritch_knight') return school === 'Abjuration' || school === 'Evocation'
  if (classIndex === 'arcane_trickster') return school === 'Enchantment' || school === 'Illusion'
  return true
}

export function isAllowedSchoolForCharacterClass(cls: CharacterClass, spell?: DndSpell): boolean {
  if (cls.classIndex === 'fighter' && cls.spellcastingProgression === 'third') {
    return isAllowedSchoolForClass('eldritch_knight', spell)
  }
  if (cls.classIndex === 'rogue' && cls.spellcastingProgression === 'third') {
    return isAllowedSchoolForClass('arcane_trickster', spell)
  }
  return isAllowedSchoolForClass(cls.classIndex, spell)
}
