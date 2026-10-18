import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve, extname } from "node:path"

const root = process.cwd()
const oldRoot = resolve("session-server")
const newRoot = resolve("apps/session-server")
const oldPkg = JSON.parse(readFileSync(join(oldRoot, "package.json"), "utf8"))
const stagedPkg = JSON.parse(readFileSync(join(newRoot, "package.json"), "utf8"))
if (!existsSync(join(oldRoot, "src")) || existsSync(join(newRoot, "src"))) throw Error("Unexpected migration state")

// Keep the same application workspace name, but preserve Wrangler's actual runtime dependencies.
const pkg = { ...oldPkg, name: stagedPkg.name, ...{scripts: oldPkg.scripts} }
pkg.scripts.deploy = "wrangler deploy --secrets-file ../../.env.session"
pkg.scripts["deploy:qa"] = "wrangler deploy --env qa --secrets-file ../../.env.session.qa"
mkdirSync(newRoot, { recursive: true })
const files = []
function collect(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const source = join(dir, ent.name)
    if (ent.isDirectory()) collect(source)
    else if (ent.isFile()) files.push(source)
  }
}
collect(oldRoot)
const extensionPattern = /\.(?:ts|tsx|js|jsx|mjs|mts|cts)$/
for (const file of files) {
  const subpath = relative(oldRoot, file)
  if (subpath === "package.json" || subpath === "package-lock.json") continue
  const dest = join(newRoot, subpath)
  mkdirSync(dirname(dest), { recursive: true })
  if (extensionPattern.test(file)) {
    let code = readFileSync(file, "utf8")
    // Keep imports resolving to the same absolute destination after relocation,
    // rather than blindly appending "../" to every import.
    const fromFile = dirname(file)
    const toFile = dirname(dest)
    code = code.replace(/(\b(?:from\s*|import\s*\(|import\s*|require\s*\()\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (whole, before, spec, after) => {
      const oldTarget = resolve(fromFile, spec)
      const relocated = oldTarget.startsWith(oldRoot + "/") ? join(newRoot, relative(oldRoot, oldTarget)) : oldTarget
      let rewritten = relative(toFile, relocated).replaceAll("\\", "/")
      if (!rewritten.startsWith(".")) rewritten = "./" + rewritten
      return before + rewritten + after
    })
    writeFileSync(dest, code)
  } else {
    renameSync(file, dest)
  }
}
writeFileSync(join(newRoot, "package.json"), JSON.stringify(pkg, null, 2) + "\n")
rmSync(oldRoot, { recursive: true, force: true })

const rootPkg = JSON.parse(readFileSync("package.json", "utf8"))
rootPkg.workspaces = ["packages/*", "apps/*"]
for (const [key, value] of Object.entries(rootPkg.scripts)) {
  if (typeof value === "string") rootPkg.scripts[key] = value.replaceAll("npm --prefix session-server run ", "npm --workspace @dnd-manager/session-server-app run ")
}
writeFileSync("package.json", JSON.stringify(rootPkg, null, 2) + "\n")
const checkPath = "scripts/check-workspace-layout.mjs"
let check = readFileSync(checkPath, "utf8")
check = check.replaceAll('["packages/*", "apps/*", "session-server"]', '["packages/*", "apps/*"]')
check = check.replaceAll('"session-server", "apps/web", "apps/session-server"', '"apps/web", "apps/session-server"')
check = check.replace('assert.equal(workerApp.scripts.typecheck, "npm --prefix ../../session-server run typecheck")', 'assert.equal(workerApp.scripts.typecheck, "npm run generate-types && tsc --noEmit")')
writeFileSync(checkPath, check)
const auditPath = "scripts/audit-workspace-imports.mjs"
let audit = readFileSync(auditPath, "utf8")
audit = audit.replace('"apps/session-server", "session-server",', '"apps/session-server",')
audit = audit.replace('"session-server/src",', '"apps/session-server/src",')
writeFileSync(auditPath, audit)
const wfPath = ".github/workflows/validate-modular-refactor.yml"
let wf = readFileSync(wfPath, "utf8").replaceAll('"session-server/**"', '"apps/session-server/**"')
writeFileSync(wfPath, wf)
const readmePath = join(newRoot, "README.md")
let readme = readFileSync(readmePath, "utf8").replaceAll("npm install --prefix session-server", "npm ci").replaceAll("cd session-server", "cd apps/session-server").replaceAll("from `session-server`", "from `apps/session-server`")
writeFileSync(readmePath, readme)
console.log("Worker source and configuration moved to apps/session-server; imports rewritten.")
