import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

// Execute the real, pure resolver functions from the source module, without
// importing browser-only dependencies or mocking the character sheet.
// This checks the same hierarchy consumed by the action list in production.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const filename = resolve(root, "apps/web/src/lib/customSystems/CustomSystemActions.ts")
const sourceText = readFileSync(filename, "utf8")
const source = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true)
const functionNames = [
  "getEffectiveCustomAbilityActivation",
  "mergeActivation",
  "normalizeActionKind",
]
const declarations = functionNames.map(name => {
  const node = source.statements.find(entry =>
    ts.isFunctionDeclaration(entry) && entry.name?.text === name,
  )
  assert.ok(node, `Missing ${name} in production resolver`)
  return node.getText(source).replace(/^export /, "")
})
const code = ts.transpileModule(
  `const ACTION_KINDS = new Set(["action", "bonusAction", "reaction", "free", "legendaryAction", "legendaryReaction", "legendaryResistance"]);\n`
    + declarations.join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None } },
).outputText
const resolveActivation = vm.runInNewContext(
  code + "\ngetEffectiveCustomAbilityActivation",
  Object.create(null),
)

const technique = {
  predefinedAbilityId: "recuar",
  values: { nome: "Recuar" },
}

test("legacy special action inherits category from the ability type", () => {
  const type = {
    activation: {
      kind: "active",
      actionKind: "free",
      resourceChanges: [{ id: "fôlego", operation: "spend" }],
    },
    predefinedAbilities: [{
      id: "recuar",
      activation: {
        actionKind: "special",
        usage: { mode: "unlimited", reset: "manual" },
      },
    }],
  }
  const result = resolveActivation(type, technique)
  assert.equal(result.actionKind, "free")
  assert.equal(result.kind, "active")
  assert.equal(result.usage.mode, "unlimited")
  assert.equal(result.resourceChanges[0].id, "fôlego")
})

test("undefined and unsupported preset categories inherit parent", () => {
  for (const actionKind of [undefined, "", "special", "nonexistent"]) {
    const type = {
      activation: { actionKind: "bonusAction", kind: "active" },
      predefinedAbilities: [{ id: "recuar", activation: { actionKind } }],
    }
    assert.equal(resolveActivation(type, technique).actionKind, "bonusAction")
  }
})

test("valid preset action overrides parent, including freeAction legacy alias", () => {
  for (const [actionKind, expected] of [["reaction", "reaction"], ["freeAction", "free"]]) {
    const type = {
      activation: { actionKind: "action" },
      predefinedAbilities: [{ id: "recuar", activation: { actionKind } }],
    }
    assert.equal(resolveActivation(type, technique).actionKind, expected)
  }
})

test("no parent category does not fabricate an action", () => {
  assert.equal(resolveActivation({
    activation: { kind: "active" },
    predefinedAbilities: [{ id: "recuar", activation: { actionKind: "special" } }],
  }, technique).actionKind, undefined)
})

test("field-selected valid category overrides the inherited default", () => {
  const type = {
    activation: { actionKind: "free", actionKindFieldId: "categoria" },
    predefinedAbilities: [{ id: "recuar", activation: { actionKind: "special" } }],
  }
  assert.equal(resolveActivation(type, {
    ...technique, values: { categoria: "reaction" },
  }).actionKind, "reaction")
})
