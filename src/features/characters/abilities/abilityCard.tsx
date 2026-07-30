import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import type { Ability } from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"
import { flattenBonuses } from "../inventory/equipmentBonusFields"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  ability: Ability
  sourceLabel?: string
  usageMax?: number
  onEdit?: () => void
  onRemove?: () => void
  onUse?: () => void
  onDeactivate?: () => void
  onRestore?: () => void
}

function summaryLabel(ability: Ability) {
  const usage = ability.usage
  const kindLabel = ability.kind === "passive"
    ? "Passiva"
    : ability.kind === "feature"
      ? "Característica"
      : "Ativa"

  if (!usage) {
    return (ability.kind ?? "active") !== "active"
      ? `${kindLabel} • ${ABILITY_TRIGGER_OPTIONS.find((option) => option.value === (ability.trigger ?? "always"))?.label ?? ability.trigger ?? "Sempre"}`
      : `${kindLabel} • ${ABILITY_ACTION_OPTIONS.find((option) => option.value === (ability.actionKind ?? "action"))?.label ?? "Ação"}`
  }

  if (usage.reset === "cooldown") {
    const amount = Math.max(1, Math.trunc(usage.cooldownAmount ?? 1) || 1)
    const unit =
      COOLDOWN_UNIT_OPTIONS.find(
        (option) => option.value === (usage.cooldownUnit ?? "turns"),
      )?.label ?? "Turnos"

    return `${kindLabel} • Cooldown • ${amount} ${unit.toLowerCase()}`
  }

  return `${kindLabel} • ${USAGE_OPTIONS.find((option) => option.value === usage.reset)?.label ?? "Sem uso"}`
}

export function AbilityCard({
  ability,
  sourceLabel,
  usageMax,
  onEdit,
  onRemove,
  onUse,
  onDeactivate,
  onRestore,
}: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [expanded, setExpanded] = useState(false)
  const usage = ability.usage
  const resolvedMax = usage ? Math.max(0, usageMax ?? usage.max) : null
  const remaining = usage && resolvedMax !== null
    ? Math.max(0, resolvedMax - usage.used)
    : null
  const description = ability.description?.trim() ?? ""
  const grantedSpells = (ability.grantedSpells ?? []).map((grant) => ({
    grant,
    spell: getSpellByIndex(grant.index),
  }))
  const bonusEntries = flattenBonuses(ability.bonuses ?? {})
  const requiresActivation = abilityRequiresActivation(ability)
  const benefitsActive = isAbilityBenefitsActive(ability)
  const canTrigger =
    requiresActivation &&
    Boolean(onUse) &&
    ((ability.kind ?? "active") === "active" || !benefitsActive)

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
            {summaryLabel(ability)}
          </span>

          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              benefitsActive
                ? "border-accentBorder bg-accentBg text-accent"
                : "border-border bg-bg-subtle text-textMuted",
            )}
          >
            {benefitsActive
              ? requiresActivation
                ? "Benefícios ativos"
                : "Sempre ativa"
              : "Aguardando acionamento"}
          </span>

          {sourceLabel ? (
            <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[11px] font-medium text-textH">
              {sourceLabel}
            </span>
          ) : null}
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
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            ) : null}
          </div>
        ) : null}

        {bonusEntries.length > 0 ? (
          <div className={cn("mt-3", !benefitsActive && "opacity-60")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Bônus concedidos
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {bonusEntries.map((entry) => (
                <span
                  key={entry.id}
                  className="rounded-full bg-accentBg px-2.5 py-1 text-[11px] font-medium text-textH"
                >
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {grantedSpells.length > 0 ? (
          <div className={cn("mt-3", !benefitsActive && "opacity-60")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Magias concedidas
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {grantedSpells.map(({ grant, spell }) => (
                <span
                  key={grant.index}
                  className="rounded-full bg-accentBg px-2.5 py-1 text-[11px] font-medium text-textH"
                >
                  {spell?.displayName || spell?.name || grant.index}
                  {grant.castingMode === "known"
                    ? " • espaços normais"
                    : " • pela habilidade"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-2 text-xs text-text">
          {usage && resolvedMax !== null ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{remaining}/{resolvedMax} usos restantes</span>
              <span>Gastos {usage.used}</span>
              {usage.maxFormula ? <span>Máximo por fórmula</span> : null}
            </div>
          ) : (
            <span>Sem limite de usos.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {onEdit ? (
          <Button size="sm" variant="secondary" onClick={onEdit}>Editar</Button>
        ) : null}

        {canTrigger ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={remaining !== null && remaining <= 0}
            onClick={onUse}
          >
            {(ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}
          </Button>
        ) : null}

        {requiresActivation && benefitsActive && onDeactivate ? (
          <Button size="sm" variant="ghost" onClick={onDeactivate}>
            Encerrar efeito
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
          <Button size="sm" variant="ghost" onClick={onRemove}>Remover</Button>
        ) : null}
      </div>
    </div>
  )
}
