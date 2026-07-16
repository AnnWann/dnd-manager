import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'
import { recalculateCustomSystemState } from './CustomFormulaRuntimePatch'

let installed = false

/**
 * Compatibility patch for sheet properties that are not yet rebuilt directly
 * by CharacterTemplate.fromJSON.
 */
export function installCharacterCustomSystemsSerializationPatch(): void {
  if (installed) return
  installed = true

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

installCharacterCustomSystemsSerializationPatch()
