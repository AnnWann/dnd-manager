from pathlib import Path

path = Path("src/lib/customSystems/CharacterSheetFormula.ts")
text = path.read_text()
start = text.index("function containsIdentifier(")
text = text[:start] + '''function containsIdentifier(
  expression: string,
  identifier: string,
): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")
  return new RegExp(
    "(^|[^A-Za-z0-9_.-])" + escaped + "(?=$|[^A-Za-z0-9_.-])",
  ).test(expression)
}
'''
path.write_text(text)

if 'identifier.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")' not in text:
    raise SystemExit("formula identifier escaping was not applied")
