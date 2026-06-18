import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { cn } from "../../../lib/cn"
import type { Ability } from "../../../models/abilities/Ability"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  ability: Ability
  onEdit?: () => void
  onRemove?: () => void
  onUse?: () => void
  onRestore?: () => void
}

function summaryLabel(ability: Ability) {
  const usage = ability.usage
  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"

  if (!usage) {
    return ability.kind === "passive"
      ? `${kindLabel} • ${ABILITY_TRIGGER_OPTIONS.find((o) => o.value === (ability.trigger ?? "always"))?.label ?? "Sempre"}`
      : `${kindLabel} • ${ABILITY_ACTION_OPTIONS.find((o) => o.value === (ability.actionKind ?? "action"))?.label ?? "Ação"}`
  }

  if (usage.reset === "cooldown") {
    const amount = Math.max(1, Math.trunc(usage.cooldownAmount ?? 1) || 1)
    const unit =
      COOLDOWN_UNIT_OPTIONS.find((o) => o.value === (usage.cooldownUnit ?? "turns"))?.label ??
      "Turnos"

    return `${kindLabel} • Cooldown • ${amount} ${unit.toLowerCase()}`
  }

  return `${kindLabel} • ${USAGE_OPTIONS.find((o) => o.value === usage.reset)?.label ?? "Sem uso"}`
}

export function AbilityCard({
  ability,
  onEdit,
  onRemove,
  onUse,
  onRestore,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const usage = ability.usage
  const remaining = usage ? Math.max(0, usage.max - usage.used) : null
  const description = ability.description?.trim() ?? ""

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg p-4 transition-shadow hover:shadow-theme",
        ability.kind === "passive" ? "border-dashed" : "",
        usage
          ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
          : "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
      )}
    >
      <div className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="break-words text-sm font-semibold text-textH">
            {ability.name || "Habilidade sem nome"}
          </div>

          <span className="rounded-full border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] px-2 py-0.5 text-[11px] font-medium text-text">
            {usage ? summaryLabel(ability) : "Sem contador"}
          </span>
        </div>

        {description ? (
          <div className="mt-2 min-w-0">
            <p
              className={cn(
                "max-w-full whitespace-pre-wrap text-xs leading-5 text-text",
                "[overflow-wrap:anywhere] [word-break:break-word]",
                !expanded ? "line-clamp-3" : "",
              )}
            >
              {description}
            </p>

            {description.length > 120 ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-textH hover:opacity-80"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 text-xs text-text">
          {usage ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {remaining}/{usage.max} usos restantes
              </span>
              <span>Gastos {usage.used}</span>
            </div>
          ) : (
            <span>Habilidade livre, sem recursos associados.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {onEdit ? (
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Editar
          </Button>
        ) : null}

        {ability.kind === "active" && usage && onUse ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={remaining !== null && remaining <= 0}
            onClick={onUse}
          >
            Usar
          </Button>
        ) : null}

        {usage &&
        usage.reset !== "limited" &&
        usage.reset !== "spellSlot" &&
        onRestore ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={usage.used <= 0}
            onClick={onRestore}
          >
            Restaurar
          </Button>
        ) : null}

        {onRemove ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  )
}