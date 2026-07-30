import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import {
  getChannelDivinityPool,
  restoreChannelDivinity,
  spendChannelDivinity,
} from "../../../models/characters/characterChannelDivinity"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function ChannelDivinityModule({
  character,
  updateCharacter,
}: Props) {
  const pool = getChannelDivinityPool(character)
  if (!pool) return null

  const clericLevel = character.getClassLevel("cleric")
  const paladinLevel = character.getClassLevel("paladin")
  const sources = [
    clericLevel >= 2 ? `Clérigo ${clericLevel}` : undefined,
    paladinLevel >= 3 ? `Paladino ${paladinLevel}` : undefined,
  ].filter((entry): entry is string => Boolean(entry))

  function spend() {
    updateCharacter(character.get("id"), (current) =>
      spendChannelDivinity(current),
    )
  }

  function restore() {
    updateCharacter(character.get("id"), (current) =>
      restoreChannelDivinity(current),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Canalizar Divindade
        </div>
        <div className="mt-1 text-xs text-text">
          Cargas calculadas automaticamente pelo nível de classe.
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-textH">
              {pool.current}/{pool.max} disponíveis
            </div>
            <div className="mt-1 text-[10px] text-textMuted">
              {sources.join(" • ")} • recupera em descanso curto ou longo
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pool.current <= 0}
              onClick={spend}
            >
              Gastar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pool.current >= pool.max}
              onClick={restore}
            >
              Restaurar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
