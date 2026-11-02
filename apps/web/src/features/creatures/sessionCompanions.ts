import { getCreationSnapshot, saveCreationSnapshot } from "../../api/creation"
import { buildSessionRuntimeConfigSnapshot } from "../session-runtime/buildSessionRuntimeConfig"

/** Persist against the latest revision before publishing the public portrait projection. */
export async function saveSessionCompanionVisibility(
  campaignId: string,
  creatureId: string,
  visible: boolean,
  referencedSpellIndexes: readonly string[],
) {
  const current = await getCreationSnapshot(campaignId, { force: true })
  if (!current.data.creatureCompendium.some(creature => creature.id === creatureId)) {
    throw new Error("Essa criatura não está mais no compêndio. Atualize a página.")
  }
  const saved = await saveCreationSnapshot(campaignId, current.revision, {
    ...current.data,
    creatureCompendium: current.data.creatureCompendium.map(creature => creature.id === creatureId
      ? { ...creature, showInCompanions: visible, updatedAt: Date.now() }
      : creature),
  })
  return buildSessionRuntimeConfigSnapshot({
    creationRevision: saved.revision,
    creation: saved.data,
    referencedSpellIndexes,
  })
}
