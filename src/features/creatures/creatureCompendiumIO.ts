import JSZip from "jszip"

import { uploadImage } from "../../lib/uploadImage"
import {
  normalizeCompendiumCreature,
  type CompendiumCreature,
} from "../../models/creatures/CompendiumCreature"

const CREATURE_PACK_FORMAT = "dnd-manager-creature-pack"
const CREATURE_PACK_VERSION = 1

const JSON_MIME = "application/json"
const ZIP_MIME = "application/zip"

export type CreatureImportResult = {
  creatures: CompendiumCreature[]
  warnings: string[]
  importedFiles: number
}

type PortableCreature = Omit<CompendiumCreature, "sheetImageUrl"> & {
  imageUrl?: string
  imagePath?: string
  /** Legacy path accepted from packs created before creature portraits. */
  sheetImagePath?: string
}

type CreaturePackDocument = {
  format: typeof CREATURE_PACK_FORMAT
  version: typeof CREATURE_PACK_VERSION
  exportedAt: string
  creatures: PortableCreature[]
}

type CreatureZipManifestEntry = {
  id: string
  name: string
  jsonPath: string
  imagePath?: string
}

type CreatureZipManifest = {
  format: typeof CREATURE_PACK_FORMAT
  version: typeof CREATURE_PACK_VERSION
  exportedAt: string
  entries: CreatureZipManifestEntry[]
}

export function getCreatureJsonTemplate(): string {
  return JSON.stringify(
    {
      name: "Nome da criatura",
      category: "Monstro",
      size: "Médio",
      challengeRating: "5",
      unique: false,
      defaultSide: "enemy",
      initiativeBonus: 0,
      armorClass: 15,
      maxHp: 75,
      speed: "9 m",
      passivePerception: 12,
      abilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      savingThrows: "",
      skills: "",
      vulnerabilities: "",
      resistances: "",
      immunities: "",
      conditionImmunities: "",
      senses: "",
      languages: "",
      traits: "",
      actions: "",
      bonusActions: "",
      reactions: "",
      legendaryActions: "",
      combatNotes: "",
      imageUrl: "",
    },
    null,
    2,
  )
}

export function downloadCreatureJson(creature: CompendiumCreature): void {
  downloadTextFile(
    JSON.stringify(toPortableCreature(creature), null, 2),
    `${slugify(creature.name)}.json`,
    JSON_MIME,
  )
}

export function downloadCreaturePackJson(
  creatures: CompendiumCreature[],
): void {
  const document: CreaturePackDocument = {
    format: CREATURE_PACK_FORMAT,
    version: CREATURE_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    creatures: creatures.map(toPortableCreature),
  }

  downloadTextFile(
    JSON.stringify(document, null, 2),
    "compendio-de-criaturas.json",
    JSON_MIME,
  )
}

export async function downloadCreatureZip(
  creature: CompendiumCreature,
): Promise<string[]> {
  return downloadCreaturePackZip([creature], slugify(creature.name))
}

export async function downloadCreaturePackZip(
  creatures: CompendiumCreature[],
  filename = "compendio-de-criaturas",
): Promise<string[]> {
  const zip = new JSZip()
  const warnings: string[] = []
  const entries: CreatureZipManifestEntry[] = []

  for (const creature of creatures) {
    const portable = toPortableCreature(creature)
    const baseName = `${slugify(creature.name)}-${creature.id.slice(0, 8)}`
    const jsonPath = `creatures/${baseName}.json`
    let imagePath: string | undefined

    if (creature.sheetImageUrl) {
      try {
        const asset = await fetchImageAsset(creature.sheetImageUrl)
        imagePath = `images/${baseName}.${asset.extension}`
        portable.imagePath = imagePath

        // A ZIP deve ser autocontido. O JSON da criatura referencia o arquivo
        // relativo do pack em vez de depender da URL remota original.
        delete portable.imageUrl
        zip.file(imagePath, asset.blob)
      } catch {
        warnings.push(
          `Não foi possível incluir a imagem de ${creature.name}; a URL original foi preservada.`,
        )
      }
    }

    zip.file(jsonPath, JSON.stringify(portable, null, 2))
    entries.push({
      id: creature.id,
      name: creature.name,
      jsonPath,
      imagePath,
    })
  }

  const manifest: CreatureZipManifest = {
    format: CREATURE_PACK_FORMAT,
    version: CREATURE_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2))
  zip.file(
    "LEIA-ME.txt",
    [
      "Compêndio de Criaturas — D&D Manager",
      "",
      "Importe este arquivo ZIP pela página Compêndio de Criaturas.",
      "As criaturas ficam em /creatures e suas imagens em /images.",
      "Cada JSON usa imagePath para referenciar a imagem correspondente dentro do pack.",
      "Ao importar, o aplicativo descompacta a imagem, envia-a novamente e grava a nova URL na criatura.",
      "Também é possível editar os arquivos JSON manualmente antes da importação.",
    ].join("\n"),
  )

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  downloadBlob(blob, `${filename}.zip`, ZIP_MIME)
  return warnings
}

