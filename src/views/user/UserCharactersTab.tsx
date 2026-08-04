import {
  useEffect,
  useMemo,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"

import {
  getMyCharacters,
  type UserCharacterSummary,
} from "../../api/user-characters"
import { getApiStatus } from "../../api/api-client"
import { CharacterSelectorList } from "../../features/characters/selector/CharacterSelectorList"
import { toUserCharacterSelectorItem } from "../../features/characters/selector/userCharacterSelectorAdapter"

export function UserCharactersTab() {
  const navigate = useNavigate()

  const [characters, setCharacters] =
    useState<UserCharacterSummary[]>([])

  const [selectedCharacterId, setSelectedCharacterId] =
    useState("")

  const [loading, setLoading] =
    useState(true)

  const [errorMessage, setErrorMessage] =
    useState("")

  useEffect(() => {
    let active = true

    async function loadCharacters() {
      setLoading(true)
      setErrorMessage("")

      try {
        const result = await getMyCharacters()

        if (!active) return

        const nextCharacters =
          Array.isArray(result)
            ? result
            : []

        setCharacters(nextCharacters)

        setSelectedCharacterId(
          (current) =>
            nextCharacters.some(
              (character) =>
                character.id === current,
            )
              ? current
              : nextCharacters[0]?.id ?? "",
        )
      } catch (error) {
        if (!active) return

        const status = getApiStatus(error)

        if (status === 401) {
          navigate("/auth", {
            replace: true,
            state: {
              returnTo: "/user/characters",
            },
          })
          return
        }

        if (status === 403) {
          navigate("/unauthorized", {
            replace: true,
          })
          return
        }

        setCharacters([])
        setErrorMessage(
          "Não foi possível carregar seus personagens.",
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadCharacters()

    return () => {
      active = false
    }
  }, [navigate])

  const selectorCharacters = useMemo(
    () =>
      characters.map(
        toUserCharacterSelectorItem,
      ),
    [characters],
  )

  function openCharacter(
    characterId: string,
  ) {
    navigate(
      `/user/characters/${encodeURIComponent(characterId)}/sheet`,
    )
  }

  function createCharacter() {
    navigate("/user/characters/create")
  }

  return (
    <CharacterSelectorList
      title="Meus personagens"
      description="Clique uma vez para selecionar e novamente para abrir a ficha."
      characters={selectorCharacters}
      selectedCharacterId={selectedCharacterId}
      loading={loading}
      errorMessage={errorMessage}
      emptyMessage="Você ainda não possui personagens."
      onSelectCharacter={
        setSelectedCharacterId
      }
      onOpenCharacter={openCharacter}
      onAddCharacter={createCharacter}
    />
  )
}