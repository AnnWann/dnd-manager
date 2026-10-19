import OBR, { isImage } from "@owlbear-rodeo/sdk"

export const TOKEN_CHARACTER_METADATA = "com.dnd-manager.owlbear/character-link"
export type TokenCharacterLink = { sessionId: string; characterId: string }
export function readTokenCharacterLink(metadata: Record<string, unknown>): TokenCharacterLink | null {
  const value = metadata[TOKEN_CHARACTER_METADATA]
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const link = value as Record<string, unknown>
  return typeof link.sessionId === "string" && typeof link.characterId === "string"
    ? {sessionId: link.sessionId, characterId: link.characterId} : null
}
export async function setTokenCharacterLink(tokenId: string, link: TokenCharacterLink | null) {
  await OBR.scene.items.updateItems([tokenId], draft => {
    for (const item of draft) {
      item.metadata[TOKEN_CHARACTER_METADATA] = link
    }
  })
}
export async function readSelectedToken() {
  const ids = await OBR.player.getSelection()
  if (!ids?.length) return null
  const items = await OBR.scene.items.getItems(ids)
  return items.find(item => item.layer === "CHARACTER" || isImage(item)) ?? null
}
