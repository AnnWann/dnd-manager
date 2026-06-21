import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"

type Props = {
  characters: CharacterTemplate[]
  activeCharacter: CharacterTemplate
  addCharacter: () => void
  importCharacter: (rawCharacter: unknown) => CharacterTemplate
  setActiveCharacterId: (id: string) => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
}

export function CharacterSelector({
  characters,
  activeCharacter,
  addCharacter,
  importCharacter,
  setActiveCharacterId,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState("")

  function exportActiveCharacter() {
    const json = JSON.stringify(activeCharacter.toJSON(), null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const safeName = activeCharacter
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
  }

  async function importFromFile(file?: File) {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      importCharacter(parsed)
      setImportError("")
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o personagem.",
      )
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-textH">
            Personagens
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={exportActiveCharacter}
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Importar JSON
            </Button>

            <Button size="sm" variant="primary" onClick={addCharacter}>
              + Adicionar
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) =>
            void importFromFile(event.target.files?.[0])
          }
        />

        {importError ? (
          <div className="mt-3 rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {importError}
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {characters.map((character) => {
            const id = character.get("id")
            const name = character.get("name")
            const sheet = character.get("sheet")
            const magic = character.get("magic")
            const visibility = character.get("visibility")
            const owner = character.get("owner")
            const isActive = id === activeCharacter.get("id")
            const classes = sheet.classes ?? []
            const level = classes.reduce(
              (total, entry) => total + (entry.level ?? 0),
              0,
            )
            const spellCount = magic?.spells.knownSpells.length ?? 0

            return (
              <button
                key={id}
                className={
                  isActive
                    ? "flex w-full items-center justify-between rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left"
                    : "flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-left hover:bg-[color:var(--social-bg)]"
                }
                onClick={() => setActiveCharacterId(id)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-textH">
                    {name}
                  </div>
                  <div className="text-xs text-text">
                    {spellCount > 0 ? `${spellCount} magias • ` : ""}
                    {level} nv
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {showOwnerBadge
                    ? badge(
                        visibility === "master"
                          ? "Master"
                          : `Player: ${owner?.name?.trim() || "sem nome"}`,
                      )
                    : null}
                  {isActive ? badge("Ativo") : null}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3">
          <Button
            className="w-full"
            variant="secondary"
            onClick={deleteActiveCharacter}
            disabled={disableDelete}
            title={
              disableDelete
                ? "Mantenha pelo menos 1 personagem"
                : "Excluir personagem"
            }
          >
            Excluir personagem ativo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function badge(label: string) {
  return (
    <span className="rounded-md border border-border px-2 py-1 text-xs text-text">
      {label}
    </span>
  )
}
