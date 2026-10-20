import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const entry = fileURLToPath(new URL("../../../apps/web/src/models/characters/characterConditionWeaponLinks.ts", import.meta.url))
const output = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", target: "node24", write: false })
const { getConditionWeaponIds, getConditionWeaponLabels } = await import(
  "data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"),
)

const weaponId = "43a90ca1-6e40-4fea-9b2e-9987c92e8240"
const rite = {
  name: "Rito da Tempestade",
  grantedAbilities: [{
    name: "Rito da Tempestade",
    bonuses: { attackRiders: [{ id: "storm", scope: "weapon", weaponSelection: "onActivation", weaponId, damage: { dice: "1d6", damageType: "lightning" } }] },
  }],
}

test("shows the bound Condutor Dracônico on a Crimson Rite condition", () => {
  const weapons = [{ id: weaponId, name: "Condutor Dracônico" }, { id: "other", name: "Espada curta" }]
  assert.deepEqual(getConditionWeaponIds(rite), [weaponId])
  assert.deepEqual(getConditionWeaponLabels(rite, weapons), [{ id: weaponId, label: "Condutor Dracônico", missing: false }])
})

test("does not render an unrelated weapon for unbound conditions", () => {
  assert.deepEqual(getConditionWeaponLabels({ name: "Abençoado" }, [{ id: weaponId, name: "Condutor Dracônico" }]), [])
})

test("resolves direct condition bonuses and grants while deduplicating weapon IDs", () => {
  const withBoth = { ...rite, bonuses: { attackRiders: [{ id: "second", weaponId, scope: "weapon" }, { id: "third", weaponId: "other", scope: "weapon" }] } }
  assert.deepEqual(getConditionWeaponIds(withBoth), [weaponId, "other"])
})

test("leaves a visible dangling weapon association instead of silently hiding it", () => {
  assert.deepEqual(getConditionWeaponLabels(rite, []), [{ id: weaponId, label: "Arma não encontrada", missing: true }])
})

test("resolves sourceWeapon effects through their owning item", () => {
  const condition = {
    sourceItemId: weaponId,
    bonuses: { attackRiders: [{ id: "enchantment", scope: "weapon", weaponSelection: "sourceWeapon" }] },
  }
  assert.deepEqual(getConditionWeaponIds(condition), [weaponId])
})
