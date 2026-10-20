import { useEffect } from "react"
import OBR, { buildShape, type Item } from "@owlbear-rodeo/sdk"
import type { InitiativeSession } from "../../web/src/models/initiative/Initiative"
import { readTokenCharacterLink, readTokenCreatureLink, readTokenCompendiumCreature } from "./tokenCharacterLink"

type ActiveToken = {
  entryId: string
  combatantIds: ReadonlySet<string>
  sourceId?: string
  catalogSourceId?: string
}

export function activeInitiativeToken(
  session: InitiativeSession | null,
  role: string,
): ActiveToken | null {
  if (!session?.started || !session.activeEntryId) return null
  const active = session.entries.find(entry => entry.id === session.activeEntryId)
  if (!active || (role !== "MASTER" && active.hidden)) return null
  // Bosses have different entry IDs but the same combatantId. Any one linked
  // turn identifies the same physical token across all those turns.
  const combatantIds = new Set(
    active.combatantId
      ? session.entries.filter(entry => entry.combatantId === active.combatantId).map(entry => entry.id)
      : [active.id],
  )
  const sameSourceEntries = session.entries.filter(entry => entry.sourceId && entry.sourceId === active.sourceId)
  const combatants = new Set(sameSourceEntries.map(entry => entry.combatantId || entry.id))
  return {
    entryId: active.id,
    combatantIds,
    sourceId: active.sourceType === "character" ? active.sourceId : undefined,
    // Only a single combatant of this creature template can be inferred;
    // otherwise catalog tokens would be ambiguous.
    catalogSourceId: active.sourceId?.startsWith("compendium:") && combatants.size === 1
      ? active.sourceId.slice("compendium:".length)
      : undefined,
  }
}

export function findActiveInitiativeItem(
  items: readonly Item[],
  sessionId: string,
  token: ActiveToken | null,
): Item | undefined {
  if (!sessionId || !token) return undefined
  // Prefer an exact initiative instance link; never infer identity by a name
  // or a matching compendium template (several copies may exist).
  const byCreature = items.find(item => {
    if (item.visible === false) return false
    const link = readTokenCreatureLink(item.metadata)
    return link?.sessionId === sessionId && token.combatantIds.has(link.entryId)
  })
  if (byCreature) return byCreature
  if (token.sourceId) {
    const character = items.find(item => {
      if (item.visible === false) return false
      const link = readTokenCharacterLink(item.metadata)
      return link?.sessionId === sessionId && link.characterId === token.sourceId
    })
    if (character) return character
  }
  if (!token.catalogSourceId) return undefined
  const candidates = items.filter(item => {
    if (item.visible === false) return false
    const link = readTokenCompendiumCreature(item.metadata)
    return link?.sessionId === sessionId && link.creatureId === token.catalogSourceId
  })
  return candidates.length === 1 ? candidates[0] : undefined
}

/** A per-viewer, non-persistent outline following the active combatant.
 * It does not alter the token, scene metadata, or other players' images.
 * Each connected Owlbear frame derives it from authoritative initiative state.
 */
export function useActiveInitiativeTokenMarker({
  ready,
  connected,
  sessionId,
  role,
  session,
}: {
  ready: boolean
  connected: boolean
  sessionId: string
  role: string
  session: InitiativeSession | null
}): void {
  const active = connected ? activeInitiativeToken(session, role) : null
  const ids = [...(active?.combatantIds ?? [])].join("|")

  useEffect(() => {
    if (!ready || !OBR.isAvailable) return

    let disposed = false
    let revision = 0
    let queue: Promise<void> = Promise.resolve()
    let markerIds: string[] = []
    let signature = ""

    async function clear(): Promise<void> {
      const oldIds = markerIds
      markerIds = []
      signature = ""
      if (oldIds.length && await OBR.scene.isReady()) {
        await OBR.scene.local.deleteItems(oldIds)
      }
    }

    async function reconcile(): Promise<void> {
      if (disposed) return
      const sceneReady = await OBR.scene.isReady()
      if (!sceneReady) {
        markerIds = []
        signature = ""
        return
      }
      if (!active || !sessionId) {
        await clear()
        return
      }
      const tokens = await OBR.scene.items.getItems(
        item => item.layer === "CHARACTER"
          || Boolean(readTokenCreatureLink(item.metadata))
          || Boolean(readTokenCharacterLink(item.metadata))
          || Boolean(readTokenCompendiumCreature(item.metadata)),
      )
      const token = findActiveInitiativeItem(tokens, sessionId, active)
      if (!token) {
        await clear()
        return
      }
      const bounds = await OBR.scene.items.getItemBounds([token.id])
      if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
        await clear()
        return
      }
      const diameter = Math.max(bounds.width, bounds.height)
      const margin = Math.max(5, Math.min(18, diameter * 0.09))
      const size = diameter + margin * 2
      const nextSignature = [token.id, bounds.center.x, bounds.center.y, size].join(":")
      if (markerIds.length && signature === nextSignature) return
      await clear()
      if (disposed) return
      // Shape positions are their CENTER in Owlbear, whereas bounds.min is
      // the upper-left. Do not subtract half the width from bounds.center:
      // that shifted the indicator diagonally off the token.
      // Reconcile on item changes to keep these local markers aligned.
      const outline = buildShape()
        .name("Turno atual · D&D Manager")
        .shapeType("CIRCLE")
        .width(size)
        .height(size)
        .position({ x: bounds.center.x, y: bounds.center.y })
        .layer("ATTACHMENT")
        .disableHit(true)
        .locked(true)
        .fillColor("#000000")
        .fillOpacity(0)
        .strokeColor("#ffd35e")
        .strokeOpacity(1)
        .strokeWidth(Math.max(5, Math.min(13, diameter * 0.065)))
        .build()
      const arrowSize = Math.max(18, Math.min(36, diameter * 0.22))
      const arrow = buildShape()
        .name("Indicador do turno atual · D&D Manager")
        .shapeType("TRIANGLE")
        .width(arrowSize)
        .height(arrowSize)
        .rotation(180)
        .position({ x: bounds.center.x, y: bounds.min.y - margin - arrowSize / 2 - 3 })
        .layer("ATTACHMENT")
        .disableHit(true)
        .locked(true)
        .fillColor("#ffd35e")
        .fillOpacity(1)
        .strokeColor("#271b0a")
        .strokeWidth(Math.max(2, diameter * 0.015))
        .build()
      await OBR.scene.local.addItems([outline, arrow])
      markerIds = [outline.id, arrow.id]
      signature = nextSignature
    }

    function schedule(): void {
      const currentRevision = ++revision
      queue = queue.catch(() => {}).then(async () => {
        if (disposed || currentRevision !== revision) return
        await reconcile()
      }).catch(error => {
        console.warn("[owlbear] failed to update active initiative token marker", error)
      })
    }

    const unlistenItems = OBR.scene.items.onChange(schedule)
    const unlistenScene = OBR.scene.onReadyChange(schedule)
    schedule()
    return () => {
      disposed = true
      revision++
      unlistenItems()
      unlistenScene()
      void queue.then(clear).catch(error => console.warn("[owlbear] failed to remove initiative token marker", error))
    }
  }, [ready, sessionId, ids, active?.entryId, active?.sourceId, active?.catalogSourceId])
}
