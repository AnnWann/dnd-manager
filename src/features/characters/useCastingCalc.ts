import { useMemo, useState } from 'react'
import type { Character } from '../../types'
import { equipmentBonuses } from '../../lib/character'
import { spellAttackBonus, spellSaveDc, totalLevel } from '../../lib/rules'

export function useCastingCalc(activeCharacter: Character | undefined) {
  const [calcClassId, setCalcClassId] = useState<string>('')

  const activeCharacterTotalLevel = useMemo(() => {
    if (!activeCharacter) return 1
    const levels = activeCharacter.classes.map((c) => c.level)
    return Math.max(1, totalLevel(levels))
  }, [activeCharacter])

  const effectiveCalcClassId = useMemo(() => {
    return calcClassId || activeCharacter?.classes[0]?.id || ''
  }, [activeCharacter?.classes, calcClassId])

  const { atk, dc } = useMemo(() => {
    if (!activeCharacter) return { atk: 0, dc: 0 }

    const selectedCalcClass = activeCharacter.classes.find((c) => c.id === effectiveCalcClassId)
    const calcAbilityScore = selectedCalcClass
      ? activeCharacter.attributes[selectedCalcClass.castingAbility]
      : activeCharacter.attributes.int
    const calcClassLevel = selectedCalcClass?.level ?? activeCharacterTotalLevel
    const eqBonuses = equipmentBonuses(activeCharacter)

    const atkBase = spellAttackBonus({
      proficiencyMode: activeCharacter.proficiencyMode,
      totalCharacterLevel: activeCharacterTotalLevel,
      classLevel: calcClassLevel,
      abilityScore: calcAbilityScore,
    })
    const atk = atkBase + eqBonuses.attackBonus

    const dc = spellSaveDc({
      proficiencyMode: activeCharacter.proficiencyMode,
      totalCharacterLevel: activeCharacterTotalLevel,
      classLevel: calcClassLevel,
      abilityScore: calcAbilityScore,
    })

    return { atk, dc }
  }, [activeCharacter, activeCharacterTotalLevel, effectiveCalcClassId])

  return {
    calcClassId,
    setCalcClassId,
    activeCharacterTotalLevel,
    effectiveCalcClassId,
    atk,
    dc,
  }
}
