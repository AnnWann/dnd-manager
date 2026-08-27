import { readdir } from "node:fs/promises"
import path from "node:path"

const API_DIRECTORY = path.resolve("api")
const EXPECTED_ENTRYPOINTS = new Set([
  "api/auth.ts",
  "api/campaigns/[...path].ts",
  "api/compendium/spells.ts",
  "api/custom-systems.ts",
  "api/images/upload.ts",
  "api/me/[...path].ts",
  "api/session-connection.ts",
  "api/state.ts",
  "api/translate.ts",
])
const FUNCTION_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"])

const entrypoints = []

await walk(API_DIRECTORY)
entrypoints.sort()

const unexpected = entrypoints.filter((entrypoint) => !EXPECTED_ENTRYPOINTS.has(entrypoint))
const missing = [...EXPECTED_ENTRYPOINTS]
  .filter((entrypoint) => !entrypoints.includes(entrypoint))
  .sort()

if (unexpected.length > 0 || missing.length > 0) {
  console.error(
    `Invalid Vercel api/ layout. Expected exactly ${EXPECTED_ENTRYPOINTS.size} entrypoints.`,
  )

  if (missing.length > 0) {
    console.error("Missing expected entrypoints:")
    for (const entrypoint of missing) console.error(`- ${entrypoint}`)
  }

  if (unexpected.length > 0) {
    console.error("Unexpected function-like files under api/:")
    for (const entrypoint of unexpected) console.error(`- ${entrypoint}`)
  }

  process.exit(1)
}

console.log(`Vercel function entrypoints (${entrypoints.length}):`)
for (const entrypoint of entrypoints) console.log(`- ${entrypoint}`)

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue
      await walk(absolutePath)
      continue
    }

    if (!entry.isFile() || !isFunctionSource(entry.name)) continue
    entrypoints.push(path.relative(process.cwd(), absolutePath).replaceAll(path.sep, "/"))
  }
}

function isFunctionSource(fileName) {
  if (fileName.endsWith(".d.ts")) return false
  return FUNCTION_EXTENSIONS.has(path.extname(fileName))
}
