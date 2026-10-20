import { useEffect } from "react"
import OBR, { buildShape, type Item } from "@owlbear-rodeo/sdk"
import type { InitiativeSession } from "../../web/src/models/initiative/Initiative"
import { readTokenCharacterLink, readTokenCreatureLink } from "./tokenCharacterLink"

type ActiveToken = {
  entryId: string
  combatantIds: ReadonlySet<string>
  sourceId?: string
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
  return { entryId: active.id, combatantIds, sourceId: active.sourceType === "character" ? active.sourceId : undefined }
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
  if (!token.sourceId) return undefined
  return items.find(item => {
    if (item.visible === false) return false
    const link = readTokenCharacterLink(item.metadata)
    return link?.sessionId === sessionId && link.characterId === token.sourceId
  })
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
    let markerId: string | undefined
    let signature = ""

    async function clear(): Promise<void> {
      const oldId = markerId
      markerId = undefined
      signature = ""
      if (oldId && await OBR.scene.isReady()) {
        await OBR.scene.local.deleteItems([oldId])
      }
    }

    async function reconcile(): Promise<void> {
      if (disposed) return
      const sceneReady = await OBR.scene.isReady()
      if (!sceneReady) {
        markerId = undefined
        signature = ""
        return
      }
      if (!active || !sessionId) {
        await clear()
        return
      }
      const tokens = await OBR.scene.items.getItems(
        item => item.layer === "CHARACTER" || Boolean(readTokenCreatureLink(item.metadata)) || Boolean(readTokenCharacterLink(item.metadata)),
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
      if (markerId && signature === nextSignature) return
      await clear()
      if (disposed) return
      const outline = buildShape()
        .name("Turno atual · D&D Manager")
        .shapeType("CIRCLE")
        .width(size)
        .height(size)
        .position({ x: bounds.center.x - size / 2, y: bounds.center.y - size / 2 })
        .layer("ATTACHMENT")
        .attachedTo(token.id)
        .disableHit(true)
        .locked(true)
        .fillColor("#000000")
        .fillOpacity(0)
        .strokeColor("#f5ca57")
        .strokeOpacity(0.95)
        .strokeWidth(Math.max(3, Math.min(10, diameter * 0.045)))
        .build()
      await OBR.scene.local.addItems([outline])
      markerId = outline.id
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
  }, [ready, sessionId, ids, active?.entryId, active?.sourceId])
}
