import { Archive, Download, RotateCcw, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import { Button } from "../../components/ui/Button"
import {
  Card,
  CardContent,
  CardHeader,
} from "../../components/ui/Card"
import { useCharacterContext } from "../../contexts/characterContext"
import { useMagicContext } from "../../contexts/magicContext"
import { CharacterSelectorList } from "../../features/characters/selector/CharacterSelectorList"
import { toSessionCharacterSelectorItem } from "../../features/characters/selector/sessionCharacterSelectorAdapter"
import { useOptionalSessionRuntime } from "../../features/session-runtime/useSessionRuntime"
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
  const runtime = useOptionalSessionRuntime()
  const {
    visibleCharacters,
    activeCharacter,
    setSelectedCharacterId,
    updateCharacter,
  } = useCharacterContext()
  const { savedSpells, spellByIndex, saveSpell } = useMagicContext()
  const [working, setWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedSessionCharacterId, setSelectedSessionCharacterId] = useState(
    activeCharacter?.get("id") ?? "",
  )
  const [selectedInactiveCharacterId, setSelectedInactiveCharacterId] = useState("")

  const projectedById = useMemo(
    () => new Map(visibleCharacters.map((character) => [character.get("id"), character])),
    [visibleCharacters],
  )

  const socketCharacters = useMemo(() => {
    if (!runtime) return []

    return Object.values(runtime.abilitiesByCharacterId)
      .filter((state) => state.initialized)
      .filter(
        (state) => runtime.sessionCharactersById[state.characterId]?.active !== false,
      )
      .map((state) => {
        const projected = projectedById.get(state.characterId)
        if (projected) return projected
        return CharacterTemplate.fromJSON(
          state.character as Partial<CharacterTemplateProps>,
        )
      })
  }, [
    projectedById,
    runtime?.abilitiesByCharacterId,
    runtime?.sessionCharactersById,
  ])

  const inactiveCharacters = useMemo(() => {
    if (!runtime) return []

    return Object.values(runtime.sessionCharactersById)
      .filter((state) => state.active === false)
      .flatMap((state) => {
        const projected = projectedById.get(state.characterId)
        if (projected) return [projected]

        try {
          return [CharacterTemplate.fromJSON({
            ...(state.character as Partial<CharacterTemplateProps>),
            id: state.characterId,
          })]
        } catch {
          return []
        }
      })
  }, [projectedById, runtime?.sessionCharactersById])

  // HTTP/relational data is only the seed used before the Durable Object is
  // initialized. Once the socket has its Creation config, character membership
  // and payloads come from the authoritative session snapshots.
  const socketIsAuthoritative = Boolean(
    runtime?.status === "connected" && runtime.runtimeConfigSnapshot,
  )
  const sessionCharacters = socketIsAuthoritative
    ? socketCharacters
    : visibleCharacters

  const selectorCharacters = useMemo(
    () => sessionCharacters.map((character) => {
      const item = toSessionCharacterSelectorItem(character)
      if (!socketIsAuthoritative || projectedById.has(item.id)) return item
      return { ...item, secondaryBadge: "Somente na sessão" }
    }),
    [projectedById, sessionCharacters, socketIsAuthoritative],
  )
  const inactiveSelectorCharacters = useMemo(
    () => inactiveCharacters.map(toSessionCharacterSelectorItem),
    [inactiveCharacters],
  )

  useEffect(() => {
    if (!sessionCharacters.length) {
      if (selectedSessionCharacterId) setSelectedSessionCharacterId("")
      return
    }

    if (sessionCharacters.some(
      (character) => character.get("id") === selectedSessionCharacterId,
    )) return

    const activeId = activeCharacter?.get("id")
    const preferredId = activeId && sessionCharacters.some(
      (character) => character.get("id") === activeId,
    )
      ? activeId
      : sessionCharacters[0].get("id")
    setSelectedSessionCharacterId(preferredId)
  }, [activeCharacter, selectedSessionCharacterId, sessionCharacters])

  useEffect(() => {
    if (!inactiveCharacters.length) {
      if (selectedInactiveCharacterId) setSelectedInactiveCharacterId("")
      return
    }

    if (!inactiveCharacters.some(
      (character) => character.get("id") === selectedInactiveCharacterId,
    )) {
      setSelectedInactiveCharacterId(inactiveCharacters[0].get("id"))
    }
  }, [inactiveCharacters, selectedInactiveCharacterId])

  const selectedCharacter = useMemo(
    () => sessionCharacters.find(
      (character) => character.get("id") === selectedSessionCharacterId,
    ),
    [selectedSessionCharacterId, sessionCharacters],
  )
  const selectedInactiveCharacter = useMemo(
    () => inactiveCharacters.find(
      (character) => character.get("id") === selectedInactiveCharacterId,
    ),
    [inactiveCharacters, selectedInactiveCharacterId],
  )

  const loading = Boolean(
    runtime &&
      (runtime.status === "connecting" ||
        runtime.status === "reconnecting" ||
        runtime.status === "disconnected" ||
        (runtime.status === "connected" && runtime.runtimeConfigSnapshot === null)),
  )
  const runtimeError = runtime?.status === "error"
    ? "Não foi possível conectar ao estado autoritativo da sessão."
    : ""
  const canManageLifecycle = Boolean(
    runtime?.status === "connected" && runtime.role === "MASTER",
  )

  function selectSessionCharacter(characterId: string) {
    setSelectedSessionCharacterId(characterId)
    setSelectedCharacterId(characterId)
  }

  function inactivateSelectedCharacter() {
    if (!runtime || !canManageLifecycle || !selectedCharacter || working) return

    const characterName = selectedCharacter.get("name") || "este personagem"
    if (!window.confirm(
      `Inativar ${characterName}? Ele sairá da lista principal da sessão, mas continuará disponível em Personagens inativos.`,
    )) return

    setErrorMessage("")
    const sent = runtime.dispatchCharacterLifecycleOperation({
      type: "character.session.remove",
      characterId: selectedCharacter.get("id"),
    })
    if (!sent) {
      setErrorMessage("Não foi possível inativar o personagem no estado da sessão.")
    }
  }

  function reactivateSelectedCharacter() {
    if (!runtime || !canManageLifecycle || !selectedInactiveCharacter || working) return

    setErrorMessage("")
    const sent = runtime.dispatchCharacterLifecycleOperation({
      type: "character.session.add",
      characterId: selectedInactiveCharacter.get("id"),
      character: selectedInactiveCharacter.toJSON() as unknown as Record<string, unknown>,
    })
    if (!sent) {
      setErrorMessage("Não foi possível reativar o personagem no estado da sessão.")
    }
  }

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
    <div className="grid gap-5">
      <CharacterSelectorList
        title="Personagens"
        description="Clique uma vez para selecionar e novamente para abrir a ficha."
        characters={selectorCharacters}
        selectedCharacterId={selectedSessionCharacterId}
        loading={loading}
        errorMessage={errorMessage || runtimeError}
        emptyMessage="Nenhum personagem disponível no estado da sessão."
        onSelectCharacter={selectSessionCharacter}
        onOpenCharacter={(characterId) =>
          navigate(sessionCharacterPath(campaignId, characterId, "sheet"))
        }
        headerActions={
          <>
            {canManageLifecycle ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedCharacter || working}
                title="Move o personagem para a área de inativos sem apagar sua ficha."
                onClick={inactivateSelectedCharacter}
              >
                <Archive className="h-4 w-4" />
                Inativar
              </Button>
            ) : null}
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

      {runtime?.role === "MASTER" ? (
        <InactiveCharactersPanel
          characters={inactiveSelectorCharacters}
          selectedCharacterId={selectedInactiveCharacterId}
          onSelectCharacter={setSelectedInactiveCharacterId}
          onReactivate={reactivateSelectedCharacter}
          disabled={!canManageLifecycle || !selectedInactiveCharacter || working}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) =>
          void importIntoSelectedCharacter(event.target.files?.[0])
        }
      />
    </div>
  )
}

