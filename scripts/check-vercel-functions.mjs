import { readdir } from "node:fs/promises"
import path from "node:path"

const API_DIRECTORY = path.resolve("api")
const EXPECTED_FUNCTION_COUNT = 9
const FUNCTION_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"])

const entrypoints = []

await walk(API_DIRECTORY)
entrypoints.sort()

if (entrypoints.length !== EXPECTED_FUNCTION_COUNT) {
  console.error(
    `Expected ${EXPECTED_FUNCTION_COUNT} Vercel function entrypoints, found ${entrypoints.length}.`,
  )
  for (const entrypoint of entrypoints) console.error(`- ${entrypoint}`)
  process.exit(1)
}

console.log(`Vercel function entrypoints (${entrypoints.length}):`)
for (const entrypoint of entrypoints) console.log(`- ${entrypoint}`)

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue
      await walk(absolutePath)
      continue
    }

    if (!entry.isFile() || !isFunctionEntrypoint(entry.name)) continue
    entrypoints.push(path.relative(process.cwd(), absolutePath).replaceAll(path.sep, "/"))
  }
}

function isFunctionEntrypoint(fileName) {
  if (fileName.startsWith("_") || fileName.startsWith(".")) return false
  if (fileName.endsWith(".d.ts")) return false
  return FUNCTION_EXTENSIONS.has(path.extname(fileName))
}
