import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'
import { recalculateCustomSystemState } from './CustomFormulaRuntimePatch'

let installed = false

/**
 * Compatibility patch for the current CharacterTemplate deserializer.
 *
 * CharacterTemplate.fromJSON rebuilds the sheet property-by-property. Until
 * customSystems is handled directly by that model, this wrapper preserves the
 * already-normalized custom state and refreshes derived formula values.
 */
export function installCharacterCustomSystemsSerializationPatch(): void {
  if (installed) return
  installed = true

  const originalFromJSON = CharacterTemplate.fromJSON.bind(CharacterTemplate)

  CharacterTemplate.fromJSON = (
    props: Partial<CharacterTemplateProps>,
  ): CharacterTemplate => {
    const restored = originalFromJSON(props)
    const customSystems = props.sheet?.customSystems

    if (!Array.isArray(customSystems)) return restored

    return restored.withSheet(
      'customSystems',
      customSystems.map(recalculateCustomSystemState),
    )
  }
}

installCharacterCustomSystemsSerializationPatch()
