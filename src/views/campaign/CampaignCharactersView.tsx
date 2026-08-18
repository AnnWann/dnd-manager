import { Download, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getCampaignSessionCharacters,
  type CampaignSessionCharacters,
} from "../../api/campaign-session"
import { Button } from "../../components/ui/Button"
import { useCharacterContext } from "../../contexts/characterContext"
import { useMagicContext } from "../../contexts/magicContext"
import { CharacterSelectorList } from "../../features/characters/selector/CharacterSelectorList"
import { toSessionCharacterSelectorItem } from "../../features/characters/selector/sessionCharacterSelectorAdapter"
import { sessionCharacterPath } from "../../lib/campaignRoutes"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../models/characters/CharacterTemplate"
import type { Spell } from "../../models/magic/spells/Spell"

type CharacterExportBundle = {
  format: "dnd-manager-character"
  version: 3
  character: Record<string, unknown>
  homebrewSpells: Spell[]
}

export function CampaignCharactersView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    visibleCharacters,
    activeCharacter,
    setSelectedCharacterId,
    updateCharacter,
  } = useCharacterContext()
  const { savedSpells, spellByIndex, saveSpell } = useMagicContext()
  const [data, setData] = useState<CampaignSessionCharacters | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    async function loadCharacters() {
      setLoading(true)
      setErrorMessage("")

      try {
        const nextData = await getCampaignSessionCharacters(campaignId!)
        if (!cancelled) setData(nextData)
      } catch {
        if (!cancelled) {
          setData(null)
          setErrorMessage("Não foi possível carregar os personagens da sessão.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCharacters()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const sessionCharacters = useMemo(() => {
    if (!data) return []

    const linkedSourceIds = new Set(
      data.characters.map((character) => character.id),
    )

    return visibleCharacters.filter((character) =>
      linkedSourceIds.has(character.get("id")),
    )
  }, [data, visibleCharacters])

  const selectorCharacters = useMemo(
    () => sessionCharacters.map(toSessionCharacterSelectorItem),
    [sessionCharacters],
  )

  const selectedCharacter = useMemo(() => {
    const activeId = activeCharacter?.get("id")
    if (!activeId) return undefined
    return sessionCharacters.find((character) => character.get("id") === activeId)
  }, [activeCharacter, sessionCharacters])

  function exportSelectedCharacter() {
    if (!selectedCharacter || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      const character = selectedCharacter.toJSON()
      const indexes = collectReferencedSpellIndexes(character)
      const homebrewSpells = savedSpells.filter(
        (spell) => spell.homebrew && indexes.has(spell.index),
      )
      const bundle: CharacterExportBundle = {
        format: "dnd-manager-character",
        version: 3,
        character: character as unknown as Record<string, unknown>,
        homebrewSpells,
      }

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const safeName =
        selectedCharacter
          .get("name")
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
      setErrorMessage("Não foi possível exportar o personagem da sessão.")
    } finally {
      setWorking(false)
    }
  }

  async function importIntoSelectedCharacter(file?: File) {
    if (!file || !selectedCharacter || working) return

    setWorking(true)
    setErrorMessage("")

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const bundle = parseCharacterExport(parsed)

      for (const spell of bundle.homebrewSpells) {
        if (!spellByIndex.has(spell.index)) saveSpell(spell)
      }

      const imported = CharacterTemplate.fromJSON({
        ...(bundle.character as Partial<CharacterTemplateProps>),
        id: selectedCharacter.get("id"),
        owner: selectedCharacter.get("owner"),
        visibility: selectedCharacter.get("visibility"),
      })

      updateCharacter(
        selectedCharacter.get("id"),
        () => imported,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o personagem para a sessão.",
      )
    } finally {
      setWorking(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (!campaignId) return <Navigate to="/not-found" replace />

  return (
    <>
      <CharacterSelectorList
        title="Personagens"
        description="Clique uma vez para selecionar e novamente para abrir a ficha."
        characters={selectorCharacters}
        selectedCharacterId={activeCharacter?.get("id") ?? ""}
        loading={loading}
        errorMessage={errorMessage}
        emptyMessage="Nenhum personagem disponível."
        onSelectCharacter={setSelectedCharacterId}
        onOpenCharacter={(characterId) =>
          navigate(sessionCharacterPath(campaignId, characterId, "sheet"))
        }
        headerActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedCharacter || working}
              onClick={exportSelectedCharacter}
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedCharacter || working}
              title="Substitui apenas a cópia selecionada desta sessão."
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
          void importIntoSelectedCharacter(event.target.files?.[0])
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
