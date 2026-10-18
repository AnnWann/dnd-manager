export function collectReferencedSpellIndexes(value: unknown): string[] {
  const indexes = new Set<string>()

  function visit(current: unknown, parentKey = "") {
    if (Array.isArray(current)) {
      for (const entry of current) visit(entry, parentKey)
      return
    }

    if (!isRecord(current)) return

    const index = readString(current.index)
    if (
      index &&
      (
        "castingMode" in current ||
        "usage" in current ||
        parentKey === "spells" ||
        parentKey === "grantedSpells"
      )
    ) {
      indexes.add(index)
    }

    const spellContainer = isRecord(current.spells) ? current.spells : null
    const spellId = readString(spellContainer?.id)
    if (spellId) indexes.add(spellId)

    const explicitSpellIndex = readString(current.spellIndex)
    if (explicitSpellIndex) indexes.add(explicitSpellIndex)

    for (const [key, child] of Object.entries(current)) {
      visit(child, key)
    }
  }

  visit(value)
  return Array.from(indexes)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
