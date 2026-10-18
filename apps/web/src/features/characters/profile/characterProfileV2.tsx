import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getCharacterBackground } from "../../../models/characters/characterBackgroundStorage"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { CharacterWorkspaceProvider, useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { CharacterBackgroundSection } from "./characterBackgroundSection"
import { CharacterProfileTab as BaseCharacterProfileTab } from "./characterProfile"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterProfileTab({
  character,
  updateCharacter,
}: Props) {
  const workspace = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()

  if (!runtime) {
    const mutationsDisabled = workspace.mode === "user" && !workspace.isEditing

    return (
      <fieldset
        disabled={mutationsDisabled}
        className="m-0 min-w-0 border-0 p-0 disabled:opacity-75"
      >
        <ProfileContent character={character} updateCharacter={updateCharacter} />
      </fieldset>
    )
  }

  const authoritativeCharacter =
    workspace.characters.find((entry) => entry.get("id") === character.get("id")) ?? character

  const sessionUpdateCharacter = (
    characterId: string,
    updater: (current: CharacterTemplate) => CharacterTemplate,
  ) => {
    if (characterId !== authoritativeCharacter.get("id")) return
    const next = updater(authoritativeCharacter)
    const beforeBackground = getCharacterBackground(authoritativeCharacter)
    const afterBackground = getCharacterBackground(next)

    if (JSON.stringify(beforeBackground) !== JSON.stringify(afterBackground)) {
      if (!afterBackground) {
        runtime.dispatchProfileOperation({
          type: "character.profile.background.remove",
          characterId,
        })
        return
      }

      runtime.dispatchProfileOperation({
        type: "character.profile.background.save",
        characterId,
        background: afterBackground,
        addEquipment:
          JSON.stringify(authoritativeCharacter.get("inventory")) !==
          JSON.stringify(next.get("inventory")),
      })
      return
    }

    const profileChanged =
      JSON.stringify(authoritativeCharacter.get("profile")) !==
      JSON.stringify(next.get("profile"))
    const unrelatedChange = hasUnrelatedProfileMutation(authoritativeCharacter, next)
    if (profileChanged && !unrelatedChange) {
      runtime.dispatchProfileOperation({
        type: "character.profile.replace",
        characterId,
        profile: next.get("profile"),
      })
      return
    }

    console.warn("[session-runtime] blocked an unrecognized local profile mutation", {
      characterId,
    })
  }

  const value = {
    ...workspace,
    updateCharacter: sessionUpdateCharacter,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      <ProfileContent
        character={authoritativeCharacter}
        updateCharacter={sessionUpdateCharacter}
      />
    </CharacterWorkspaceProvider>
  )
}

function ProfileContent({ character, updateCharacter }: Props) {
  return (
    <div className="grid gap-4">
      <CharacterBackgroundSection
        character={character}
        updateCharacter={updateCharacter}
      />
      <BaseCharacterProfileTab
        character={character}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}

function hasUnrelatedProfileMutation(
  current: CharacterTemplate,
  next: CharacterTemplate,
): boolean {
  const currentJson = current.toJSON()
  const nextJson = next.toJSON()
  const { profile: _currentProfile, ...currentRest } = currentJson
  const { profile: _nextProfile, ...nextRest } = nextJson
  return JSON.stringify(currentRest) !== JSON.stringify(nextRest)
}
