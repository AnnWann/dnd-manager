import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))

// Node.js serverless functions must import emitted JavaScript, not workspace TS sources.
// Bundle runtime exports so Vercel can trace them independently of the Vite frontend.
await build({
  absWorkingDir: root,
  entryPoints: {
    campaignProgression: "packages/game-core/src/campaignProgression.ts",
    longRestSupplySettings: "packages/game-core/src/longRestSupplySettings.ts",
    manualDiceExpression: "packages/game-core/src/manualDiceExpression.ts",
  },
  outdir: "packages/game-core/dist",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  logLevel: "info",
})
