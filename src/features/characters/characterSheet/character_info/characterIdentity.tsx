import type { Player } from "../../../../models/player/Player"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"

import { Input } from "../../../../components/ui/Input"
import { trimSingleLine } from "../../../../lib/textNormalization"
import { SelectCharacterOwner } from "./components/selectCharacterOwner"
import { SelectCharacterType } from "./components/selectCharacterType"
import { SelectCharacterUniqueness } from "./components/selectCharacterUniqueness"
import { SelectCharacterVisibility } from "./components/selectCharacterVisibility"
import { CLASS_NAMES } from "../../../../contexts/consts"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  canAssignOwners: boolean
  canEditCharacterType: boolean
  playerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

export function CharacterIdentity({
  character,
  updateCharacter,
  canAssignOwners,
  canEditCharacterType,
  playerKeys,
  getOwner,
  createOwner,
}: Props) {
  const classes = character.get("sheet").classes ?? []
  const totalLevel = classes.reduce(
    (total, characterClass) => total + characterClass.level,
    0,
  )
  const classDescription =
    classes.length > 0
      ? classes
          .map(
            (characterClass) =>
              `${CLASS_NAMES[characterClass.className]} ${characterClass.level}`,
          )
          .join(" / ")
      : "Sem classe"

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-textMuted">
            Nome do personagem
          </span>

          <Input
            className="h-12 text-lg font-semibold"
            value={character.get("name")}
            onChange={(event) =>
              updateCharacter(character.get("id"), (current) =>
                current.with("name", event.target.value),
              )
            }
            onBlur={(event) =>
              updateCharacter(character.get("id"), (current) =>
                current.with("name", trimSingleLine(event.target.value)),
              )
            }
          />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-textMuted">
              Classe
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-textH">
              {classDescription}
            </div>
          </div>

          <div className="flex min-w-20 flex-col items-center justify-center rounded-lg border border-accentBorder bg-accentBg px-3">
            <span className="text-xs uppercase tracking-wide text-textMuted">
              Nível
            </span>
            <strong className="text-xl text-textH">{totalLevel}</strong>
          </div>
        </div>
      </div>

      {(canAssignOwners || canEditCharacterType) && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-medium text-text">
            Configuração do personagem
          </summary>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectCharacterType
              character={character}
              updateCharacter={updateCharacter}
              canEditCharacterType={canEditCharacterType}
            />

            {canAssignOwners && (
              <>
                <SelectCharacterVisibility
                  character={character}
                  updateCharacter={updateCharacter}
                />
                <SelectCharacterOwner
                  character={character}
                  updateCharacter={updateCharacter}
                  playerKeys={playerKeys}
                  getOwner={getOwner}
                  createOwner={createOwner}
                />
                <SelectCharacterUniqueness
                  character={character}
                  updateCharacter={updateCharacter}
                />
              </>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