export async function importCreatureFiles(
  files: File[],
): Promise<CreatureImportResult> {
  const creatures: CompendiumCreature[] = []
  const warnings: string[] = []
  let importedFiles = 0

  for (const file of files) {
    try {
      const result = isZipFile(file)
        ? await importCreatureZip(file)
        : await importCreatureJson(file)

      creatures.push(...result.creatures)
      warnings.push(...result.warnings)
      importedFiles += 1
    } catch (error) {
      warnings.push(`${file.name}: ${errorMessage(error)}`)
    }
  }

  const uniqueCreatures = new Map<string, CompendiumCreature>()
  for (const creature of creatures) uniqueCreatures.set(creature.id, creature)

  return {
    creatures: [...uniqueCreatures.values()],
    warnings,
    importedFiles,
  }
}

async function importCreatureJson(file: File): Promise<CreatureImportResult> {
  const text = await file.text()
  const payload = parseJsonText(text)
  const result = parseCreaturePayload(payload, file.name)

  return {
    ...result,
    importedFiles: 1,
  }
}

async function importCreatureZip(file: File): Promise<CreatureImportResult> {
  const zip = await JSZip.loadAsync(file)
  const warnings: string[] = []
  const creatures: CompendiumCreature[] = []
  const manifestFile = zip.file("manifest.json")

  if (manifestFile) {
    try {
      const manifest = JSON.parse(
        await manifestFile.async("string"),
      ) as Partial<CreatureZipManifest>

      if (
        manifest.format === CREATURE_PACK_FORMAT &&
        Array.isArray(manifest.entries)
      ) {
        for (const entry of manifest.entries) {
          const creatureFile = entry?.jsonPath
            ? zip.file(entry.jsonPath)
            : undefined

          if (!creatureFile) {
            warnings.push(
              `${file.name}: criatura ausente para ${entry?.name ?? "uma entrada"}.`,
            )
            continue
          }

          const payload = parseJsonText(await creatureFile.async("string"))
          const candidates = extractCreatureCandidates(payload)

          for (const candidate of candidates) {
            const prepared = await restoreBundledImage(
              candidate,
              zip,
              entry.imagePath,
              warnings,
              file.name,
            )

            try {
              creatures.push(normalizeCompendiumCreature(prepared))
            } catch (error) {
              warnings.push(
                `${file.name}: ${entry.name ?? "criatura"}: ${errorMessage(error)}`,
              )
            }
          }
        }

        return { creatures, warnings, importedFiles: 1 }
      }
    } catch (error) {
      warnings.push(
        `${file.name}: o manifesto não pôde ser lido (${errorMessage(error)}).`,
      )
    }
  }

  const jsonFiles = Object.values(zip.files).filter(
    (entry) =>
      !entry.dir &&
      entry.name.toLowerCase().endsWith(".json") &&
      entry.name.toLowerCase() !== "manifest.json",
  )

  if (jsonFiles.length === 0) {
    throw new Error("O ZIP não contém arquivos JSON de criaturas.")
  }

  for (const jsonFile of jsonFiles) {
    try {
      const payload = parseJsonText(await jsonFile.async("string"))
      const candidates = extractCreatureCandidates(payload)

      for (const candidate of candidates) {
        const prepared = await restoreBundledImage(
          candidate,
          zip,
          undefined,
          warnings,
          file.name,
        )

        try {
          creatures.push(normalizeCompendiumCreature(prepared))
        } catch (error) {
          warnings.push(
            `${file.name}/${jsonFile.name}: ${errorMessage(error)}`,
          )
        }
      }
    } catch (error) {
      warnings.push(`${file.name}/${jsonFile.name}: ${errorMessage(error)}`)
    }
  }

  return { creatures, warnings, importedFiles: 1 }
}

