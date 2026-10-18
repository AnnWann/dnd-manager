import { CombatantInspectorPanel } from "../../../packages/game-ui/src/CombatantInspectorPanel"
import { CreatureQuickSheet, type CombatQuickSheetData } from "../creatures/CreatureQuickSheet"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeHpActionMode } from "./InitiativeHpActionDialog"

export function InitiativeCombatantInspector({
  entry, data, pinned, followingTurn, preferImage, onTogglePinned, onCollapse, onHpAction,
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
  return <CombatantInspectorPanel
    name={entry ? initiativeEntryDisplayName(entry, "master") : undefined}
    status={followingTurn ? "Acompanhando o turno atual" : pinned ? "Ficha fixada" : "Selecionado manualmente"}
    pinned={pinned}
    selected={Boolean(entry && data)}
    canChangeHp={entry?.currentHp !== undefined}
    onTogglePinned={onTogglePinned}
    onCollapse={onCollapse}
    onHpAction={onHpAction}
  >{entry && data ? <CreatureQuickSheet data={data} preferImage={preferImage} compact /> : null}</CombatantInspectorPanel>
}
