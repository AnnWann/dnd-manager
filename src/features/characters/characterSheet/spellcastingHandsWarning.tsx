import { AlertTriangle } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getSpellcastingHandState } from "../../../models/characters/characterHands"

export function SpellcastingHandsWarning({
  character,
}: {
  character: CharacterTemplate
}) {
  const state = getSpellcastingHandState(character)

  if (state.canCast) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/35 bg-dangerBg/45 px-2.5 py-2 text-[11px] leading-4 text-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
      <p>
        <span className="font-semibold text-danger">Conjuração bloqueada:</span>{" "}
        com todas as mãos ocupadas, o personagem não pode conjurar magias com
        componentes somáticos ou materiais. Libere uma mão pelo card do item ou use
        a proficiência “Conjuração com mãos ocupadas”.
      </p>
    </div>
  )
}
