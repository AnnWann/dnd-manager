import {
  ChevronDown,
  CirclePlus,
  Swords,
  X,
} from "lucide-react"

import { Button } from "../../components/ui/Button"
import type {
  InitiativeConditionDuration,
  InitiativeEntry,
  InitiativeSide,
} from "../../models/initiative/Initiative"

const compactInputClassName = [
  "h-8 rounded-md border border-border bg-bg px-2",
  "text-sm text-textH outline-none",
  "focus:border-accent focus:ring-2 focus:ring-accent/20",
].join(" ")

export function EntryIdentity({
  entry,
  onOpen,
}: {
  entry: InitiativeEntry
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-3 rounded-lg text-left outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      onClick={onOpen}
      title="Abrir ficha rápida"
    >
      {entry.imageUrl ? (
        <img
          src={entry.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-subtle">
          <Swords className="h-5 w-5 text-textMuted" />
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold text-textH hover:text-accent">
          {entry.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${sideClassName(entry.side)}`}
          >
            {sideLabel(entry.side)}
          </span>
          {entry.temporaryHp ? (
            <span className="text-xs text-accent">
              +{entry.temporaryHp} temp.
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function HitPointEditor({
  entry,
  patchEntry,
}: {
  entry: InitiativeEntry
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        className={`${compactInputClassName} w-16 text-center`}
        value={entry.currentHp ?? ""}
        onChange={(event) =>
          patchEntry(entry.id, {
            currentHp: optionalNumber(event.target.value),
          })
        }
        title="PV atuais"
      />
      <span className="text-textMuted">/</span>
      <input
        type="number"
        min={0}
        className={`${compactInputClassName} w-16 text-center`}
        value={entry.maxHp ?? ""}
        onChange={(event) =>
          patchEntry(entry.id, { maxHp: optionalNumber(event.target.value) })
        }
        title="PV máximos"
      />
    </div>
  )
}

export function ArmorClassEditor({
  entry,
  patchEntry,
}: {
  entry: InitiativeEntry
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
}) {
  return (
    <input
      type="number"
      className={`${compactInputClassName} w-16 text-center`}
      value={entry.armorClass ?? ""}
      onChange={(event) =>
        patchEntry(entry.id, {
          armorClass: optionalNumber(event.target.value),
        })
      }
    />
  )
}

export function InitiativeEditor({
  entry,
  started,
  patchEntry,
}: {
  entry: InitiativeEntry
  started: boolean
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
}) {
  return (
    <input
      type="number"
      className={`${compactInputClassName} w-20 text-center font-semibold`}
      value={entry.initiative}
      disabled={started}
      onChange={(event) =>
        patchEntry(entry.id, { initiative: Number(event.target.value) })
      }
    />
  )
}

export function ConditionChips({
  entry,
  onAdd,
  onRemove,
}: {
  entry: InitiativeEntry
  onAdd: () => void
  onRemove: (conditionId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.conditions.map((condition) => (
        <span
          key={condition.id}
          title={condition.description}
          className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-1 text-xs text-textH"
        >
          <span>{condition.name}</span>
          <span className="text-[10px] text-textMuted">
            {conditionDurationLabel(condition.duration)}
          </span>
          <button
            type="button"
            aria-label={`Remover ${condition.name}`}
            className="rounded-full p-0.5 hover:bg-bg-subtle"
            onClick={() => onRemove(condition.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-borderStrong px-2 py-1 text-xs text-text hover:border-accent hover:text-accent"
      >
        <CirclePlus className="h-3 w-3" /> Condição
      </button>
    </div>
  )
}

export function TradeControls({
  entry,
  onTrade,
  canTrade,
}: {
  entry: InitiativeEntry
  onTrade: (entryId: string, direction: -1 | 1) => void
  canTrade: (entryId: string, direction: -1 | 1) => boolean
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="icon"
        variant="ghost"
        title="Trocar com o próximo aliado"
        disabled={!canTrade(entry.id, 1)}
        onClick={() => onTrade(entry.id, 1)}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function formatHp(entry: InitiativeEntry): string {
  if (entry.currentHp === undefined && entry.maxHp === undefined) return "—"
  return `${entry.currentHp ?? "—"} / ${entry.maxHp ?? "—"}`
}

function conditionDurationLabel(
  duration: InitiativeConditionDuration,
): string {
  switch (duration.type) {
    case "turns":
      return `${duration.remaining}t`
    case "rounds":
      return `${duration.remaining}r`
    case "untilTurnStart":
      return "até início"
    case "untilTurnEnd":
      return "até fim"
    default:
      return "manual"
  }
}

function sideLabel(side: InitiativeSide): string {
  if (side === "ally") return "Aliado"
  if (side === "enemy") return "Inimigo"
  return "Neutro"
}

function sideClassName(side: InitiativeSide): string {
  if (side === "ally") {
    return "border-accentBorder bg-accentBg text-accent"
  }
  if (side === "enemy") {
    return "border-danger bg-transparent text-danger"
  }
  return "border-border bg-bg-subtle text-textMuted"
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
