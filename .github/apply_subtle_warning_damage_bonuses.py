from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


path = "src/features/characters/magic/spellCard.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { ClassName } from "../../../models/sheet/Class"',
    'import type { ClassName } from "../../../models/sheet/Class"\nimport type { Attribute } from "../../../models/sheet/Attribute"\nimport { attributeShort } from "../../../lib/attributeShorts"',
    "spell card attribute imports",
)
text = text.replace(
    'spell.targeting.savingThrowAttribute.toUpperCase()',
    'attributeShort(spell.targeting.savingThrowAttribute)',
)
text = text.replace(
    'parts.push(`atributo: ${data.attribute.toUpperCase()}`)',
    'parts.push(`atributo: ${formatAttributeLabel(data.attribute)}`)',
)
text = replace_once(
    text,
    '''function formatUnknownDie(value: unknown): string | undefined {''',
    '''function formatAttributeLabel(value: string): string {
  if (["str", "dex", "con", "int", "wis", "cha"].includes(value)) {
    return attributeShort(value as Attribute)
  }
  return value.toUpperCase()
}

function formatUnknownDie(value: unknown): string | undefined {''',
    "spell card attribute formatter",
)
write(path, text)


path = "src/features/magic/spellSearch/spellSearchModule.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { ClassName } from "../../../models/sheet/Class"',
    'import type { ClassName } from "../../../models/sheet/Class"\nimport { attributeShort } from "../../../lib/attributeShorts"',
    "spell search attribute import",
)
text = text.replace(
    'spell.targeting.savingThrowAttribute.toUpperCase()',
    'attributeShort(spell.targeting.savingThrowAttribute)',
)
write(path, text)


for filename, needle in {
    "src/features/characters/magic/spellCard.tsx": "formatAttributeLabel",
    "src/features/magic/spellSearch/spellSearchModule.tsx": "attributeShort(spell.targeting.savingThrowAttribute)",
}.items():
    if needle not in read(filename):
        raise SystemExit(f"{needle} missing from {filename}")
