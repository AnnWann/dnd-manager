import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getCarriedWeightKg } from "../../../models/characters/characterEncumbrance"
import { getUsedArmsIncludingShield } from "../../../models/characters/characterEquipmentInteractions"

type Props = {
  character: CharacterTemplate
}

export function EquipmentSummary({ character }: Props) {
  const equipment = character.get("equipment")
  const sheet = character.get("sheet")

  const usedArms = getUsedArmsIncludingShield(character)
  const totalArms = sheet.arms

  const usedFingers = equipment.rings.length
  const totalFingers = totalArms * 4

  const usedPockets = equipment.pockets.length
  const totalPockets = 8

  const totalWeight = getCarriedWeightKg(character)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-md border border-border bg-bg px-3 py-2">
        <div className="text-xs text-text">Braços usados</div>
        <div className="mt-1 text-sm font-semibold text-textH">
          {usedArms}/{totalArms}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg px-3 py-2">
        <div className="text-xs text-text">Anéis</div>
        <div className="mt-1 text-sm font-semibold text-textH">
          {usedFingers}/{totalFingers}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg px-3 py-2">
        <div className="text-xs text-text">Bolsos</div>
        <div className="mt-1 text-sm font-semibold text-textH">
          {usedPockets}/{totalPockets}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg px-3 py-2">
        <div className="text-xs text-text">Peso total</div>
        <div className="mt-1 text-sm font-semibold text-textH">
          {formatKg(totalWeight)}
        </div>
      </div>
    </div>
  )
}

function formatKg(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`
}
