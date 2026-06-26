import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../characters/CharacterTemplate"
import { synchronizeClassFeatures } from "./ClassFeatureSynchronization"

declare global {
  // eslint-disable-next-line no-var
  var __dndManagerClassFeatureSyncInstalled: boolean | undefined
}

if (!globalThis.__dndManagerClassFeatureSyncInstalled) {
  const originalFromJSON = CharacterTemplate.fromJSON.bind(CharacterTemplate)

  CharacterTemplate.fromJSON = (
    props: Partial<CharacterTemplateProps>,
  ): CharacterTemplate => synchronizeClassFeatures(originalFromJSON(props))

  globalThis.__dndManagerClassFeatureSyncInstalled = true
}
