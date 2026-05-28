import { badge } from "../../components/addedSpells/badge"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { totalLevel } from "../../lib/rules"
import type { Character } from "../../types"


type Props = {
  characters: Character[]
  activeCharacter: Character
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
                {characters.map((c) => (
                  <button
                    key={c.id}
                    className={
                      c.id === activeCharacter.id
                        ? 'flex w-full items-center justify-between rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-left'
                        : 'flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-left hover:bg-[color:var(--social-bg)]'
                    }
                    onClick={() => setActiveCharacterId(c.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-textH">{c.name}</div>
                      <div className="text-xs text-text">
                        {c.spells.length} magias • {totalLevel(c.classes.map((x) => x.level)) || 0} nv
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {showOwnerBadge
                        ? badge(c.visibilityRole === 'master' ? 'Master' : `Player: ${c.ownerKey?.trim() || 'sem nome'}`)
                        : null}
                      {c.id === activeCharacter.id ? badge('Ativo') : null}
                    </div>
                  </button>
                ))}
              </div>
    
              <div className="mt-3">
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={deleteActiveCharacter}
                  disabled={disableDelete}
                  title={disableDelete ? 'Mantenha pelo menos 1 personagem' : 'Excluir personagem'}
                >
                  Excluir personagem ativo
                </Button>
              </div>
            </CardContent>
          </Card>
  )
}
