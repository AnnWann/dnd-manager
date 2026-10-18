import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = "packages/session-protocol/src"
const files = readdirSync(root).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
const prohibited = /(?:from\s*["']|import\s*\(["'])(?:react(?:\/|["'])|react-dom|@prisma|@cloudflare|\.\.\/\.\.\/\.\.\/src\/|@\/|next\/)/

for (const file of files) {
  const source = readFileSync(join(root, file), "utf8")
  assert.ok(!prohibited.test(source), `session-protocol cannot import app or runtime modules: ${file}`)
}
console.log(`Validated independence of ${files.length} session protocol modules`)
