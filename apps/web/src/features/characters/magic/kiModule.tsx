import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { getKiPool, restoreKi, spendKi } from "../../../models/characters/characterKi"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
}

export function KiModule({ character, updateCharacter }: Props) {
  const runtime = useOptionalSessionRuntime()
  const pool = getKiPool(character)
  if (!pool) return null

  const characterId = character.get("id")
  const monkLevel = character.getClassLevel("monk")

  function spend() {
    if (runtime) { runtime.dispatchMagicOperation({ type: "character.ki.spend", characterId }); return }
    updateCharacter(characterId, spendKi)
  }
  function restore() {
    if (runtime) { runtime.dispatchMagicOperation({ type: "character.ki.restore", characterId }); return }
    updateCharacter(characterId, restoreKi)
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Ki</div>
        <div className="mt-1 text-xs text-text">Pontos calculados automaticamente pelo nível de Monge.</div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-textH">{pool.current}/{pool.max} disponíveis</div>
            <div className="mt-1 text-[10px] text-textMuted">Monge {monkLevel} • recupera em descanso curto ou longo</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pool.current <= 0} onClick={spend}>Gastar</Button>
            <Button size="sm" variant="secondary" disabled={pool.current >= pool.max} onClick={restore}>Restaurar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
