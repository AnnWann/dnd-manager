import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve("src")
const ALLOWED_NATIVE_SELECT_FILES = new Set([
  path.normalize("src/components/ui/Select.tsx"),
])

const offenders = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }
    if (!/\.(?:tsx|jsx)$/.test(entry.name)) continue

    const relative = path.normalize(path.relative(process.cwd(), absolute))
    if (ALLOWED_NATIVE_SELECT_FILES.has(relative)) continue

    const source = await readFile(absolute, "utf8")
    const matches = [...source.matchAll(/<select(?:\s|>)/g)]
    if (!matches.length) continue

    const lines = source.split(/\r?\n/)
    for (const match of matches) {
      const prefix = source.slice(0, match.index)
      const lineNumber = prefix.split(/\r?\n/).length
      offenders.push(`${relative}:${lineNumber}: ${lines[lineNumber - 1]?.trim() ?? "<select>"}`)
    }
  }
}

await walk(ROOT)

if (offenders.length) {
  console.error("Native <select> elements are not allowed outside src/components/ui/Select.tsx.")
  console.error("Use the shared Select component instead:\n")
  for (const offender of offenders) console.error(`- ${offender}`)
  process.exit(1)
}

console.log("Shared Select boundary check passed.")
