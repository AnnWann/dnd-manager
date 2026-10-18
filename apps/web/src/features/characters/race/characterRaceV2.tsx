import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  normalizeDamageAffinities,
  type DamageAffinity,
} from "../../../models/combat/Damage"
import { DamageAffinityEditor } from "../../combat/DamageAffinityEditor"
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
    const mutationsDisabled = workspace.mode === "user" && !workspace.isEditing

    return (
      <fieldset
        disabled={mutationsDisabled}
        className="m-0 min-w-0 border-0 p-0 disabled:opacity-75"
      >
        <div className="grid gap-4">
          <BaseCharacterRaceTab
            character={character}
            updateCharacter={updateCharacter}
          />
          <DamageAffinityEditor
            value={character.get("sheet").damageAffinities ?? []}
            onChange={(damageAffinities) =>
              updateCharacter(character.get("id"), (current) =>
                current.withSheet("damageAffinities", damageAffinities),
              )
            }
            title="Afinidades de dano raciais"
            description="Configure resistências, imunidades e vulnerabilidades concedidas pela raça. Elas entram no mesmo cálculo automático usado pela ficha e pela iniciativa."
          />
        </div>
      </fieldset>
    )
  }

  const authoritativeCharacter =
    workspace.characters.find((entry) => entry.get("id") === character.get("id")) ?? character

  const setDamageAffinities = (damageAffinities: DamageAffinity[]) => {
    runtime.dispatchAbilityOperation({
      type: "character.damageAffinities.set",
      characterId: authoritativeCharacter.get("id"),
      // Normalize at the session boundary as well as when hydrating a character.
      // This keeps legacy aliases or stale optional fields from turning an
      // otherwise valid update into a protocol-level INVALID_MESSAGE.
      damageAffinities: normalizeDamageAffinities(damageAffinities),
    })
  }

  const sessionUpdateCharacter = (
    characterId: string,
    updater: (current: CharacterTemplate) => CharacterTemplate,
  ) => {
    if (characterId !== authoritativeCharacter.get("id")) return
    const next = updater(authoritativeCharacter)

    if (
      JSON.stringify(authoritativeCharacter.get("sheet").damageAffinities ?? []) !==
      JSON.stringify(next.get("sheet").damageAffinities ?? [])
    ) {
      setDamageAffinities(next.get("sheet").damageAffinities ?? [])
      return
    }

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
      <div className="grid gap-4">
        <BaseCharacterRaceTab
          character={authoritativeCharacter}
          updateCharacter={sessionUpdateCharacter}
        />
        <DamageAffinityEditor
          value={authoritativeCharacter.get("sheet").damageAffinities ?? []}
          onChange={setDamageAffinities}
          title="Afinidades de dano raciais"
          description="Configure resistências, imunidades e vulnerabilidades concedidas pela raça. Elas entram no mesmo cálculo automático usado pela ficha e pela iniciativa."
        />
      </div>
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
