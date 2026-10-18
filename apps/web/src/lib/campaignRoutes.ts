export function sessionBasePath(sessionId: string): string {
  return `/session/${encodeURIComponent(sessionId)}`
}

export function sessionPath(sessionId: string, path = ""): string {
  const suffix = path.replace(/^\/+/, "")
  return suffix ? `${sessionBasePath(sessionId)}/${suffix}` : sessionBasePath(sessionId)
}

export function sessionCreationPath(sessionId: string, path = ""): string {
  const suffix = path.replace(/^\/+/, "")
  return sessionPath(sessionId, suffix ? `creation/${suffix}` : "creation")
}

export function sessionCharacterPath(
  sessionId: string,
  characterId?: string,
  tab?: string,
): string {
  if (!characterId) return sessionPath(sessionId, "character")
  const base = sessionPath(
    sessionId,
    `character/${encodeURIComponent(characterId)}`,
  )
  return tab ? `${base}/${encodeURIComponent(tab)}` : base
}

export function sessionCustomSystemPath(
  sessionId: string,
  systemId?: string,
  tab?: string,
): string {
  if (!systemId) return sessionCreationPath(sessionId, "custom-systems")
  const base = sessionCreationPath(
    sessionId,
    `custom-systems/${encodeURIComponent(systemId)}`,
  )
  return tab ? `${base}/${encodeURIComponent(tab)}` : base
}

export function sessionIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/^\/(?:session|campaign)\/([^/]+)(?:\/|$)/)
  if (!match?.[1]) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/**
 * Compatibility aliases while campaign-management code is progressively
 * separated from the active-session UI. These all resolve to /session routes.
 */
export const campaignBasePath = sessionBasePath
export const campaignPath = sessionPath
export const campaignCharacterPath = sessionCharacterPath
export const campaignCustomSystemPath = sessionCustomSystemPath
export const campaignIdFromPathname = sessionIdFromPathname
