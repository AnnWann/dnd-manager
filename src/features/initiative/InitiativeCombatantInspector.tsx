import { HeartPulse, PanelRightClose, Pin, PinOff, ShieldPlus, Zap } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { CreatureQuickSheet, type CombatQuickSheetData } from "../creatures/CreatureQuickSheet"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeHpActionMode } from "./InitiativeHpActionDialog"

export function InitiativeCombatantInspector({
  entry,
  data,
  pinned,
  followingTurn,
  preferImage,
  onTogglePinned,
  onCollapse,
  onHpAction,
}: {
  entry?: InitiativeEntry
  data?: CombatQuickSheetData
  pinned: boolean
  followingTurn: boolean
  preferImage?: boolean
  onTogglePinned: () => void
  onCollapse: () => void
  onHpAction: (mode: InitiativeHpActionMode) => void
}) {
  return (
    <aside className="sticky top-4 grid max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto rounded-xl border border-border bg-bg p-3 shadow-theme-lg">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-textMuted">Painel do combatente</div>
          <div className="mt-1 truncate text-sm font-semibold text-textH">
            {entry ? initiativeEntryDisplayName(entry, "master") : "Nenhum combatente selecionado"}
          </div>
          {entry ? (
            <div className="mt-1 text-[11px] text-textMuted">
              {followingTurn ? "Acompanhando o turno atual" : pinned ? "Ficha fixada" : "Selecionado manualmente"}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {entry ? (
            <Button size="icon" variant={pinned ? "primary" : "ghost"} title={pinned ? "Voltar a seguir o turno" : "Fixar esta ficha"} onClick={onTogglePinned}>
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" title="Ocultar painel" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {entry && data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="danger" disabled={entry.currentHp === undefined} onClick={() => onHpAction("damage")}>
              <Zap className="h-4 w-4" /> Dano
            </Button>
            <Button size="sm" variant="primary" disabled={entry.currentHp === undefined} onClick={() => onHpAction("heal")}>
              <HeartPulse className="h-4 w-4" /> Cura
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onHpAction("temporary")}>
              <ShieldPlus className="h-4 w-4" /> Temp.
            </Button>
          </div>
          <CreatureQuickSheet data={data} preferImage={preferImage} compact />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-textMuted">
          Inicie o combate ou clique em um participante para manter sua ficha aqui.
        </div>
      )}
    </aside>
  )
}
