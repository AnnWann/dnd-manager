import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"

const root = "packages/game-core/src"
const files = readdirSync(root).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
const forbidden = /\b(?:from\s*["']|import\s*\(["'])(?:\.\.\/\.\.\/\.\.\/src\/|@\/|react|react-dom|next\/|@cloudflare\/|@prisma\/)/

for (const file of files) {
  const content = readFileSync(join(root, file), "utf8")
  assert.ok(!forbidden.test(content), `Game core cannot depend on application/runtime modules: ${file}`)
}
console.log(`Validated independence of ${files.length} game-core modules`)
