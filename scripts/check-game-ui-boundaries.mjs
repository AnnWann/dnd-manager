import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = "packages/game-ui/src"
const files = readdirSync(root).filter((file) => /\.tsx?$/.test(file))
const forbidden = /(?:from\s*["']|import\s*\(["'])(?:\.\.\/\.\.\/\.\.\/src\/|@\/|react-router|@prisma|@cloudflare|next\/)/

for (const file of files) {
  const content = readFileSync(join(root, file), "utf8")
  assert.ok(!forbidden.test(content), `game-ui must not import host app dependencies: ${file}`)
}
console.log(`Validated independence of ${files.length} shared UI modules`)
