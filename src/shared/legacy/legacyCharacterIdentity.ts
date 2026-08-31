type UnknownRecord = Record<string, unknown>

/**
 * Stable-enough identity used only to repair legacy-import duplicates.
 * Runtime values such as HP, levels, resources, ownership and visibility are
 * deliberately excluded so a played session copy can still match its
 * relational/canonical counterpart.
 */
export function legacyCharacterIdentitySignature(value: unknown): string | null {
  if (!isRecord(value)) return null

  const name = normalizeIdentityToken(value.name)
  if (!name) return null

  const sheet = isRecord(value.sheet) ? value.sheet : null
  const raceState = sheet && isRecord(sheet.race) ? sheet.race : null
  const race =
    normalizeIdentityToken(raceState?.race) ||
    normalizeIdentityToken(raceState?.name) ||
    normalizeIdentityToken(raceState?.index) ||
    normalizeIdentityToken(raceState?.customName)
  const subrace = normalizeIdentityToken(raceState?.subrace)
  const type = sheet ? normalizeIdentityToken(sheet.type) : ""
  const classes = readClasses(sheet?.classes)

  // Name alone is too weak for an automatic destructive reconciliation.
  if (!race && classes.length === 0) return null

  return JSON.stringify({ name, race, subrace, type, classes })
}

export function haveSameLegacyCharacterIdentity(
  left: unknown,
  right: unknown,
): boolean {
  const leftSignature = legacyCharacterIdentitySignature(left)
  const rightSignature = legacyCharacterIdentitySignature(right)
  return Boolean(
    leftSignature &&
    rightSignature &&
    leftSignature === rightSignature,
  )
}

function readClasses(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const className =
      normalizeIdentityToken(candidate.className) ||
      normalizeIdentityToken(candidate.name) ||
      normalizeIdentityToken(candidate.index)
    return className ? [className] : []
  })
}

function normalizeIdentityToken(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
