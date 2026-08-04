import { Download, Upload } from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"

import {
  createMyCharacter,
  deleteMyCharacter,
  getMyCharacter,
  getMyCharacters,
  updateMyCharacter,
  type UserCharacterSummary,
} from "../../api/user-characters"
import { getApiStatus } from "../../api/api-client"
import { createOwnedHomebrewSpell } from "../../api/user-spells"
import { Button } from "../../components/ui/Button"
import { useMagicContext } from "../../contexts/magicContext"
import { CharacterSelectorList } from "../../features/characters/selector/CharacterSelectorList"
import { toUserCharacterSelectorItem } from "../../features/characters/selector/userCharacterSelectorAdapter"
import { useUserMagicState } from "../../features/magic/UserMagicProvider"
import type { Spell } from "../../models/magic/spells/Spell"

type CharacterExportBundle = {
  format: "dnd-manager-character"
  version: 3
  character: Record<string, unknown>
  homebrewSpells: Spell[]
}

export function UserCharactersTab() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { savedSpells, spellByIndex } = useMagicContext()
  const { reload: reloadHomebrewSpells } = useUserMagicState()

  const [characters, setCharacters] =
    useState<UserCharacterSummary[]>([])
  const [selectedCharacterId, setSelectedCharacterId] =
    useState("")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true

    async function loadCharacters() {
      setLoading(true)
      setErrorMessage("")

      try {
        const result = await getMyCharacters()

        if (!active) return

        const nextCharacters = Array.isArray(result) ? result : []
        setCharacters(nextCharacters)
        setSelectedCharacterId((current) =>
          nextCharacters.some((character) => character.id === current)
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
        if (active) setLoading(false)
      }
    }

    void loadCharacters()

    return () => {
      active = false
    }
  }, [navigate])

  const selectorCharacters = useMemo(
    () => characters.map(toUserCharacterSelectorItem),
    [characters],
  )

  function openCharacter(characterId: string) {
    navigate(
      `/user/characters/${encodeURIComponent(characterId)}/sheet`,
    )
  }

  function createCharacter() {
    navigate("/user/characters/create")
  }

  async function exportSelectedCharacter() {
    if (!selectedCharacterId || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      const selected = await getMyCharacter(selectedCharacterId)
      const indexes = collectReferencedSpellIndexes(selected.data)
      const homebrewSpells = savedSpells.filter(
        (spell) => spell.homebrew && indexes.has(spell.index),
      )
      const bundle: CharacterExportBundle = {
        format: "dnd-manager-character",
        version: 3,
        character: {
          ...selected.data,
          name: selected.name,
          visibility: selected.visibility.toLowerCase(),
        },
        homebrewSpells,
      }

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const safeName =
        selected.name
          .trim()
          .replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "personagem"

      anchor.href = url
      anchor.download = `${safeName}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErrorMessage("Não foi possível exportar o personagem.")
    } finally {
      setWorking(false)
    }
  }

  async function importFromFile(file?: File) {
    if (!file || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const bundle = parseCharacterExport(parsed)
      const indexMap = new Map<string, string>()

      for (const spell of bundle.homebrewSpells) {
        if (spellByIndex.has(spell.index)) continue

        const created = await createOwnedHomebrewSpell(spell)
        indexMap.set(spell.index, created.index)
      }

      const remappedCharacter = remapSpellIndexes(
        bundle.character,
        indexMap,
      ) as Record<string, unknown>
      const name =
        typeof remappedCharacter.name === "string" &&
        remappedCharacter.name.trim()
          ? remappedCharacter.name.trim()
          : "Personagem importado"
      const characterData = {
        ...remappedCharacter,
        id: crypto.randomUUID(),
        name,
        visibility: "private",
      }

      const created = await createMyCharacter({
        name,
        visibility: "PRIVATE",
        data: characterData,
      })

      // O POST cria a ficha; o PATCH executa a sincronização relacional das
      // magias homebrew agora que os novos índices já existem no banco.
      const synchronized = await updateMyCharacter(
        created.id,
        characterData,
        {
          name,
          visibility: "PRIVATE",
        },
      )

      if (indexMap.size) await reloadHomebrewSpells()

      setCharacters((current) => [
        synchronized,
        ...current.filter((entry) => entry.id !== synchronized.id),
      ])
      setSelectedCharacterId(synchronized.id)
      navigate(
        `/user/characters/${encodeURIComponent(synchronized.id)}/profile`,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o personagem.",
      )
    } finally {
      setWorking(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function deleteCharacter(characterId: string) {
    const character = characters.find((entry) => entry.id === characterId)
    const confirmed = window.confirm(
      `Excluir permanentemente “${character?.name ?? "este personagem"}”?\n\n` +
        "Esta ação não pode ser desfeita. Exporte o JSON antes para manter uma cópia.",
    )

    if (!confirmed || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      await deleteMyCharacter(characterId)
      const remaining = characters.filter(
        (entry) => entry.id !== characterId,
      )
      setCharacters(remaining)
      setSelectedCharacterId((current) =>
        current === characterId ? remaining[0]?.id ?? "" : current,
      )
    } catch {
      setErrorMessage("Não foi possível excluir o personagem.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <CharacterSelectorList
        title="Meus personagens"
        description="Clique uma vez para selecionar e novamente para abrir a ficha."
        characters={selectorCharacters}
        selectedCharacterId={selectedCharacterId}
        loading={loading}
        errorMessage={errorMessage}
        emptyMessage="Você ainda não possui personagens."
        onSelectCharacter={setSelectedCharacterId}
        onOpenCharacter={openCharacter}
        onAddCharacter={createCharacter}
        onDeleteCharacter={deleteCharacter}
        headerActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedCharacterId || working}
              onClick={() => void exportSelectedCharacter()}
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Importar JSON
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) =>
          void importFromFile(event.target.files?.[0])
        }
      />
    </>
  )
}

function collectReferencedSpellIndexes(value: unknown): Set<string> {
  const indexes = new Set<string>()

  function visit(current: unknown) {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }

    if (!isRecord(current)) return

    if (
      typeof current.index === "string" &&
      current.index.trim() &&
      ("castingMode" in current || "usage" in current)
    ) {
      indexes.add(current.index.trim())
    }

    if (
      isRecord(current.spells) &&
      typeof current.spells.id === "string" &&
      current.spells.id.trim()
    ) {
      indexes.add(current.spells.id.trim())
    }

    Object.values(current).forEach(visit)
  }

  visit(value)
  return indexes
}

function remapSpellIndexes(
  value: unknown,
  indexMap: ReadonlyMap<string, string>,
  parentKey = "",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      remapSpellIndexes(entry, indexMap, parentKey),
    )
  }

  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const isSpellIndexField =
        key === "index" || (key === "id" && parentKey === "spells")
      const mapped =
        isSpellIndexField && typeof child === "string"
          ? indexMap.get(child) ?? child
          : remapSpellIndexes(child, indexMap, key)

      return [key, mapped]
    }),
  )
}

function parseCharacterExport(value: unknown): {
  character: Record<string, unknown>
  homebrewSpells: Spell[]
} {
  if (!isRecord(value)) {
    throw new Error("O arquivo não contém um personagem válido.")
  }

  if (value.format === "dnd-manager-character") {
    if (!isRecord(value.character)) {
      throw new Error("O pacote não contém os dados do personagem.")
    }

    return {
      character: value.character,
      homebrewSpells: Array.isArray(value.homebrewSpells)
        ? value.homebrewSpells.filter(isEmbeddedHomebrewSpell)
        : [],
    }
  }

  return {
    character: value,
    homebrewSpells: [],
  }
}

function isEmbeddedHomebrewSpell(value: unknown): value is Spell {
  return (
    isRecord(value) &&
    value.homebrew === true &&
    typeof value.index === "string" &&
    value.index.trim().length > 0 &&
    typeof value.name === "string"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
