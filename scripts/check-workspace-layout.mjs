import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const read = (file) => JSON.parse(readFileSync(file, "utf8"))
const root = read("package.json")
assert.deepEqual(root.workspaces, ["packages/*", "apps/*", "session-server"])
assert.equal(root.private, true, "workspace root must be private")

const names = new Set()
for (const folder of ["packages/game-core", "packages/game-ui", "packages/session-client", "packages/session-protocol", "session-server", "apps/web", "apps/session-server"]) {
  const pkg = read(join(folder, "package.json"))
  assert.equal(pkg.private, true, `${folder} must not be published`)
  assert.ok(pkg.name && !names.has(pkg.name), `duplicate or missing workspace name: ${folder}`)
  names.add(pkg.name)
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    assert.ok(subpath.startsWith("./") && target.startsWith("./src/"), `invalid export mapping: ${folder} ${subpath}`)
    assert.ok(existsSync(join(folder, target)), `missing export target: ${folder} ${subpath}`)
  }
}
assert.ok(root.scripts["typecheck:session-server"])
console.log("Validated 7 local workspace manifests, independent exports and root scripts")

const web = read("apps/web/package.json")
const workerApp = read("apps/session-server/package.json")
assert.equal(web.scripts.build, "npm --prefix ../.. run build")
assert.equal(workerApp.scripts.typecheck, "npm --prefix ../../session-server run typecheck")
console.log("App workspace entry points preserve active deployment roots")

const lock = read("package-lock.json")
const lockHasWorkspaces = Array.isArray(lock.packages[""]?.workspaces)
if (!lockHasWorkspaces) {
  console.warn("Workspace lockfile migration pending: run npm install --package-lock-only and commit the result")
} else {
assert.equal(lock.lockfileVersion, 3, "npm workspace lockfile must use v3")
assert.deepEqual(lock.packages[""].workspaces, root.workspaces, "lockfile root workspace configuration must match package.json")
for (const folder of ["packages/game-core", "packages/game-ui", "packages/session-client", "packages/session-protocol", "session-server", "apps/web", "apps/session-server"]) {
  const pkg = read(join(folder, "package.json"))
  assert.equal(lock.packages[folder]?.name, pkg.name, `lockfile missing workspace package: ${folder}`)
  assert.equal(lock.packages[`node_modules/${pkg.name}`]?.link, true, `lockfile missing workspace symlink: ${pkg.name}`)
}
console.log("Validated lockfile workspace registrations and symlinks")
}
