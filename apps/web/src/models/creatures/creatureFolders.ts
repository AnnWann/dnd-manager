import type { CompendiumCreature } from "./CompendiumCreature"

/** Existing flat folder names remain root folders. Slash separates nesting levels. */
export function normalizeCreatureFolder(value?: string): string {
  return (value ?? "").split("/").map(segment => segment.trim().replace(/\s+/g, " ")).filter(Boolean).join("/")
}

export function sameCreatureFolder(a?: string, b?: string): boolean {
  return normalizeCreatureFolder(a).localeCompare(normalizeCreatureFolder(b), "pt-BR", { sensitivity: "accent" }) === 0
}

export function creatureFolderWithin(folder?: string, parent?: string, includeParent = true): boolean {
  const path = normalizeCreatureFolder(folder)
  const base = normalizeCreatureFolder(parent)
  if (!base) return includeParent || Boolean(path)
  if (includeParent && sameCreatureFolder(path, base)) return true
  return path.toLocaleLowerCase("pt-BR").startsWith(`${base.toLocaleLowerCase("pt-BR")}/`)
}

export function creatureFolderParent(folder?: string): string {
  return normalizeCreatureFolder(folder).split("/").slice(0, -1).join("/")
}

export function creatureFolderLabel(folder?: string): string {
  return normalizeCreatureFolder(folder).split("/").at(-1) ?? ""
}

export function creatureFolderPath(parent: string | undefined, child: string): string {
  return normalizeCreatureFolder([parent, child].filter(Boolean).join("/"))
}

export function creatureFolderChildren(folders: string[], parent?: string): string[] {
  const base = normalizeCreatureFolder(parent)
  const byKey = new Map<string, string>()
  for (const raw of folders) {
    const path = normalizeCreatureFolder(raw)
    if (!path || !creatureFolderWithin(path, base, false)) continue
    const relative = base ? path.slice(base.length + 1) : path
    const child = creatureFolderPath(base, relative.split("/")[0])
    const key = child.toLocaleLowerCase("pt-BR")
    if (!byKey.has(key)) byKey.set(key, child)
  }
  return [...byKey.values()].sort((a, b) => creatureFolderLabel(a).localeCompare(creatureFolderLabel(b), "pt-BR"))
}

export function creatureFolderPaths(folders: string[], creatures: CompendiumCreature[]): string[] {
  const paths = new Map<string, string>()
  for (const raw of [...folders, ...creatures.map(creature => creature.folder ?? "")]) {
    const path = normalizeCreatureFolder(raw)
    if (!path) continue
    const segments = path.split("/")
    for (let i = 1; i <= segments.length; i++) {
      const ancestor = segments.slice(0, i).join("/")
      const key = ancestor.toLocaleLowerCase("pt-BR")
      if (!paths.has(key)) paths.set(key, ancestor)
    }
  }
  return [...paths.values()].sort((a, b) => a.localeCompare(b, "pt-BR"))
}

export function replaceCreatureFolderPrefix(path: string | undefined, oldPath: string, newPath: string): string | undefined {
  if (!creatureFolderWithin(path, oldPath)) return path
  const normalized = normalizeCreatureFolder(path)
  const oldNormalized = normalizeCreatureFolder(oldPath)
  return creatureFolderPath(newPath, normalized.slice(oldNormalized.length).replace(/^\//, "")) || undefined
}
