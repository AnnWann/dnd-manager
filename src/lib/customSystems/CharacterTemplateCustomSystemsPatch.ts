import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'
import {
  applyBonuses,
  getCharacterBonuses,
  getStatAdjustment,
} from '../../models/characters/characterStats'
import { getCustomNativeStatOverride } from './CustomNativeStatOverrides'
import { recalculateCustomSystemState } from './CustomFormulaRuntimePatch'

let installed = false

/**
 * Compatibility patch for custom-system properties that are not yet rebuilt
 * directly by CharacterTemplate.fromJSON, plus the runtime hooks that allow a
 * system to replace derived native-sheet calculations.
 */
export function installCharacterCustomSystemsSerializationPatch(): void {
  if (installed) return
  installed = true

  installNativeStatOverrides()

  const originalFromJSON = CharacterTemplate.fromJSON.bind(CharacterTemplate)

  CharacterTemplate.fromJSON = (
    props: Partial<CharacterTemplateProps>,
  ): CharacterTemplate => {
    let restored = originalFromJSON(props)
    const customSystems = props.sheet?.customSystems
    const hiddenCharacterTabs = props.sheet?.hiddenCharacterTabs

    if (Array.isArray(customSystems)) {
      restored = restored.withSheet(
        'customSystems',
        customSystems.map((state) =>
          recalculateCustomSystemState(state, restored),
        ),
      )
    }

    if (Array.isArray(hiddenCharacterTabs)) {
      restored = restored.withSheet(
        'hiddenCharacterTabs',
        hiddenCharacterTabs.filter(
          (entry): entry is string => typeof entry === 'string',
        ),
      )
    }

    return restored
  }
}

function installNativeStatOverrides() {
  const originalArmorClass = CharacterTemplate.prototype.getEffectiveArmorClass
  const originalInitiative = CharacterTemplate.prototype.getEffectiveInitiative
  const originalMobility = CharacterTemplate.prototype.getEffectiveMobility
  const originalPassivePerception =
    CharacterTemplate.prototype.getEffectivePassivePerception

  CharacterTemplate.prototype.getEffectiveArmorClass = function (
    this: CharacterTemplate,
  ): number {
    const base = getCustomNativeStatOverride(this, 'armorClass')
    if (base === undefined) return originalArmorClass.call(this)
    return applyNativeBonuses(this, base, 'armorClass', 'armorClassAdjustment')
  }

  CharacterTemplate.prototype.getEffectiveInitiative = function (
    this: CharacterTemplate,
  ): number {
    const base = getCustomNativeStatOverride(this, 'initiative')
    if (base === undefined) return originalInitiative.call(this)
    return applyNativeBonuses(this, base, 'initiative', 'initiativeAdjustment')
  }

  CharacterTemplate.prototype.getEffectiveMobility = function (
    this: CharacterTemplate,
  ): number {
    const base = getCustomNativeStatOverride(this, 'mobility')
    if (base === undefined) return originalMobility.call(this)
    return Math.max(
      0,
      applyNativeBonuses(this, base, 'speed', 'mobilityAdjustment'),
    )
  }

  CharacterTemplate.prototype.getEffectivePassivePerception = function (
    this: CharacterTemplate,
  ): number {
    const base = getCustomNativeStatOverride(this, 'passivePerception')
    if (base === undefined) return originalPassivePerception.call(this)
    return applyNativeBonuses(
      this,
      base,
      'passivePerception',
      'passivePerceptionAdjustment',
    )
  }
}

function applyNativeBonuses(
  character: CharacterTemplate,
  base: number,
  bonusKey: 'armorClass' | 'initiative' | 'speed' | 'passivePerception',
  adjustmentKey:
    | 'armorClassAdjustment'
    | 'initiativeAdjustment'
    | 'mobilityAdjustment'
    | 'passivePerceptionAdjustment',
): number {
  // A fórmula customizada substitui apenas o cálculo-base. Bônus aditivos de
  // equipamentos, habilidades e condições continuam sendo aplicados depois.
  // Bônus flat representam outro cálculo-base e, portanto, não sobrepõem a
  // fórmula customizada.
  const bonuses = getCharacterBonuses(character, bonusKey).filter(
    (bonus) => bonus.type !== 'flat',
  )
  return applyBonuses(base, bonuses) + getStatAdjustment(character, adjustmentKey)
}

installCharacterCustomSystemsSerializationPatch()
