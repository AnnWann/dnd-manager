import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

// Exercise the actual, pure server presentation builders in isolation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const filename = resolve(root, "apps/session-server/src/routes/characters/custom-systems/CustomSystemSessionActor.ts")
const text = readFileSync(filename, "utf8")
const tree = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true)
const names = ["displayCustomValue", "customRollPresentation", "buildCustomSystemActionAnnouncement"]
const code = names.map(name => {
  const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(fn, `Missing source helper: ${name}`)
  return fn.getText(tree)
}).join("\n")
const js = ts.transpileModule(code, {
  compilerOptions: {target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.None},
}).outputText
const announce = vm.runInNewContext(js + "\nbuildCustomSystemActionAnnouncement", {
  crypto: { randomUUID: () => "id" },
  Date,
})

const character = {get(key) { return key === "name" ? "Valerium" : undefined }}
const definition = {
  id: "martial",
  name: "Técnicas Marciais",
  abilityTypes: [{
    id: "tec_marcial",
    name: "Técnica Marcial Simples",
    display: {titleFieldId: "nome", descriptionFieldId: "desc"},
    predefinedAbilities: [{id: "recuar", description: "Técnica marcial comum."}],
  }],
  actions: [{id: "recompor", name: "Recompor Fôlego", description: "Recupera fôlego."}],
}
const state = {
  abilities: [{id: "instance-1", abilityTypeId: "tec_marcial", predefinedAbilityId: "recuar",
    values: {nome: "Recuar", desc: "Após acertar, mova-se 1,5 m sem ataques de oportunidade."}}],
}
test("description-only custom ability produces a full roll-feed announcement without dice", () => {
  const result = announce("actor", character, definition, state, {
    type: "character.customSystem.ability.activate",
    characterId: "char", systemId: "martial", abilityId: "instance-1", visibility: "public",
  })
  assert.equal(result.sourceType, "announcement")
  assert.equal(result.title, "Recuar")
  assert.equal(result.subtitle, "Técnicas Marciais · Técnica Marcial Simples")
  assert.equal(result.description, "Após acertar, mova-se 1,5 m sem ataques de oportunidade.")
  assert.equal(result.sourceName, "Valerium")
  assert.equal(result.visibility, "public")
  assert.equal(result.primary, undefined)
  assert.equal(result.attack, undefined)
  assert.equal(result.save, undefined)
  assert.equal(result.damage, undefined)
})

test("private description-only announcements keep their roll visibility", () => {
  const result = announce("actor", character, definition, state, {
    type: "character.customSystem.ability.activate",
    characterId: "char", systemId: "martial", abilityId: "instance-1",
    visibility: "roller-master", activationLevel: 2,
  })
  assert.equal(result.visibility, "roller-master")
  assert.equal(Array.from(result.details ?? []).join(), "Nível de uso: 2")
})

test("standalone system actions also announce their description", () => {
  const result = announce("actor", character, definition, state, {
    type: "character.customSystem.action.execute",
    characterId: "char", systemId: "martial", actionId: "recompor",
  })
  assert.equal(result.title, "Recompor Fôlego")
  assert.equal(result.description, "Recupera fôlego.")
  assert.equal(result.sourceType, "announcement")
})