function InactiveCharactersPanel({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onReactivate,
  disabled,
}: {
  characters: ReturnType<typeof toSessionCharacterSelectorItem>[]
  selectedCharacterId: string
  onSelectCharacter: (characterId: string) => void
  onReactivate: () => void
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">Personagens inativos</div>
            <p className="mt-1 text-xs text-text">
              Personagens mortos, aposentados ou removidos da sessão ficam preservados aqui.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={onReactivate}
          >
            <RotateCcw className="h-4 w-4" />
            Reativar selecionado
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {characters.length ? (
          <div className="flex flex-col gap-2">
            {characters.map((character) => {
              const selected = character.id === selectedCharacterId
              return (
                <button
                  key={character.id}
                  type="button"
                  className={
                    selected
                      ? "flex w-full items-center justify-between gap-3 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left"
                      : "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-left hover:bg-[color:var(--social-bg)]"
                  }
                  onClick={() => onSelectCharacter(character.id)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-textH">{character.name}</div>
                    <div className="text-xs text-text">
                      {character.spellCount ? `${character.spellCount} magias • ` : ""}
                      {character.classLabel ? `${character.classLabel} • ` : ""}
                      {character.level} nv
                    </div>
                  </div>
                  {selected ? (
                    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-1 text-[10px] text-textH">
                      Selecionado
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-8 text-center text-sm text-textMuted">
            Nenhum personagem inativo nesta sessão.
          </div>
        )}
      </CardContent>
    </Card>
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
