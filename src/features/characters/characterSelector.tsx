import { Spline } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"

type Props = {
  characters: CharacterTemplate[]
  activeCharacter: CharacterTemplate
  addCharacter: () => void
  setActiveCharacterId: (id: string) => void
  deleteActiveCharacter: () => void
  disableDelete: boolean
  showOwnerBadge: boolean
}

export function CharacterSelector({
  characters,
  activeCharacter,
  addCharacter,
  setActiveCharacterId,
  deleteActiveCharacter,
  disableDelete,
  showOwnerBadge,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-textH">Personagens</div>
          <Button size="sm" variant="primary" onClick={addCharacter}>
            + Adicionar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          {characters.map((c) => {
            const id = c.get("id")
            const name = c.get("name")
            const sheet = c.get("sheet")
            const magic = c.get("magic")
            const visibility = c.get("visibility")
            const owner = c.get("owner")
            const isActive = id === activeCharacter.get('id')
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
                    {spellCount > 0 ? `${spellCount} magias •` : ''} {level} nv
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