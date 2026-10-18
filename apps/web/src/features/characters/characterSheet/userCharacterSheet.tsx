import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { setMaxHp } from "../../../models/characters/characterHp"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { Skills } from "./skills/skills"
import { UserCharacterIdentity } from "./userCharacterIdentity"
import { UserCharacterStatistics } from "./userCharacterStatistics"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

/**
 * Informational sheet used only by /user.
 *
 * Gameplay-oriented state intentionally does not belong here: current/temp HP,
 * conditions, rests, action economy, attack calculators and the minimal combat
 * sheet remain exclusive to the session character view.
 */
export function UserCharacterSheet({ character, updateCharacter }: Props) {
  const { isEditing = false } = useCharacterWorkspace()
  const maxHp = character.get("sheet").HP.max

  return (
    <div className="grid gap-4">
      <UserCharacterIdentity
        character={character}
        updateCharacter={updateCharacter}
      />

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-textH">
            Pontos de vida máximos
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            Valor estrutural da ficha. Vida atual e vida temporária pertencem à sessão.
          </p>
        </div>

        <label className="grid max-w-48 gap-1 text-xs text-textMuted">
          Vida máxima
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            readOnly={!isEditing}
            value={maxHp}
            onChange={(event) => {
              const value = Math.max(1, Math.trunc(Number(event.target.value) || 1))
              updateCharacter(character.get("id"), (current) =>
                setMaxHp(current, value),
              )
            }}
          />
        </label>
      </section>

      <UserCharacterStatistics
        character={character}
        updateCharacter={updateCharacter}
      />

      <div className={isEditing ? undefined : "pointer-events-none"}>
        <Skills
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>
    </div>
  )
}
