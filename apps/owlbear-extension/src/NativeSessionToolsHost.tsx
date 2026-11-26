import { useMemo, useState } from "react"
import { MemoryRouter } from "react-router-dom"
import { CharacterProvider } from "../../web/src/contexts/characterContext"
import { SyncProvider, type SyncContextValue } from "../../web/src/contexts/syncContext"
import { MagicProvider } from "../../web/src/contexts/magicContext"
import { PartyInventorySettingsProvider } from "../../web/src/contexts/partyInventorySettingsContext"
import { SessionRuntimeContext, type SessionRuntimeContextValue } from "../../web/src/features/session-runtime/SessionRuntimeProvider"
import { PartyInventoryView } from "../../web/src/views/PartyInventoryView"
import { GroundInventoryView } from "../../web/src/views/GroundInventoryView"
import { CompanionsView } from "../../web/src/views/CompanionsView"
import type { AppStateV1 } from "../../web/src/lib/remoteState"
import type { Spell } from "../../web/src/models/magic/spells/Spell"

export type SessionToolsArea = "party" | "ground" | "companions"
type Props = {
  area: SessionToolsArea
  runtime: SessionRuntimeContextValue
  userId: string
  spells: Spell[]
}

/** Share the website screens over Owlbear's existing authenticated transport. */
export function NativeSessionToolsHost({ area, runtime, userId, spells }: Props) {
  const [notice, setNotice] = useState("")
  const appState = useMemo<AppStateV1>(() => ({
    version: 1,
    characters: Object.values(runtime.sessionCharactersById).filter(entry => entry.active !== false)
      .map(entry => runtime.abilitiesByCharacterId[entry.characterId]?.character ?? entry.character),
    activeCharacterId: "",
  }), [runtime.sessionCharactersById, runtime.abilitiesByCharacterId])
  const sync: SyncContextValue = {
    syncKey: runtime.sessionId, userKey: userId, userRole: runtime.role === "MASTER" ? "master" : "player",
    canSync: false, campaignCapabilities: [], sessionMembers: [], syncStatus: { kind: "idle" },
    setSyncKey: () => {}, setUserRole: () => {}, setUserKey: () => {}, pullFromServer: () => {},
  }
  return <MemoryRouter><SyncProvider value={sync}><SessionRuntimeContext.Provider value={runtime}>
    <MagicProvider spells={spells}>
      <CharacterProvider appState={appState} setAppState={() => setNotice("Esta operação precisa ser feita no site.")}
        userRole={sync.userRole} userKey={userId}>
        <PartyInventorySettingsProvider carryCapacity={runtime.inventoryState?.carryCapacity ?? 0}
          additionalSupplyConsumption={runtime.inventoryState?.additionalSupplyConsumption ?? 0}
          inventoryAccessible={runtime.inventoryState?.partyInventoryAccessible !== false}
          canEditCarryCapacity={runtime.role === "MASTER"} setAppState={() => {}}>
          {notice ? <p role="alert" className="error">{notice}<button onClick={() => setNotice("")}>Fechar</button></p> : null}
          {area === "party" ? <PartyInventoryView /> : area === "ground" ? <GroundInventoryView /> : <CompanionsView allowPresentationEditing={false} />}
        </PartyInventorySettingsProvider>
      </CharacterProvider>
    </MagicProvider>
  </SessionRuntimeContext.Provider></SyncProvider></MemoryRouter>
}
