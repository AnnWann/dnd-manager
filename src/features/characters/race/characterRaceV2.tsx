import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { SessionAbilityOperation } from "../../session-runtime/abilitySessionProtocol"
import { CharacterWorkspaceProvider, useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import { CharacterRaceTab as BaseCharacterRaceTab } from "./characterRaceV2Base"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterRaceTab({ character, updateCharacter }: Props) {
  const workspace = useCharacterWorkspace()
  const runtime = useOptionalSessionRuntime()

  if (!runtime) {
    return <BaseCharacterRaceTab character={character} updateCharacter={updateCharacter} />
  }

  const authoritativeCharacter =
    workspace.characters.find((entry) => entry.get("id") === character.get("id")) ?? character

  const sessionUpdateCharacter = (
    characterId: string,
    updater: (current: CharacterTemplate) => CharacterTemplate,
  ) => {
    if (characterId !== authoritativeCharacter.get("id")) return
    const next = updater(authoritativeCharacter)
    const operation = deriveRacialAbilityOperation(authoritativeCharacter, next)
    if (operation) {
      runtime.dispatchAbilityOperation(operation)
      return
    }
    console.warn("[session-runtime] blocked an unrecognized local race mutation", { characterId })
  }

  const sessionUpdateCharacterDomain: typeof workspace.updateCharacterDomain = (
    characterId,
    domain,
    updater,
  ) => {
    if (characterId !== authoritativeCharacter.get("id")) return
    const next = updater(authoritativeCharacter)

    if (domain === "sheet") {
      const sheet = next.get("sheet")
      runtime.dispatchRaceOperation({
        type: "character.race.replace",
        characterId,
        race: sheet.race,
        skills: sheet.skills,
        savingThrowProficiencies: sheet.savingThrowProficiencies,
      })
      return
    }

    if (domain === "magic") {
      const racialSpells = next
        .getOrCreateMagic()
        .spells.knownSpells
        .filter((entry) => entry.source.type === "race")
        .map((entry) => entry as unknown as Record<string, unknown>)
      runtime.dispatchRaceOperation({
        type: "character.race.spells.replace",
        characterId,
        racialSpells,
      })
      return
    }

    console.warn("[session-runtime] blocked an unrecognized race domain mutation", {
      characterId,
      domain,
    })
  }

  const value = {
    ...workspace,
    updateCharacter: sessionUpdateCharacter,
    updateCharacterDomain: sessionUpdateCharacterDomain,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      <BaseCharacterRaceTab
        character={authoritativeCharacter}
        updateCharacter={sessionUpdateCharacter}
      />
    </CharacterWorkspaceProvider>
  )
}

function deriveRacialAbilityOperation(
  current: CharacterTemplate,
  next: CharacterTemplate,
): SessionAbilityOperation | null {
  const beforeRace = current.get("sheet").race
  const afterRace = next.get("sheet").race
  const { naturalAbilities: beforeAbilities, ...beforeStructural } = beforeRace
  const { naturalAbilities: afterAbilities, ...afterStructural } = afterRace

  if (JSON.stringify(beforeStructural) !== JSON.stringify(afterStructural)) return null
  if (beforeAbilities.length !== afterAbilities.length) return null
  if (beforeAbilities.some((ability, index) => ability.id !== afterAbilities[index]?.id)) return null

  const changed = beforeAbilities
    .map((before, index) => ({ before, after: afterAbilities[index] }))
    .filter(({ before, after }) => after && JSON.stringify(before) !== JSON.stringify(after))
  if (changed.length !== 1) return null

  const { before, after } = changed[0]
  if (!after) return null
  const characterId = current.get("id")
  const source = { type: "race" as const, abilityId: before.id }
  const beforeUsed = Number(before.usage?.used ?? 0)
  const afterUsed = Number(after.usage?.used ?? 0)

  if (afterUsed === beforeUsed + 1 || (!before.benefitsActive && after.benefitsActive)) {
    return {
      type: "character.ability.use",
      characterId,
      source,
      abilityName: before.name,
    }
  }
  if (afterUsed === beforeUsed - 1) {
    return {
      type: "character.ability.restore",
      characterId,
      source,
      abilityName: before.name,
    }
  }
  if (before.benefitsActive && !after.benefitsActive) {
    return {
      type: "character.ability.deactivate",
      characterId,
      source,
      abilityName: before.name,
    }
  }

  return null
}
