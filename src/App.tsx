import { useEffect, useMemo, useState } from "react"
import { Button } from "./components/ui/Button"
import { Card, CardContent, CardHeader } from "./components/ui/Card"
import {
  AppSidebar,
  IconCharacter,
  IconSync,
} from "./components/AppSidebar"
import { useSwipeViews } from "./hooks/useSwipeViews"
import { useRemoteAppState } from "./lib/remoteState"
import { SyncView } from "./views/SyncView"
import { CharacterView } from "./views/CharacterView"
import { CharacterTemplate } from "./models/characters/CharacterTemplate"
import type { Player } from "./models/player/Player"
import { newCharacterTemplate } from "./lib/newCharacterTemplate"

function App() {
  const swipe = useSwipeViews({ viewCount: 2, initialIndex: 1 })
  const viewIndex = swipe.viewIndex as 0 | 1

  const {
    syncKey,
    setSyncKey,
    userRole,
    setUserRole,
    userKey,
    setUserKey,
    canSync,
    state: appState,
    setState: setAppState,
    status: syncStatus,
    pullFromServer,
  } = useRemoteAppState()

  const [selectedCharacterId, setSelectedCharacterId] = useState("")

  const characters = useMemo(
    () =>
      appState.characters.map((c) =>
        c instanceof CharacterTemplate
          ? c
          : CharacterTemplate.fromJSON(c),
      ),
    [appState.characters],
  )

  const canAssignOwners = userRole === "master"
  const canEditCharacterType = userRole === "master"

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

    const character = newCharacterTemplate(
      "Meu personagem",
      getOwner(userKey),
    )

    setAppState((prev) => ({
      ...prev,
      characters: [character.toJSON()],
      activeCharacterId: character.get("id"),
    }))

    setSelectedCharacterId(character.get("id"))
  }, [characters.length, setAppState])

  function updateCharacter(
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) {
    setAppState((prev) => ({
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

    setAppState((prev) => ({
      ...prev,
      characters: [...prev.characters, character.toJSON()],
      activeCharacterId: character.get("id"),
    }))

    setSelectedCharacterId(character.get("id"))
  }

  function deleteCharacter(characterId: string) {
    setAppState((prev) => ({
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

  const playersById = useMemo(() => {
    const map = new Map<string, Player>()

    for (const character of characters) {
      const owner = character.get("owner")
      if (owner?.id) map.set(owner.id, owner)
    }

    return map
  }, [characters])

  function getOwner(ownerId: string): Player {
    return (
      playersById.get(ownerId) ??
      ({
        id: ownerId,
        name: ownerId,
      } as Player)
    )
  }

  function createOwner(ownerName: string): Player {
    return {
      id: ownerName.trim() || crypto.randomUUID(),
      name: ownerName.trim() || "Novo jogador",
    } as Player
  }

  function setView(next: 0 | 1) {
    swipe.setViewIndex(next)
  }

  const sidebarItems = [
    {
      label: "Sync",
      icon: <IconSync />,
      active: viewIndex === 0,
      onClick: () => setView(0),
    },
    {
      label: "Ficha",
      icon: <IconCharacter />,
      active: viewIndex === 1,
      onClick: () => setView(1),
    },
  ]

  if (!activeCharacter) {
    return (
      <div className="min-h-svh bg-[color:var(--social-bg)] text-text">
        <header className="border-b border-accentBorder bg-accentBg">
          <div className="flex w-full flex-col gap-3 px-4 py-3">
            <h1 className="font-heading text-xl text-textH">
              Gerenciador de Magias (D&amp;D)
            </h1>
            <p className="text-xs text-text">Sync • Ficha</p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl px-4 py-6">
          <SyncView
            syncKey={syncKey}
            setSyncKey={setSyncKey}
            userRole={userRole}
            setUserRole={setUserRole}
            userKey={userKey}
            setUserKey={setUserKey}
            canSync={canSync}
            pullFromServer={pullFromServer}
            syncStatus={syncStatus}
            footer={
              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold text-textH">
                    Nenhum personagem visível
                  </div>
                  <div className="mt-1 text-xs text-text">
                    Se você estiver como player, só verá personagens atribuídos a você.
                  </div>
                </CardHeader>

                <CardContent>
                  <Button variant="primary" onClick={addCharacter}>
                    Adicionar personagem
                  </Button>
                </CardContent>
              </Card>
            }
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[color:var(--social-bg)] text-text">
      <header className="border-b border-accentBorder bg-accentBg">
        <div className="flex w-full flex-col gap-3 px-4 py-3">
          <h1 className="font-heading text-xl text-textH">
            Gerenciador de Magias (D&amp;D)
          </h1>
          <p className="text-xs text-text">Sync • Ficha</p>
        </div>
      </header>

      <div className="flex min-h-[calc(100svh-73px)]">
        <AppSidebar items={sidebarItems} />

        <main
          ref={swipe.swipeRootRef}
          className="mmSwipeRoot min-w-0 flex-1 overflow-hidden"
          onPointerDown={swipe.onPointerDown}
          onPointerMove={swipe.onPointerMove}
          onPointerUp={swipe.onPointerUpOrCancel}
          onPointerCancel={swipe.onPointerUpOrCancel}
        >
          <div
            className="mmSwipeInner flex h-full"
            style={{
              transform: swipe.innerTransform,
              transition: swipe.isDragging ? "none" : "transform 220ms ease",
            }}
          >
            <div className="w-full flex-none px-4 py-6">
              <SyncView
                syncKey={syncKey}
                setSyncKey={setSyncKey}
                userRole={userRole}
                setUserRole={setUserRole}
                userKey={userKey}
                setUserKey={setUserKey}
                canSync={canSync}
                pullFromServer={pullFromServer}
                syncStatus={syncStatus}
              />
            </div>

            <div className="w-full flex-none px-4 py-6">
              <CharacterView
                characters={visibleCharacters}
                activeCharacter={activeCharacter}
                setActiveCharacterId={setSelectedCharacterId}
                addCharacter={addCharacter}
                deleteActiveCharacter={() =>
                  deleteCharacter(activeCharacter.get("id"))
                }
                disableDelete={visibleCharacters.length <= 1}
                updateCharacter={updateCharacter}
                canAssignOwners={canAssignOwners}
                canEditCharacterType={canEditCharacterType}
                playerKeys={knownPlayerKeys}
                getOwner={getOwner}
                createOwner={createOwner}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App