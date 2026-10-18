import { AlertTriangle, Gauge, Scale } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getEncumbranceInfo,
  type EncumbranceState,
} from "../../../models/characters/characterEncumbrance"

const STATE_PRESENTATION: Record<
  EncumbranceState,
  {
    label: string
    detail: string
    panelClass: string
    fillClass: string
    textClass: string
  }
> = {
  normal: {
    label: "Carga normal",
    detail: "Sem penalidade de deslocamento.",
    panelClass: "border-border bg-bg",
    fillClass: "bg-accent",
    textClass: "text-textH",
  },
  encumbered: {
    label: "Sobrecarregado",
    detail: "Deslocamento reduzido em 3 m.",
    panelClass: "border-warning bg-warningBg",
    fillClass: "bg-warning",
    textClass: "text-warning",
  },
  "heavily-encumbered": {
    label: "Sobrecarga pesada",
    detail: "Deslocamento reduzido em 6 m.",
    panelClass: "border-danger bg-dangerBg",
    fillClass: "bg-danger",
    textClass: "text-danger",
  },
  "over-capacity": {
    label: "Acima da capacidade",
    detail: "Deslocamento reduzido em 6 m.",
    panelClass: "border-danger bg-dangerBg",
    fillClass: "bg-danger",
    textClass: "text-danger",
  },
}

type Props = {
  character: CharacterTemplate
}

export function CharacterEncumbrancePanel({ character }: Props) {
  const info = getEncumbranceInfo(character)
  const presentation = STATE_PRESENTATION[info.state]
  const capacity = Math.max(0.000001, info.carryingCapacity)
  const fillPercentage = Math.min(100, (info.weight / capacity) * 100)
  const overCapacity = Math.max(0, info.weight - info.carryingCapacity)

  return (
    <section
      className={`min-w-0 rounded-xl border p-4 shadow-theme-sm ${presentation.panelClass}`}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {info.state === "normal" ? (
              <Scale className="h-4 w-4 shrink-0 text-accent" />
            ) : (
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${presentation.textClass}`}
              />
            )}
            <h2 className={`text-sm font-semibold ${presentation.textClass}`}>
              {presentation.label}
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            {presentation.detail}
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <div className="text-lg font-bold text-textH">
            {formatKg(info.weight)} / {formatKg(info.carryingCapacity)}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-textMuted">
            peso carregado / capacidade
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-3 overflow-hidden rounded-full bg-bg-subtle">
          <div
            className={`h-full rounded-full transition-[width] ${presentation.fillClass}`}
            style={{ width: `${fillPercentage}%` }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-textMuted/70"
            style={{ left: "33.333%" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-textMuted/70"
            style={{ left: "66.667%" }}
          />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-textMuted">
          <div>
            <div className="font-semibold text-text">Sobrecarga</div>
            <div>{formatKg(info.encumbranceLimit)}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-text">Pesada</div>
            <div>{formatKg(info.heavyEncumbranceLimit)}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-text">Máximo</div>
            <div>{formatKg(info.carryingCapacity)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
        <Metric
          label="Força efetiva"
          value={String(character.getEffectiveAttribute("str"))}
        />
        <Metric
          label="Penalidade"
          value={info.speedPenalty > 0 ? `−${info.speedPenalty} m` : "Nenhuma"}
        />
        <Metric
          label="Deslocamento atual"
          value={`${formatNumber(character.getEffectiveMobility())} m`}
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
      </div>

      {overCapacity > 0 ? (
        <p className="mt-3 text-xs font-medium text-danger">
          Excesso de {formatKg(overCapacity)} acima da capacidade máxima.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-4 text-textMuted">
        Os limites usam 5, 10 e 15 libras por ponto de Força, convertidas para
        quilogramas e ajustadas pelo tamanho: Minúsculo ×0,5; Pequeno e Médio ×1;
        Grande ×2; Enorme ×4; Colossal ×8. Itens dentro da Bolsa de Carga não
        entram no peso carregado.
      </p>
    </section>
  )
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg-subtle p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-textMuted">
        {icon}
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-textH">
        {value}
      </div>
    </div>
  )
}

function formatKg(value: number): string {
  return `${formatNumber(value)} kg`
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
