import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import process from "node:process"

const args = new Set(process.argv.slice(2))
const environment = args.has("--production") ? "production" : "development"
const vercelPort = process.env.LOCAL_VERCEL_PORT || "3000"
const sessionServerUrl = process.env.VITE_SESSION_SERVER_URL || "http://localhost:8787"

if (!existsSync("session-server/node_modules")) {
  console.error("\n[dev:full] session-server dependencies are missing.")
  console.error("Run `npm install --prefix session-server` once, then run this command again.\n")
  process.exit(1)
}

if (
  environment === "production" &&
  process.env.ALLOW_PRODUCTION_DATA !== "1"
) {
  console.error("\n[dev:full] Refusing to load Production Vercel environment variables by default.")
  console.error("Production variables may point at the real production database and external services.")
  console.error("If that is intentional, run:")
  console.error("  ALLOW_PRODUCTION_DATA=1 npm run dev:full:prod-env\n")
  process.exit(1)
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
const vercelCommand = process.platform === "win32" ? "vercel.cmd" : "vercel"

const commonEnv = {
  ...process.env,
  VITE_SESSION_SERVER_URL: sessionServerUrl,
  VITE_LOCAL_AUTH_BYPASS: "false",
}

const children = []
let shuttingDown = false

function start(name, command, commandArgs, env = commonEnv) {
  console.log(`[dev:full] starting ${name}: ${command} ${commandArgs.join(" ")}`)
  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  })

  child.on("exit", (code, signal) => {
    if (shuttingDown) return
    console.error(`\n[dev:full] ${name} exited (${signal ?? code ?? "unknown"}). Stopping local stack.`)
    shutdown(code ?? 1)
  })

  children.push(child)
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM")
  }

  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGKILL")
    }
    process.exit(exitCode)
  }, 3000)
  forceTimer.unref()

  setTimeout(() => process.exit(exitCode), 500).unref()
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

console.log("\n[dev:full] Local production-like stack")
console.log(`[dev:full] Vercel env: ${environment}`)
console.log(`[dev:full] App + Vercel Functions: http://localhost:${vercelPort}`)
console.log(`[dev:full] Session Worker + Durable Objects: ${sessionServerUrl}`)
console.log("[dev:full] Local auth bypass: disabled")
console.log(
  environment === "development"
    ? "[dev:full] Database/services: values configured in Vercel Development env\n"
    : "[dev:full] WARNING: using Vercel Production env values locally\n",
)

const vercelArgs =
  environment === "production"
    ? [
        "env",
        "run",
        "-e",
        "production",
        "--",
        vercelCommand,
        "dev",
        "--listen",
        vercelPort,
      ]
    : ["dev", "--listen", vercelPort]

start("Vercel", vercelCommand, vercelArgs)
start("Session server", npmCommand, ["run", "dev:session-server"])
