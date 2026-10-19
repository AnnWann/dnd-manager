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

export const TOKEN_CREATURE_METADATA = "com.dnd-manager.owlbear/creature-link"
export type TokenCreatureLink = {sessionId: string; entryId: string}
export function readTokenCreatureLink(metadata: Record<string, unknown>): TokenCreatureLink | null {
 const link = metadata[TOKEN_CREATURE_METADATA]
 if (!link || typeof link !== "object" || Array.isArray(link)) return null
 const data = link as Record<string,unknown>
 return typeof data.sessionId === "string" && typeof data.entryId === "string"
   ? {sessionId:data.sessionId,entryId:data.entryId}:null
}
export async function setTokenCreatureLink(tokenId:string,link:TokenCreatureLink|null){
 await OBR.scene.items.updateItems([tokenId], items=>{
   for(const item of items){
     item.metadata[TOKEN_CREATURE_METADATA]=link
     if(link)item.metadata[TOKEN_CHARACTER_METADATA]=null
   }
 })
}
