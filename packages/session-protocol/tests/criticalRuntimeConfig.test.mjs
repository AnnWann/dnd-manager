import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
async function load(path) {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(compiled.outputFiles[0].contents).toString("base64")
  );
}
const { toSessionRuntimeConfig } = await load(
  "../../../apps/web/src/shared/session-runtime/sessionRuntimeConfig.ts",
);
const { parseRuntimeConfigPublishMessage } = await load(
  "../../../apps/session-server/src/routes/session/runtimeConfigProtocol.ts",
);
const { parseRuntimeConfigServerMessage } = await load(
  "../../../apps/web/src/features/session-runtime/runtimeConfigSessionProtocol.ts",
);
const creation = {
  version: 1,
  characters: [],
  spells: [],
  customSystems: [],
  creatureCompendium: [],
  itemCompendium: [],
};
const snapshot = (setting) => ({
  creationRevision: 1,
  config: toSessionRuntimeConfig({ ...creation, criticalDamage: setting }),
});
test("critical formula survives config projection and server/client transport validation", () => {
  const settings = {
    mode: "custom",
    formula: "max(roll(dice, 2), maxDice(dice)) + mod",
  };
  const state = snapshot(settings);
  assert.deepEqual(state.config.criticalDamage, settings);
  const parsed = parseRuntimeConfigPublishMessage(
    JSON.stringify({ type: "session.config.publish", snapshot: state }),
  );
  assert.deepEqual(parsed.snapshot.config.criticalDamage, settings);
  assert.ok(
    parseRuntimeConfigServerMessage(
      JSON.stringify({ type: "session.config.snapshot", snapshot: state }),
    ),
  );
});
test("legacy configs stay valid; malformed formulas are rejected on both transport ends", () => {
  assert.ok(
    parseRuntimeConfigPublishMessage(
      JSON.stringify({
        type: "session.config.publish",
        snapshot: snapshot(undefined),
      }),
    ),
  );
  for (const setting of [
    { mode: "unknown" },
    { mode: "custom", formula: "roll(dice)/0" },
    { mode: "custom", formula: "eval(1)" },
  ]) {
    const state = snapshot(setting);
    assert.equal(
      parseRuntimeConfigPublishMessage(
        JSON.stringify({ type: "session.config.publish", snapshot: state }),
      ),
      null,
    );
    assert.equal(
      parseRuntimeConfigServerMessage(
        JSON.stringify({ type: "session.config.snapshot", snapshot: state }),
      ),
      null,
    );
  }
});
