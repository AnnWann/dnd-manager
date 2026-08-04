import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  getMyCharacters,
  type UserCharacterSummary,
} from "../../api/user-characters"
import { getApiStatus } from "../../api/api-client"

export function UserCharactersTab() {
  const navigate = useNavigate()

  const [characters, setCharacters] =
    useState<UserCharacterSummary[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const result = await getMyCharacters()

        if (active) {
          setCharacters(Array.isArray(result) ? result : [])
        }
      } catch (error) {
        const status = getApiStatus(error)

        if (status === 401) {
          navigate("/auth", { replace: true })
          return
        }

        if (status === 403) {
          navigate("/unauthorized", { replace: true })
          return
        }

        if (active) {
          setErrorMessage(
            "Não foi possível carregar seus personagens.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [navigate])

  if (loading) {
    return <div>Carregando personagens...</div>
  }

  if (errorMessage) {
    return <div>{errorMessage}</div>
  }

  return (
    <div>
      <h1>Meus personagens</h1>

      {characters.length === 0 ? (
        <p>Você ainda não possui personagens.</p>
      ) : (
        characters.map((character) => (
          <article key={character.id}>
            <h2>{character.name}</h2>
          </article>
        ))
      )}
    </div>
  )
}