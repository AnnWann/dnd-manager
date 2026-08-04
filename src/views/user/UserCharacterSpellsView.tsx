import { Navigate, useNavigate, useParams } from "react-router-dom"

import { Button } from "../../components/ui/Button"
import { CharacterMagicTab } from "../../features/characters/magic/characterMagicModule"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"

export function UserCharacterSpellsView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <UserCharacterWorkspace characterId={characterId}>
      <UserCharacterSpellsContent characterId={characterId} />
    </UserCharacterWorkspace>
  )
}

function UserCharacterSpellsContent({ characterId }: { characterId: string }) {
  const navigate = useNavigate()
  const { characters, updateCharacter } = useCharacterWorkspace()
  const character = characters.find((entry) => entry.get("id") === characterId)

  if (!character) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4 shadow-theme-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-textH">
            Magias de {character.get("name")}
          </h1>
          <p className="mt-1 text-sm text-textMuted">
            Gerencie magias conhecidas, preparadas e recursos mágicos.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate(`/user/characters/${encodeURIComponent(characterId)}/sheet`)}
        >
          Voltar para a ficha
        </Button>
      </header>

      <CharacterMagicTab
        character={character}
        updateCharacter={updateCharacter}
      />
    </div>
  )
}

export function UserCharacterSpellsLegacyRedirect() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <Navigate
      to={`/user/characters/${encodeURIComponent(characterId)}/spells-list`}
      replace
    />
  )
}