function parseCreaturePayload(
  payload: unknown,
  sourceName: string,
): Pick<CreatureImportResult, "creatures" | "warnings"> {
  const warnings: string[] = []
  const creatures: CompendiumCreature[] = []
  const candidates = extractCreatureCandidates(payload)

  if (candidates.length === 0) {
    throw new Error("Nenhuma criatura foi encontrada no JSON.")
  }

  candidates.forEach((candidate, index) => {
    try {
      creatures.push(normalizeCompendiumCreature(candidate))
    } catch (error) {
      warnings.push(
        `${sourceName} — criatura ${index + 1}: ${errorMessage(error)}`,
      )
    }
  })

  return { creatures, warnings }
}

function extractCreatureCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload

  const record = asRecord(payload)
  if (!record) return []

  if (Array.isArray(record.creatures)) return record.creatures
  if (record.creature !== undefined) return [record.creature]

  return [record]
}

async function restoreBundledImage(
  candidate: unknown,
  zip: JSZip,
  manifestImagePath: string | undefined,
  warnings: string[],
  sourceName: string,
): Promise<unknown> {
  const record = asRecord(candidate)
  if (!record) return candidate

  const imagePath =
    manifestImagePath ||
    stringValue(record.imagePath).trim() ||
    stringValue(record.sheetImagePath).trim() ||
    undefined

  if (!imagePath) return record

  const imageEntry = zip.file(imagePath)
  if (!imageEntry) {
    warnings.push(`${sourceName}: imagem ausente em ${imagePath}.`)
    return record
  }

  try {
    const bytes = await imageEntry.async("uint8array")
    const imageBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const filename = imagePath.split("/").pop() || "creature-image.png"
    const imageFile = new File([imageBuffer], filename, {
      type: mimeTypeFromFilename(filename),
    })
    const imageUrl = await uploadImage(imageFile)

    return {
      ...record,
      imageUrl,
    }
  } catch (error) {
    warnings.push(
      `${sourceName}: não foi possível restaurar ${imagePath} (${errorMessage(error)}).`,
    )
    return record
  }
}

function toPortableCreature(creature: CompendiumCreature): PortableCreature {
  const { sheetImageUrl, ...portable } = creature

  return {
    ...portable,
    imageUrl: sheetImageUrl,
  }
}

async function fetchImageAsset(
  url: string,
): Promise<{ blob: Blob; extension: string }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Falha ao baixar imagem")

  const blob = await response.blob()
  return {
    blob,
    extension: extensionFromMimeType(blob.type) || extensionFromUrl(url) || "png",
  }
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")

  return JSON.parse(withoutFence)
}

function isZipFile(file: File): boolean {
  return (
    file.type === ZIP_MIME ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  )
}

function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename, mimeType)
}

function downloadBlob(blob: Blob, filename: string, mimeType: string): void {
  const normalizedBlob = blob.type ? blob : new Blob([blob], { type: mimeType })
  const url = URL.createObjectURL(normalizedBlob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "criatura"
}

function extensionFromMimeType(mimeType: string): string | undefined {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  }

  return map[mimeType.toLowerCase()]
}

function extensionFromUrl(url: string): string | undefined {
  const match = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)
  return match?.[1]?.toLowerCase()
}

function mimeTypeFromFilename(filename: string): string {
  const extension = extensionFromUrl(filename)
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  }

  return extension ? map[extension] ?? "application/octet-stream" : "image/png"
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido."
}
