import { Button } from "../../../components/ui/Button"
import type { Spell } from "../../../models/magic/spells/Spell"

type Props = {
  spell: Spell
  onEdit?: () => void
  onRemove?: () => void
  onTogglePrepared?: () => void
}

export function SpellCard({
  spell,
  onEdit,
  onRemove,
  onTogglePrepared,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-textH">
            {spell.displayName || spell.name}
          </div>

          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text">
            <span>Nível {spell.slotLevel}</span>
            <span>{spell.school}</span>
            <span>{spell.actionType}</span>
            <span>{spell.range}</span>
            {spell.concentration ? <span>Concentração</span> : null}
            {spell.prepared ? <span>Preparada</span> : <span>Não preparada</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {onTogglePrepared ? (
            <Button size="sm" variant="secondary" onClick={onTogglePrepared}>
              {spell.prepared ? "Despreparar" : "Preparar"}
            </Button>
          ) : null}

          {onEdit ? (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
          ) : null}

          {onRemove ? (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>

      {spell.description?.trim() ? (
        <div className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-text">
          {spell.description}
        </div>
      ) : null}
    </div>
  )
}