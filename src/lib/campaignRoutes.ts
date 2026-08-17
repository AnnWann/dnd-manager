export function campaignBasePath(campaignId: string): string {
  return `/campaign/${encodeURIComponent(campaignId)}`
}

export function campaignPath(campaignId: string, path = ""): string {
  const suffix = path.replace(/^\/+/, "")
  return suffix ? `${campaignBasePath(campaignId)}/${suffix}` : campaignBasePath(campaignId)
}

export function campaignCharacterPath(
  campaignId: string,
  characterId?: string,
  tab?: string,
): string {
  if (!characterId) return campaignPath(campaignId, "character")
  const base = campaignPath(
    campaignId,
    `character/${encodeURIComponent(characterId)}`,
  )
  return tab ? `${base}/${encodeURIComponent(tab)}` : base
}

export function campaignCustomSystemPath(
  campaignId: string,
  systemId?: string,
  tab?: string,
): string {
  if (!systemId) return campaignPath(campaignId, "custom-systems")
  const base = campaignPath(
    campaignId,
    `custom-systems/${encodeURIComponent(systemId)}`,
  )
  return tab ? `${base}/${encodeURIComponent(tab)}` : base
}

export function campaignIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/^\/campaign\/([^/]+)(?:\/|$)/)
  if (!match?.[1]) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
