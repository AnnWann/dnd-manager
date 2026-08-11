import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'
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
    return (
      getCustomNativeStatOverride(this, 'armorClass') ??
      originalArmorClass.call(this)
    )
  }

  CharacterTemplate.prototype.getEffectiveInitiative = function (
    this: CharacterTemplate,
  ): number {
    return (
      getCustomNativeStatOverride(this, 'initiative') ??
      originalInitiative.call(this)
    )
  }

  CharacterTemplate.prototype.getEffectiveMobility = function (
    this: CharacterTemplate,
  ): number {
    const value =
      getCustomNativeStatOverride(this, 'mobility') ??
      originalMobility.call(this)
    return Math.max(0, value)
  }

  CharacterTemplate.prototype.getEffectivePassivePerception = function (
    this: CharacterTemplate,
  ): number {
    return (
      getCustomNativeStatOverride(this, 'passivePerception') ??
      originalPassivePerception.call(this)
    )
  }
}

installCharacterCustomSystemsSerializationPatch()
