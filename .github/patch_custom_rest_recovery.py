from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# Allow authoritative callers to provide the exact runtime definitions instead
# of depending on the frontend registry singleton.
path = "src/lib/customSystems/CustomFormulaRuntimePatch.ts"
text = read(path)
text = replace_once(
    text,
    "import type { CharacterCustomSystemState } from '../../models/customSystems/CustomSystemDefinition'\n",
    "import type { CharacterCustomSystemState, CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'\n",
    "custom system definition import",
)
text = replace_once(
    text,
    """export function applyCustomSystemRestRecovery(\n  character: CharacterTemplate,\n  restKind: 'short' | 'long',\n  recoveryFraction = 1,\n): CharacterTemplate {\n""",
    """export function applyCustomSystemRestRecovery(\n  character: CharacterTemplate,\n  restKind: 'short' | 'long',\n  recoveryFraction = 1,\n  definitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "rest recovery signature",
)
text = replace_once(
    text,
    """  const recovered = systems.map((state) => {\n    const definition = resolveDefinition?.(state.systemId)\n""",
    """  const recovered = systems.map((state) => {\n    const definition = definitions?.find((entry) => entry.id === state.systemId)\n      ?? resolveDefinition?.(state.systemId)\n""",
    "authoritative definition resolution",
)
write(path, text)

# Thread optional definitions through the shared rest helpers. Existing callers
# remain source-compatible because the new parameter is optional.
path = "src/models/characters/characterRest.ts"
text = read(path)
text = replace_once(
    text,
    'import type { HP } from "../sheet/HP"\n',
    'import type { HP } from "../sheet/HP"\nimport type { CustomSystemDefinition } from "../customSystems/CustomSystemDefinition"\n',
    "rest custom system type import",
)
text = replace_once(
    text,
    """export function takeShortRest(\n  character: CharacterTemplate,\n  healing: number,\n  hitDiceConsumption: HitDiceConsumption,\n): CharacterTemplate {\n""",
    """export function takeShortRest(\n  character: CharacterTemplate,\n  healing: number,\n  hitDiceConsumption: HitDiceConsumption,\n  customSystemDefinitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "short rest signature",
)
text = replace_once(
    text,
    "nextCharacter = applyCustomSystemRestRecovery(nextCharacter, \"short\", 1)\n",
    "nextCharacter = applyCustomSystemRestRecovery(nextCharacter, \"short\", 1, customSystemDefinitions)\n",
    "short rest custom recovery",
)
text = replace_once(
    text,
    """export function takeLongRest(\n  character: CharacterTemplate,\n): CharacterTemplate {\n""",
    """export function takeLongRest(\n  character: CharacterTemplate,\n  customSystemDefinitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "long rest signature",
)
text = replace_once(
    text,
    "return applyCustomSystemRestRecovery(rested, \"long\", 1)\n",
    "return applyCustomSystemRestRecovery(rested, \"long\", 1, customSystemDefinitions)\n",
    "long rest custom recovery",
)
text = replace_once(
    text,
    """export function takePartialLongRest(\n  character: CharacterTemplate,\n): CharacterTemplate {\n""",
    """export function takePartialLongRest(\n  character: CharacterTemplate,\n  customSystemDefinitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "partial long rest signature",
)
text = replace_once(
    text,
    "return applyCustomSystemRestRecovery(rested, \"long\", 0.5)\n",
    "return applyCustomSystemRestRecovery(rested, \"long\", 0.5, customSystemDefinitions)\n",
    "partial long rest custom recovery",
)
write(path, text)

path = "src/models/characters/characterRestWithSorcery.ts"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "./CharacterTemplate"\n',
    'import type { CharacterTemplate } from "./CharacterTemplate"\nimport type { CustomSystemDefinition } from "../customSystems/CustomSystemDefinition"\n',
    "sorcery rest custom system type import",
)
text = replace_once(
    text,
    """export function takeLongRest(\n  character: CharacterTemplate,\n): CharacterTemplate {\n""",
    """export function takeLongRest(\n  character: CharacterTemplate,\n  customSystemDefinitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "sorcery long rest signature",
)
text = replace_once(
    text,
    "const rested = takeBaseLongRest(character)\n",
    "const rested = takeBaseLongRest(character, customSystemDefinitions)\n",
    "sorcery long rest definitions",
)
text = replace_once(
    text,
    """export function takePartialLongRest(\n  character: CharacterTemplate,\n): CharacterTemplate {\n""",
    """export function takePartialLongRest(\n  character: CharacterTemplate,\n  customSystemDefinitions?: CustomSystemDefinition[],\n): CharacterTemplate {\n""",
    "sorcery partial long rest signature",
)
text = replace_once(
    text,
    "const rested = takeBasePartialLongRest(character)\n",
    "const rested = takeBasePartialLongRest(character, customSystemDefinitions)\n",
    "sorcery partial long rest definitions",
)
write(path, text)

# Resolve the authoritative definitions before applying the rest and pass them
# to the shared rest engine. The automation phase reuses the same definitions.
path = "session-server/src/routes/session/SessionActor.ts"
text = read(path)
anchor = """    let next: CharacterTemplate;\n    let nextInventory = inventory;\n"""
replacement = """    const restDefinitions = runtimeConfig\n      ? runtimeDefinitionsForCharacter(current, runtimeConfig, operation.characterId)\n      : [];\n\n    let next: CharacterTemplate;\n    let nextInventory = inventory;\n"""
text = replace_once(text, anchor, replacement, "authoritative rest definitions")
text = replace_once(
    text,
    "next = takeShortRest(current, operation.healing, operation.hitDiceConsumption as any);\n",
    "next = takeShortRest(current, operation.healing, operation.hitDiceConsumption as any, restDefinitions);\n",
    "server short rest definitions",
)
text = replace_once(
    text,
    'next = recovery === "partial" ? takePartialLongRest(current) : takeLongRest(current);\n',
    'next = recovery === "partial" ? takePartialLongRest(current, restDefinitions) : takeLongRest(current, restDefinitions);\n',
    "server long rest definitions",
)
text = replace_once(
    text,
    """        const definitions = runtimeDefinitionsForCharacter(next, runtimeConfig, operation.characterId);\n        next = runCustomSystemAutomations(\n          next,\n          definitions,\n""",
    """        next = runCustomSystemAutomations(\n          next,\n          restDefinitions,\n""",
    "reuse rest definitions for automations",
)
write(path, text)

print("authoritative custom rest recovery patch applied")
