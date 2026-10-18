import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"

const root = process.cwd()
const workspacePaths = [
  "packages/game-core", "packages/game-ui", "packages/session-client",
  "packages/session-protocol", "apps/web", "apps/session-server",
]
const workspaces = workspacePaths.map((path) => ({ path, absolute: resolve(root, path), pkg: JSON.parse(readFileSync(join(path, "package.json"), "utf8")) }))
const projectDirs = ["apps/web/src", "apps/web/api", "apps/web/api-handlers", "apps/web/server", "apps/session-server/src", "packages"]
const extensions = /\.(?:ts|tsx|js|jsx|mjs|mts|cts)$/
const importPattern = /\b(?:from\s*|import\s*\(|import\s*|require\s*\()\s*["']([^"']+)["']/g
const violations = []
const warnings = []
let scanned = 0

function owner(path) {
  return workspaces.filter((ws) => path.startsWith(ws.absolute + sep)).sort((a, b) => b.absolute.length - a.absolute.length)[0]
}
function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue
    const file = join(dir, entry.name)
    if (entry.isDirectory()) { walk(file); continue }
    if (!entry.isFile() || !extensions.test(file)) continue
    scanned++
    const content = readFileSync(file, "utf8")
    for (const match of content.matchAll(importPattern)) {
      const spec = match[1]
      if (spec.startsWith(".")) {
        const target = resolve(file, "..", spec)
        const targetOwner = owner(target)
        const sourceOwner = owner(resolve(file))
        if (targetOwner && sourceOwner?.path !== targetOwner.path) {
          const msg = `${relative(root, file)}: ${spec} crosses into ${targetOwner.pkg.name}`
          // Existing root website code is not yet a native app workspace.
          warnings.push(msg)
        }
        continue
      }
      if (!spec.startsWith("@dnd-manager/")) continue
      const target = workspaces.find((ws) => spec === ws.pkg.name || spec.startsWith(ws.pkg.name + "/"))
      if (!target) { violations.push(`${relative(root, file)}: unknown workspace import ${spec}`); continue }
      const subpath = spec.slice(target.pkg.name.length)
      if (subpath && !Object.hasOwn(target.pkg.exports ?? {}, "." + subpath)) {
        violations.push(`${relative(root, file)}: unexported workspace path ${spec}`)
      }
      const sourceOwner = owner(resolve(file))
      if (sourceOwner && sourceOwner.path !== target.path) {
        const deps = { ...sourceOwner.pkg.dependencies, ...sourceOwner.pkg.devDependencies, ...sourceOwner.pkg.peerDependencies }
        if (!Object.hasOwn(deps, target.pkg.name)) {
          violations.push(`${relative(root, file)}: ${sourceOwner.pkg.name} must declare ${target.pkg.name}`)
        }
      }
    }
  }
}

for (const dir of projectDirs) walk(resolve(root, dir))
console.log(`Audited ${scanned} source files; ${warnings.length} legacy relative workspace crossings; ${violations.length} invalid scoped imports`)
for (const item of warnings.slice(0, 40)) console.log("MIGRATE:", item)
if (warnings.length > 40) console.log(`... ${warnings.length - 40} additional legacy crossings`)
for (const item of violations) console.error("ERROR:", item)
if (violations.length) process.exitCode = 1
