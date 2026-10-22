import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCriticalDamageRule,
  validateCriticalFormula,
  isCriticalDamageSettings,
  CRITICAL_PRESETS,
} from "../src/criticalDamage.ts";
const damage = (
  sides,
  rolls,
  modifier = 0,
  damageType = "slashing",
  critical = true,
) => ({
  groups: [{ quantity: rolls.length, sides, rolls }],
  modifier,
  total: rolls.reduce((a, b) => a + b, 0) + modifier,
  critical,
  damageType,
});
const total = (result) =>
  (result.damage?.total ?? 0) +
  (result.damages ?? []).reduce((s, d) => s + d.total, 0);

test("legacy settings and standard preserve rolls and totals exactly", () => {
  for (const settings of [undefined, { mode: "standard" }]) {
    const result = { damage: damage(8, [2, 3], 4) },
      original = structuredClone(result);
    applyCriticalDamageRule(result, settings, () => {
      throw Error("must not reroll");
    });
    assert.deepEqual(result, original);
  }
});
test("floor combines weapon and rider before choosing, preserving damage types", () => {
  const result = {
    damage: damage(8, [1, 1], 4),
    damages: [damage(6, [6, 6], 0, "necrotic")],
  };
  applyCriticalDamageRule(result, { mode: "floor" });
  assert.equal(total(result), 18); // 14 rolled vs 14 maximum, not separate floors (24).
  assert.equal(result.damage.total, 6);
  assert.equal(result.damages[0].total, 12);
  assert.equal(result.damages[0].damageType, "necrotic");
});
test("low roll receives global floor, high roll keeps original result", () => {
  for (const [rolls, expected] of [
    [[1, 1], 12],
    [[8, 7], 19],
  ]) {
    const result = { damage: damage(8, rolls, 4) };
    applyCriticalDamageRule(result, { mode: "floor" });
    assert.equal(total(result), expected);
  }
});
test("maximum adds original maximum once, modifiers once", () => {
  const result = {
    damage: damage(8, [2, 7], 4),
    damages: [damage(6, [3, 6], 0, "necrotic")],
  };
  applyCriticalDamageRule(result, { mode: "maximum" });
  assert.equal(total(result), 23); // 2 + 3 + 8 + 6 + 4
  assert.equal(result.damage.total, 14);
  assert.equal(result.damages[0].total, 9);
});
test("each spell instance has its own critical, normal and ineligible damage unaffected", () => {
  const result = {
    instances: [
      { damages: [damage(10, [1, 1, 1, 1, 1, 1])] },
      { damages: [damage(10, [1, 1, 1], 0, "necrotic", false)] },
    ],
  };
  applyCriticalDamageRule(result, { mode: "floor" });
  assert.equal(result.instances[0].damages[0].total, 30);
  assert.equal(result.instances[1].damages[0].total, 3);
  const healing = {
    damages: [
      damage(8, [1, 1], 0, "healing"),
      damage(6, [1], 0, "fire", false),
    ],
  };
  const original = structuredClone(healing);
  applyCriticalDamageRule(healing, { mode: "maximum" });
  assert.deepEqual(healing, original);
});
test("custom supports dice notation, independent roll calls, arithmetic, precedence and caps", () => {
  const result = { damage: damage(8, [2, 3], 4) };
  applyCriticalDamageRule(
    result,
    {
      mode: "custom",
      formula: "min((roll(dice) + roll(dice)) * 2 + 1d6, 30) + mod",
    },
    () => 4,
  );
  assert.equal(total(result), 18);
  assert.equal(result.damage.groups.length, 3);
});
test("negative modifiers remain outside the floor", () => {
  const result = { damage: damage(8, [1, 1], -2) };
  applyCriticalDamageRule(result, { mode: "floor" });
  assert.equal(total(result), 6);
});
test("fractional results floor and negative results clamp to zero", () => {
  for (const [formula, expected] of [
    ["roll(dice) / 2 + mod", 5],
    ["0 - 100", 0],
  ]) {
    const result = { damage: damage(8, [3, 7], 4) };
    applyCriticalDamageRule(result, { mode: "custom", formula });
    assert.equal(total(result), expected);
  }
});
test("presets match their custom equivalents", () => {
  for (const [mode, formula] of Object.entries(CRITICAL_PRESETS)) {
    const a = { damage: damage(8, [2, 3], 4) },
      b = structuredClone(a);
    applyCriticalDamageRule(a, { mode }, () => 1);
    applyCriticalDamageRule(b, { mode: "custom", formula }, () => 1);
    assert.equal(total(a), total(b));
  }
});
test("validation rejects invalid and executable inputs, unbounded dice and division by zero", () => {
  for (const formula of [
    "",
    "dice + mod",
    "roll(dice, 0)",
    "roll(dice, 5)",
    "roll(dice, 1.5)",
    "roll(dice) / 0",
    "roll(dice) * mod",
    "101d6",
    "1d1001",
    "max(1)",
    "max(1,2,3)",
    "process.exit()",
    "globalThis",
    "1;alert(1)",
    "(".repeat(25) + "1" + ")".repeat(25),
    "1".repeat(241),
  ])
    assert.notEqual(validateCriticalFormula(formula), null, formula);
  for (const formula of [
    ...Object.values(CRITICAL_PRESETS),
    "roll(dice, 3) + 2d6 + mod",
    "max(roll(dice, 2), 20) + mod",
  ])
    assert.equal(validateCriticalFormula(formula), null, formula);
  assert.equal(
    isCriticalDamageSettings({ mode: "custom", formula: "roll(dice)/0" }),
    false,
  );
  assert.equal(isCriticalDamageSettings({ mode: "unknown" }), false);
  assert.equal(isCriticalDamageSettings({ mode: "floor" }), true);
});

test("manually supplied damage is not replaced or rerolled", () => {
  const result = {
    damage: {
      groups: [],
      modifier: 4,
      total: 23,
      critical: true,
      expression: "2d8 + 4",
    },
  };
  const original = structuredClone(result);
  applyCriticalDamageRule(result, { mode: "floor" }, () => {
    throw Error("manual dice");
  });
  assert.deepEqual(result, original);
});
test("floor mean matches exact enumeration for a d8 weapon", () => {
  let sum = 0;
  for (let a = 1; a <= 8; a++)
    for (let b = 1; b <= 8; b++) {
      const result = { damage: damage(8, [a, b], 4) };
      applyCriticalDamageRule(result, { mode: "floor" });
      sum += result.damage.total;
    }
  assert.equal(sum / 64, 13.875);
});
