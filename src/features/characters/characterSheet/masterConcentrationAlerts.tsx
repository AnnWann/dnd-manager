import { useEffect, useRef, useState } from "react"
import { AlertTriangle, X } from "lucide-react"

import { useCharacterContext } from "../../../contexts/characterContext"

type ConcentrationAlert = {
  id: string
  characterName: string
  damage: number
  dc: number
  source?: string
}

export function MasterConcentrationAlerts() {
  const {
    canAssignOwners,
    operationLog,
    visibleCharacters,
  } = useCharacterContext()
  const seenOperationIds = useRef(
    new Set(operationLog.map((record) => record.id)),
  )
  const [alerts, setAlerts] = useState<ConcentrationAlert[]>([])

  useEffect(() => {
    const incoming: ConcentrationAlert[] = []

    for (const record of operationLog) {
      if (seenOperationIds.current.has(record.id)) continue
      seenOperationIds.current.add(record.id)

      if (!canAssignOwners) continue
      const operation = record.operation
      if (
        operation.type !== "character.hp.damage" ||
        operation.requiresConcentrationCheck !== true
      ) {
        continue
      }

      const character = visibleCharacters.find(
        (entry) => entry.get("id") === operation.characterId,
      )
      incoming.push({
        id: record.id,
        characterName: character?.get("name") || "Personagem",
        damage: Math.max(0, Math.trunc(operation.amount || 0)),
        dc: Math.max(
          10,
          Math.trunc(
            operation.concentrationDc ??
              Math.max(10, Math.floor((operation.amount || 0) / 2)),
          ),
        ),
        source: operation.concentrationSource || undefined,
      })
    }

    if (incoming.length) {
      setAlerts((current) => [...current, ...incoming].slice(-5))
    }
  }, [canAssignOwners, operationLog, visibleCharacters])

  if (!canAssignOwners || alerts.length === 0) return null

  return (
    <div
      className="fixed right-3 top-3 z-[13000] grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 sm:right-4 sm:top-4"
      aria-live="assertive"
      aria-label="Avisos de concentração"
    >
      {alerts.map((alert) => (
        <article
          key={alert.id}
          className="rounded-xl border border-accentBorder bg-bg-elevated p-3 shadow-theme-lg"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accentBorder bg-accentBg text-textH">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-textH">
                Teste de concentração
              </div>
              <p className="mt-1 text-xs leading-5 text-text">
                <strong>{alert.characterName}</strong> precisa realizar um teste de resistência de Constituição com <strong>CD {alert.dc}</strong> após sofrer {alert.damage} de dano.
              </p>
              {alert.source ? (
                <p className="mt-1 text-[11px] leading-4 text-textMuted">
                  Concentrando em {alert.source}.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Dispensar aviso"
              title="Dispensar aviso"
              onClick={() =>
                setAlerts((current) =>
                  current.filter((entry) => entry.id !== alert.id),
                )
              }
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-textMuted transition-colors hover:bg-accentBg hover:text-textH"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
