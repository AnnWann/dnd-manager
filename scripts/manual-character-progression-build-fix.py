from pathlib import Path

ROOT = Path('.')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    target.write_text(text.replace(old, new, count))


# Keep old callers compiling while the compatibility finalizer is a no-op.
replace(
    'src/features/characters/progression/CharacterProgressionFlow.tsx',
    '''export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
): CharacterTemplate {
  return character
}''',
    '''export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
  ..._ignored: unknown[]
): CharacterTemplate {
  return character
}''',
)

# TypeScript requires explicit grouping when nullish coalescing and OR mix.
replace(
    'src/features/characters/progression/CharacterProgressionConfigurator.tsx',
    'targetTotalLevel ?? existingTotal || 1',
    '(targetTotalLevel ?? existingTotal) || 1',
)

# Object.fromEntries cannot prove every ClassName key is present.
replace(
    'src/models/leveling/MulticlassRequirements.ts',
    ''') as Record<ClassName, MulticlassRequirementGroup>''',
    ''') as unknown as Record<ClassName, MulticlassRequirementGroup>''',
)

# Class-sourced spell entries always resolve to a class key for this manual map.
replace(
    'src/models/leveling/applyCharacterProgression.ts',
    '''): ClassName | undefined {
  const raw = String(sourceId ?? sourceName)
  return raw.split(":")[0] as ClassName
}''',
    '''): ClassName {
  const raw = String(sourceId ?? sourceName)
  return raw.split(":")[0] as ClassName
}''',
)
