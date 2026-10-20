import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const entry = fileURLToPath(new URL("../../../apps/session-server/src/routes/session/attackRiderDice.ts", import.meta.url))
const result = await build({
  entryPoints: [entry],
  alias: {
    "@dnd-manager/game-core/long-rest-settings": fileURLToPath(new URL("../../../packages/game-core/src/longRestSupplySettings.ts", import.meta.url)),
    "@dnd-manager/game-core/campaign-progression": fileURLToPath(new URL("../../../packages/game-core/src/campaignProgression.ts", import.meta.url)),
    "@dnd-manager/game-core/manual-dice": fileURLToPath(new URL("../../../packages/game-core/src/manualDiceExpression.ts", import.meta.url)),
  },
  bundle: true, platform: "node", format: "esm", target: "node24", write: false,
})
const { rollAttackRiderDamages } = await import(
  "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"),
)

const weaponId = "43a90ca1-6e40-4fea-9b2e-9987c92e8240"
const rider = {
  id: "66d72de1-9b64-4e8e-b680-3e6fccfdda49",
  label: "Dano adicional",
  scope: "weapon",
  weaponId,
  weaponSelection: "onActivation",
  damage: { dice: "1d6", damageType: "lightning", magical: true },
}

test("Condutor Dracônico: one Crimson Rite extra die stays one even if resolved twice", () => {
  const damages = rollAttackRiderDamages([rider, { ...rider }], false, "piercing")
  assert.equal(damages.length, 1)
  assert.equal(damages[0].damageType, "lightning")
  assert.equal(damages[0].groups[0].quantity, 1)
  assert.ok(damages[0].total >= 1 && damages[0].total <= 6)
})

test("same rite on two weapons is a distinct effect for each weapon", () => {
  const damages = rollAttackRiderDamages([
    rider,
    { ...rider, weaponId: "other-weapon" },
  ], false, "piercing")
  assert.equal(damages.length, 2)
})

test("genuinely different on-hit effects on the same weapon remain distinct", () => {
  const damages = rollAttackRiderDamages([
    rider,
    { ...rider, id: "other-rider", damage: { dice: "1d4", damageType: "fire" } },
  ], false, "piercing")
  assert.equal(damages.length, 2)
  assert.deepEqual(damages.map(entry => entry.damageType), ["lightning", "fire"])
})

test("a critical doubles the die count only once", () => {
  const damages = rollAttackRiderDamages([rider, rider], true, "piercing")
  assert.equal(damages.length, 1)
  assert.equal(damages[0].groups[0].quantity, 2)
})
