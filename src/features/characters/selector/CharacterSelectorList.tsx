import { useEffect, useState, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import {
  Card,
  CardContent,
  CardHeader,
} from "../../../components/ui/Card"

import type { CharacterSelectorItem } from "./CharacterSelectorItem"

type Props = {
  title?: string
  description?: string
  characters: CharacterSelectorItem[]

  selectedCharacterId?: string

  loading?: boolean
  errorMessage?: string
  emptyMessage?: string

  onSelectCharacter?: (characterId: string) => void
  onOpenCharacter: (characterId: string) => void

  onAddCharacter?: () => void
  onDeleteCharacter?: (characterId: string) => void

  deleteDisabled?: boolean
  deleteDisabledReason?: string

  headerActions?: ReactNode
}

export function CharacterSelectorList({
  title = "Personagens",
  description = "Clique uma vez para selecionar e novamente para abrir a ficha.",
  characters,
  selectedCharacterId,
  loading = false,
  errorMessage = "",
  emptyMessage = "Nenhum personagem encontrado.",
  onSelectCharacter,
  onOpenCharacter,
  onAddCharacter,
  onDeleteCharacter,
  deleteDisabled = false,
  deleteDisabledReason,
  headerActions,
}: Props) {
  const [localSelectedId, setLocalSelectedId] = useState(
    selectedCharacterId ?? "",
  )

  const [openCandidateId, setOpenCandidateId] = useState("")

  useEffect(() => {
    if (selectedCharacterId !== undefined) {
      setLocalSelectedId(selectedCharacterId)
    }
  }, [selectedCharacterId])

  useEffect(() => {
    if (characters.length === 0) {
      setLocalSelectedId("")
      setOpenCandidateId("")
      return
    }

    const selectedStillExists = characters.some(
      (character) => character.id === localSelectedId,
    )

    if (!selectedStillExists) {
      setLocalSelectedId(characters[0].id)
    }
  }, [characters, localSelectedId])

  function selectOrOpen(characterId: string) {
    if (openCandidateId === characterId) {
      onOpenCharacter(characterId)
      return
    }

    setLocalSelectedId(characterId)
    setOpenCandidateId(characterId)
    onSelectCharacter?.(characterId)
  }

  function deleteSelected() {
    if (!localSelectedId || !onDeleteCharacter) return

    onDeleteCharacter(localSelectedId)
    setOpenCandidateId("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">
              {title}
            </div>

            <p className="mt-1 text-xs text-text">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {headerActions}

            {onAddCharacter ? (
              <Button
                size="sm"
                variant="primary"
                onClick={onAddCharacter}
              >
                + Adicionar
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-8 text-center text-sm text-textMuted">
            Carregando personagens...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : characters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-8 text-center text-sm text-textMuted">
            {emptyMessage}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {characters.map((character) => {
              const isSelected =
                character.id === localSelectedId

              const isReadyToOpen =
                character.id === openCandidateId

              return (
                <button
                  key={character.id}
                  type="button"
                  className={
                    isSelected
                      ? "flex w-full items-center justify-between gap-4 rounded-lg border border-accentBorder bg-accentBg px-4 py-3 text-left"
                      : "flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-bg px-4 py-3 text-left hover:bg-[color:var(--social-bg)]"
                  }
                  onClick={() => selectOrOpen(character.id)}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-textH">
                        {character.name}
                      </div>

                      <div className="text-xs text-text">
                        {character.spellCount
                          ? `${character.spellCount} magias • `
                          : ""}

                        {character.classLabel
                          ? `${character.classLabel} • `
                          : ""}

                        {character.level} nv
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {character.badge ? (
                      <SelectorBadge label={character.badge} />
                    ) : null}

                    {character.secondaryBadge ? (
                      <SelectorBadge
                        label={character.secondaryBadge}
                      />
                    ) : null}

                    {isReadyToOpen ? (
                      <SelectorBadge label="Clique novamente para abrir" />
                    ) : isSelected ? (
                      <SelectorBadge label="Selecionado" />
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {onDeleteCharacter && characters.length > 0 ? (
          <div className="mt-3">
            <Button
              className="w-full"
              variant="secondary"
              disabled={deleteDisabled || !localSelectedId}
              title={
                deleteDisabled
                  ? deleteDisabledReason
                  : "Excluir personagem selecionado"
              }
              onClick={deleteSelected}
            >
              Excluir personagem selecionado
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SelectorBadge({
  label,
}: {
  label: string
}) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-1 text-[10px] text-textH">
      {label}
    </span>
  )
}