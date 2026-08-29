import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve("src")
const SHARED_SELECT = path.resolve("src/components/ui/Select")
const CENTRAL_SELECT_FILE = path.normalize("src/components/ui/Select.tsx")
const APPLY = process.argv.includes("--write")

const changed = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }
    if (!/\.(?:tsx|jsx)$/.test(entry.name)) continue

    const relative = path.normalize(path.relative(process.cwd(), absolute))
    if (relative === CENTRAL_SELECT_FILE) continue

    const source = await readFile(absolute, "utf8")
    if (!/<select(?:\s|>)/.test(source)) continue

    if (/\bSharedSelect\b/.test(source)) {
      throw new Error(
        `${relative} already contains SharedSelect; migrate it manually before running this codemod.`,
      )
    }

    const importPath = toImportPath(path.dirname(absolute), SHARED_SELECT)
    const migrated = [
      `import { Select as SharedSelect } from ${JSON.stringify(importPath)}`,
      source
        .replace(/<select(?=\s|>)/g, "<SharedSelect")
        .replace(/<\/select>/g, "</SharedSelect>"),
    ].join("\n")

    changed.push(relative)
    if (APPLY) await writeFile(absolute, migrated, "utf8")
  }
}

function toImportPath(fromDirectory, targetWithoutExtension) {
  let relative = path.relative(fromDirectory, targetWithoutExtension)
  relative = relative.split(path.sep).join("/")
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

await walk(ROOT)

if (!changed.length) {
  console.log("No native selects need migration.")
  process.exit(0)
}

console.log(`${APPLY ? "Migrated" : "Would migrate"} ${changed.length} files:`)
for (const file of changed) console.log(`- ${file}`)

if (!APPLY) {
  console.log("Run with --write to apply the migration.")
}
