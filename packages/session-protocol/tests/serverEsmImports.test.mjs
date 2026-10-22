import test from "node:test"
import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import ts from "typescript"

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory)
    return entry.isDirectory() ? sourceFiles(url)
      : /\.[cm]?tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [url] : []
  }))
  return nested.flat()
}

// Vite/esbuild bundle extensionless imports successfully, but Vercel's Node
// functions retain ESM specifiers when emitting JS. Test that actual boundary.
test("Vercel server relative runtime imports specify emitted JavaScript extensions", async () => {
  const invalid = []
  for (const directory of ["api", "api-handlers", "server"]) {
    const files = await sourceFiles(new URL(`../../../apps/web/${directory}/`, import.meta.url))
    for (const file of files) {
      const source = ts.createSourceFile(fileURLToPath(file), await readFile(file, "utf8"), ts.ScriptTarget.Latest, true)
      function check(specifier) {
        if (specifier?.startsWith(".") && !/\.(?:js|mjs|cjs|json)$/.test(specifier)) {
          invalid.push(`${fileURLToPath(file)}: ${specifier}`)
        }
      }
      function visit(node) {
        if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
          const bindings = node.importClause?.namedBindings
          const onlyTypeSpecifiers = !node.importClause?.name && bindings && ts.isNamedImports(bindings)
            && bindings.elements.length > 0 && bindings.elements.every(entry => entry.isTypeOnly)
          if (!onlyTypeSpecifiers && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text)
        }
        if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text)
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
          && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  assert.deepEqual(invalid, [], `Relative server imports need a .js extension:\n${invalid.join("\n")}`)
})
