import { HeartPulse, Pencil, Play, Skull, Trash2, Zap } from "lucide-react"

import { Button } from "../../components/ui/Button"
import type { InitiativeEntry } from "../../models/initiative/Initiative"
import {
  ArmorClassEditor,
  ConditionChips,
  DeathSaveCounter,
  EntryIdentity,
  HitPointEditor,
  InitiativeEditor,
  TradeControls,
} from "./InitiativeEntryParts"
import type { InitiativeRosterProps } from "./initiativeRosterTypes"

export function InitiativeTable(props: InitiativeRosterProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-textMuted">
          <tr>
            <th className="px-3 py-3">Turno</th>
            <th className="px-3 py-3">Iniciativa</th>
            <th className="px-3 py-3">Participante</th>
            <th className="px-3 py-3">PV</th>
            <th className="px-3 py-3">CA</th>
            <th className="px-3 py-3">Condições</th>
            <th className="px-3 py-3">Troca</th>
            <th className="px-3 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {props.entries.map((entry) => (
            <TableEntryRows key={entry.id} entry={entry} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableEntryRows({
  entry,
  activeEntryId,
  roundAnchorEntryId,
  round,
  started,
  patchEntry,
  onOpen,
  onRename,
  onHpAction,
  selectedEntryIds,
  onSelectEntry,
  onCondition,
  onRemove,
  onTrade,
  canTrade,
  onRemoveCondition,
}: InitiativeRosterProps & { entry: InitiativeEntry }) {
  const active = entry.id === activeEntryId

  return (
    <>
      {started && entry.id === roundAnchorEntryId ? (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="flex items-center gap-3 border-t-2 border-danger px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-danger">
              <span>Início da rodada {round}</span>
              <span className="h-px flex-1 bg-danger" />
            </div>
          </td>
        </tr>
      ) : null}

      <tr
        className={[
          "border-t border-border transition-colors",
          active ? "bg-accentBg" : "hover:bg-bg-subtle",
          entry.defeated ? "opacity-55" : "",
        ].join(" ")}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {onSelectEntry ? (
              <input
                type="checkbox"
                checked={selectedEntryIds?.has(entry.id) ?? false}
                onChange={(event) => onSelectEntry(entry.id, event.target.checked)}
                aria-label={`Selecionar ${entry.name}`}
              />
            ) : null}
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white">
              <Play className="h-3 w-3" /> Atual
            </span>
          ) : (
            <span className="text-textMuted">{entry.order + 1}</span>
          )}
          </div>
        </td>
        <td className="px-3 py-3">
          <InitiativeEditor
            entry={entry}
            started={started}
            patchEntry={patchEntry}
          />
        </td>
        <td className="px-3 py-3">
          <EntryIdentity entry={entry} onOpen={() => onOpen(entry.id)} />
        </td>
        <td className="px-3 py-3">
          <div className="grid gap-2">
            <HitPointEditor entry={entry} patchEntry={patchEntry} />
            {onHpAction ? (
              <div className="flex gap-1">
                <Button size="sm" variant="danger" title="Aplicar dano" disabled={entry.currentHp === undefined} onClick={() => onHpAction(entry.id, "damage")}>
                  <Zap className="h-3.5 w-3.5" /> −
                </Button>
                <Button size="sm" variant="secondary" title="Aplicar cura" disabled={entry.currentHp === undefined} onClick={() => onHpAction(entry.id, "heal")}>
                  <HeartPulse className="h-3.5 w-3.5" /> +
                </Button>
              </div>
            ) : null}
            <DeathSaveCounter
              entry={entry}
              editable
              onChange={(deathSaves) => patchEntry(entry.id, { deathSaves })}
            />
          </div>
        </td>
        <td className="px-3 py-3">
          <ArmorClassEditor entry={entry} patchEntry={patchEntry} />
        </td>
        <td className="max-w-sm px-3 py-3">
          <ConditionChips
            entry={entry}
            onAdd={() => onCondition(entry.id)}
            onRemove={(conditionId) =>
              onRemoveCondition(entry.id, conditionId)
            }
          />
        </td>
        <td className="px-3 py-3">
          <TradeControls
            entry={entry}
            onTrade={onTrade}
            canTrade={canTrade}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1">
            {onRename ? (
              <Button size="icon" variant="ghost" title="Nome no combate" onClick={() => onRename(entry.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              size="icon"
              variant={entry.defeated ? "outline" : "ghost"}
              title={entry.defeated ? "Reativar" : "Marcar como derrotado"}
              onClick={() =>
                patchEntry(entry.id, {
                  defeated: !entry.defeated,
                  downed: entry.defeated ? entry.downed : false,
                  defeatReason: entry.defeated ? undefined : "manual",
                })
              }
            >
              <Skull className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Remover"
              onClick={() => onRemove(entry.id)}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        </td>
      </tr>
    </>
  )
}
