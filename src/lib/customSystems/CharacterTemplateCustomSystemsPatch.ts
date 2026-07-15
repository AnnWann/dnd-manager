import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'

let installed = false

/**
 * Compatibility patch for the current CharacterTemplate deserializer.
 *
 * CharacterTemplate.fromJSON rebuilds the sheet property-by-property. Until
 * customSystems is handled directly by that model, this wrapper preserves the
 * already-normalized custom state instead of silently discarding it.
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

    return restored.withSheet('customSystems', customSystems)
  }
}

installCharacterCustomSystemsSerializationPatch()
