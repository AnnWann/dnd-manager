import {
  ChevronDown,
  CirclePlus,
  Swords,
  X,
} from "lucide-react"

import { Button } from "../../components/ui/Button"
import {
  initiativeEntryDisplayName,
  type InitiativeConditionDuration,
  type InitiativeEntry,
  type InitiativeSide,
} from "../../models/initiative/Initiative"

const compactInputClassName = [
  "h-8 rounded-md border border-border bg-bg px-2",
  "text-sm text-textH outline-none",
  "focus:border-accent focus:ring-2 focus:ring-accent/20",
].join(" ")

export function EntryIdentity({
  entry,
  onOpen,
  showTemporaryHp = true,
  viewer = "master",
}: {
  entry: InitiativeEntry
  onOpen?: () => void
  showTemporaryHp?: boolean
  viewer?: "master" | "player"
}) {
  const content = (
    <>
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
        <div className="truncate font-semibold text-textH group-hover:text-accent">
          {initiativeEntryDisplayName(entry, viewer)}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${sideClassName(entry.side)}`}
          >
            {sideLabel(entry.side)}
          </span>
          {showTemporaryHp && entry.temporaryHp ? (
            <span className="text-xs text-accent">
              +{entry.temporaryHp} temp.
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  if (!onOpen) {
    return <div className="flex min-w-0 items-center gap-3 rounded-lg text-left">{content}</div>
  }

  return (
    <button
      type="button"
      className="group flex min-w-0 items-center gap-3 rounded-lg text-left outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      onClick={onOpen}
      title="Abrir ficha rápida"
    >
      {content}
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
          patchEntry(entry.id, {
            maxHp: optionalNumber(event.target.value),
          })
        }
        title="PV máximos"
      />
      {entry.temporaryHp ? (
        <span className="ml-1 text-xs text-accent">
          +{entry.temporaryHp} temp.
        </span>
      ) : null}
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
      min={0}
      className={`${compactInputClassName} w-16 text-center`}
      value={entry.armorClass ?? ""}
      onChange={(event) =>
        patchEntry(entry.id, {
          armorClass: optionalNumber(event.target.value),
        })
      }
      title="Classe de armadura"
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
      className={`${compactInputClassName} w-16 text-center`}
      value={entry.initiative}
      disabled={started}
      onChange={(event) =>
        patchEntry(entry.id, {
          initiative: Number(event.target.value) || 0,
        })
      }
      title="Iniciativa"
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
          className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-subtle px-2 py-1 text-xs text-textH"
          title={conditionDescription(condition.duration)}
        >
          {condition.name}
          <button
            type="button"
            className="rounded-full text-textMuted hover:text-danger"
            onClick={() => onRemove(condition.id)}
            aria-label={`Remover ${condition.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-textMuted hover:border-accent hover:text-accent"
        onClick={onAdd}
      >
        <CirclePlus className="h-3 w-3" />
        Condição
      </button>
    </div>
  )
}

export function DeathSaveCounter({
  entry,
  editable = false,
  onChange,
}: {
  entry: InitiativeEntry
  editable?: boolean
  onChange?: (deathSaves: { successes: number; failures: number }) => void
}) {
  if (entry.sourceType !== "character" || !entry.downed) return null
  const saves = entry.deathSaves ?? { successes: 0, failures: 0 }

  function adjust(kind: "successes" | "failures", delta: number) {
    if (!editable || !onChange) return
    onChange({
      ...saves,
      [kind]: Math.max(0, Math.min(3, saves[kind] + delta)),
    })
  }

  return (
    <div className="grid gap-1 text-[10px] text-textMuted">
      <div className="font-semibold uppercase tracking-wide text-textH">
        Caído · Saves de morte
      </div>
      {(["successes", "failures"] as const).map((kind) => (
        <div key={kind} className="flex items-center gap-1.5">
          <span className={kind === "successes" ? "text-emerald-300" : "text-danger"}>
            {kind === "successes" ? "Sucessos" : "Falhas"}
          </span>
          <div className="flex gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={[
                  "h-2.5 w-2.5 rounded-full border",
                  index < saves[kind]
                    ? kind === "successes"
                      ? "border-emerald-300 bg-emerald-300"
                      : "border-danger bg-danger"
                    : "border-border bg-bg",
                ].join(" ")}
              />
            ))}
          </div>
          {editable ? (
            <div className="ml-1 flex gap-1">
              <button type="button" className="rounded border border-border px-1" onClick={() => adjust(kind, -1)}>−</button>
              <button type="button" className="rounded border border-border px-1" onClick={() => adjust(kind, 1)}>+</button>
            </div>
          ) : null}
        </div>
      ))}
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
  const canMoveBack = canTrade(entry.id, -1)
  const canMoveForward = canTrade(entry.id, 1)

  if (!canMoveBack && !canMoveForward) return <span />

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        title="Trocar com aliado anterior"
        disabled={!canMoveBack}
        onClick={() => onTrade(entry.id, -1)}
      >
        <ChevronDown className="h-4 w-4 rotate-90" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Trocar com próximo aliado"
        disabled={!canMoveForward}
        onClick={() => onTrade(entry.id, 1)}
      >
        <ChevronDown className="h-4 w-4 -rotate-90" />
      </Button>
    </div>
  )
}

export function formatHp(entry: InitiativeEntry): string {
  const current = entry.currentHp ?? 0
  const maximum = entry.maxHp
  const temporary = entry.temporaryHp ?? 0
  const base = maximum === undefined ? String(current) : `${current} / ${maximum}`
  return temporary > 0 ? `${base} (+${temporary})` : base
}

function sideLabel(side: InitiativeSide): string {
  if (side === "ally") return "Aliado"
  if (side === "enemy") return "Inimigo"
  return "Neutro"
}

function sideClassName(side: InitiativeSide): string {
  if (side === "ally") return "border-accentBorder bg-accentBg text-accent"
  if (side === "enemy") return "border-danger/50 bg-danger/10 text-danger"
  return "border-border bg-bg-subtle text-textMuted"
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function conditionDescription(duration: InitiativeConditionDuration): string {
  if (duration.type === "manual") return "Remoção manual"
  if (duration.type === "turns") return `${duration.remaining} turno(s) restante(s)`
  if (duration.type === "rounds") return `${duration.remaining} rodada(s) restante(s)`
  if (duration.type === "untilTurnStart") return "Até o início do turno indicado"
  return "Até o fim do turno indicado"
}
