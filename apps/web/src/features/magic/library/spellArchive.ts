import JSZip from "jszip"

import type { Spell } from "../../../models/magic/spells/Spell"

const ARCHIVE_SCHEMA = "dndmm.homebrew-spells"
const ARCHIVE_VERSION = 1

export async function createHomebrewSpellZip(spells: Spell[]): Promise<Blob> {
  const homebrew = dedupeSpells(spells.filter((spell) => spell.homebrew))
  const zip = new JSZip()

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        schema: ARCHIVE_SCHEMA,
        version: ARCHIVE_VERSION,
        exportedAt: new Date().toISOString(),
        count: homebrew.length,
        spells: homebrew,
      },
      null,
      2,
    ),
  )

  const folder = zip.folder("spells")
  for (const spell of homebrew) {
    folder?.file(
      `${safeFileName(spell.name || spell.index)}.json`,
      JSON.stringify(spell, null, 2),
    )
  }

  return zip.generateAsync({ type: "blob" })
}

export async function readHomebrewSpellFile(file: File): Promise<Spell[]> {
  const lowerName = file.name.toLocaleLowerCase("en-US")
  if (lowerName.endsWith(".zip")) return readZip(file)
  if (lowerName.endsWith(".json")) return readJsonText(await file.text())

  throw new Error("Use um arquivo .zip ou .json.")
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function readZip(file: File): Promise<Spell[]> {
  const zip = await JSZip.loadAsync(file)
  const manifest = zip.file("manifest.json")

  if (manifest) {
    const fromManifest = readJsonText(await manifest.async("text"))
    if (fromManifest.length) return fromManifest
  }

  const jsonFiles = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLocaleLowerCase("en-US").endsWith(".json"),
  )
  const spells: Spell[] = []

  for (const entry of jsonFiles) {
    spells.push(...readJsonText(await entry.async("text")))
  }

  if (!spells.length) {
    throw new Error("O ZIP não contém magias homebrew reconhecíveis.")
  }

  return dedupeSpells(spells)
}

function readJsonText(text: string): Spell[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error("O arquivo JSON não é válido.")
  }

  const candidates = extractCandidates(parsed)
  const spells = candidates.map(normalizeImportedSpell).filter((spell): spell is Spell => Boolean(spell))

  if (!spells.length) {
    throw new Error("Nenhuma magia homebrew válida foi encontrada no arquivo.")
  }

  return dedupeSpells(spells)
}

function extractCandidates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  if (Array.isArray(value.spells)) return value.spells
  return [value]
}

function normalizeImportedSpell(value: unknown): Spell | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === "string" ? value.name.trim() : ""
  if (!name) return null

  const castingTime = isRecord(value.castingTime) ? value.castingTime : null
  const range = isRecord(value.range) ? value.range : null
  const duration = isRecord(value.duration) ? value.duration : null
  const targeting = isRecord(value.targeting) ? value.targeting : null

  if (!castingTime || !range || !duration || !targeting) return null

  const index =
    typeof value.index === "string" && value.index.trim()
      ? value.index.trim()
      : `homebrew-import-${slug(name)}-${crypto.randomUUID().slice(0, 8)}`

  return {
    ...(value as unknown as Spell),
    index,
    name,
    homebrew: true,
  }
}

function dedupeSpells(spells: Spell[]): Spell[] {
  const byIndex = new Map<string, Spell>()
  for (const spell of spells) byIndex.set(spell.index, spell)
  return Array.from(byIndex.values())
}

function safeFileName(value: string): string {
  return slug(value).slice(0, 80) || "spell"
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
