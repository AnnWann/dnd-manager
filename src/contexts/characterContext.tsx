// src/contexts/characterContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { CharacterTemplate } from "../models/characters/CharacterTemplate"
import type { Player } from "../models/player/Player"
import { newCharacterTemplate } from "../lib/newCharacterTemplate"
import type { AppStateV1 } from "../lib/remoteState"

export type CharacterContextValue = {
  activeCharacter?: CharacterTemplate
  visibleCharacters: CharacterTemplate[]

  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void

  addCharacter: () => void
  deleteCharacter: (id: string) => void
  setSelectedCharacterId: (id: string) => void

  canAssignOwners: boolean
  canEditCharacterType: boolean
  knownPlayerKeys: string[]

  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

type CharacterProviderProps = {
  children: ReactNode
  appState: AppStateV1
  setAppState: React.Dispatch<React.SetStateAction<any>>
  userRole: "master" | "player"
  userKey: string
}

const CharacterContext = createContext<CharacterContextValue | null>(null)

export function CharacterProvider({
  children,
  appState,
  setAppState,
  userRole,
  userKey,
}: CharacterProviderProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState("")

  const characters = useMemo(
    () =>
      appState.characters.map((c: any) =>
        c instanceof CharacterTemplate
          ? c
          : CharacterTemplate.fromJSON(c),
      ),
    [appState.characters],
  )

  const canAssignOwners = userRole === "master"
  const canEditCharacterType = userRole === "master"

  const playersById = useMemo(() => {
    const map = new Map<string, Player>()

    for (const character of characters) {
      const owner = character.get("owner")
      if (owner?.id) map.set(owner.id, owner)
    }

    return map
  }, [characters])

  function getOwner(ownerId: string): Player {
    return playersById.get(ownerId) ?? {
      id: ownerId,
      name: ownerId,
      role: 'player'
    }
  }

  function createOwner(ownerName: string): Player {
    return {
      id: ownerName.trim() || crypto.randomUUID(),
      name: ownerName.trim() || "Novo jogador",
      role: 'player'
    }
  }

  const knownPlayerKeys = useMemo(() => {
    const keys = new Set<string>()

    for (const character of characters) {
      const ownerId = character.get("owner")?.id?.trim()
      if (ownerId) keys.add(ownerId)
    }

    const currentUserKey = userKey.trim()
    if (currentUserKey) keys.add(currentUserKey)

    return Array.from(keys).sort((a, b) => a.localeCompare(b))
  }, [characters, userKey])

  const visibleCharacters = useMemo(() => {
    if (userRole === "master") return characters

    const key = userKey.trim()
    if (!key) return []

    return characters.filter(
      (character) => character.get("owner")?.id?.trim() === key,
    )
  }, [characters, userKey, userRole])

  const activeCharacter = useMemo(
    () =>
      visibleCharacters.find((c) => c.get("id") === selectedCharacterId) ??
      visibleCharacters.find((c) => c.get("id") === appState.activeCharacterId) ??
      visibleCharacters[0],
    [appState.activeCharacterId, selectedCharacterId, visibleCharacters],
  )

  useEffect(() => {
    if (visibleCharacters.length === 0) {
      if (selectedCharacterId !== "") setSelectedCharacterId("")
      return
    }

    const resolved =
      visibleCharacters.find((c) => c.get("id") === selectedCharacterId) ??
      visibleCharacters.find((c) => c.get("id") === appState.activeCharacterId) ??
      visibleCharacters[0]

    if (resolved && resolved.get("id") !== selectedCharacterId) {
      setSelectedCharacterId(resolved.get("id"))
    }
  }, [appState.activeCharacterId, selectedCharacterId, visibleCharacters])

  useEffect(() => {
    if (characters.length > 0) return

    const character = newCharacterTemplate("Meu personagem", getOwner(userKey))

    setAppState((prev: any) => ({
      ...prev,
      characters: [character.toJSON()],
      activeCharacterId: character.get("id"),
    }))

    setSelectedCharacterId(character.get("id"))
  }, [characters.length, setAppState, userKey])

  function updateCharacter(
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) {
    setAppState((prev: AppStateV1) => ({
      ...prev,
      characters: prev.characters.map((rawCharacter) => {
        const character =
          rawCharacter instanceof CharacterTemplate
            ? rawCharacter
            : CharacterTemplate.fromJSON(rawCharacter)

        if (character.get("id") !== characterId) {
          return character.toJSON()
        }

        const nextCharacter = updater(character)

        return nextCharacter.toJSON()
      }),
    }))
  }

  function addCharacter() {
    const character = newCharacterTemplate(
      `Personagem ${characters.length + 1}`,
      getOwner(userKey),
    )

    setAppState((prev: any) => ({
      ...prev,
      characters: [...prev.characters, character.toJSON()],
      activeCharacterId: character.get("id"),
    }))

    setSelectedCharacterId(character.get("id"))
  }

  function deleteCharacter(characterId: string) {
    setAppState((prev: AppStateV1) => ({
      ...prev,
      characters: prev.characters.filter((rawCharacter) => {
        const character =
          rawCharacter instanceof CharacterTemplate
            ? rawCharacter
            : CharacterTemplate.fromJSON(rawCharacter)

        return character.get("id") !== characterId
      }),
    }))

    setSelectedCharacterId((current) =>
      current === characterId ? "" : current,
    )
  }

  return (
    <CharacterContext.Provider
      value={{
        activeCharacter,
        visibleCharacters,
        updateCharacter,
        addCharacter,
        deleteCharacter,
        setSelectedCharacterId,
        canAssignOwners,
        canEditCharacterType,
        knownPlayerKeys,
        getOwner,
        createOwner,
      }}
    >
      {children}
    </CharacterContext.Provider>
  )
}

export function useCharacterContext() {
  const ctx = useContext(CharacterContext)

  if (!ctx) {
    throw new Error(
      "useCharacterContext must be used inside CharacterProvider",
    )
  }

  return ctx
}