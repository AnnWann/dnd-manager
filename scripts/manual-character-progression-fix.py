from pathlib import Path

ROOT = Path('.')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    target.write_text(text.replace(old, new, count))


# Character creation should no longer materialize or refresh catalog features.
finalize = ROOT / 'src/lib/characterCreation/finalizeCharacterCreation.ts'
text = finalize.read_text()
text = text.replace(
    'import { finalizeProgressionFeatures } from "../../models/leveling/ProgressionFeatureFinalization"\n',
    '',
)
text = text.replace(
    'import { materializeProgressionChoices } from "../../models/leveling/materializeProgressionChoices"\n',
    '',
)
text = text.replace(
    'import { refreshProgressionFeatureMechanics } from "../../models/leveling/refreshProgressionFeatureMechanics"\n',
    '',
)
text = text.replace(
    '''  return refreshProgressionFeatureMechanics(
    materializeProgressionChoices(finalizeProgressionFeatures(patched)),
  )''',
    '  return patched',
)
finalize.write_text(text)

# Level-up persists exactly what the manual progression form produced.
level_up = ROOT / 'src/views/user/UserCharacterLevelUpView.tsx'
text = level_up.read_text()
text = text.replace(
    'import { LevelUpSpellSelectionModal } from "../../features/characters/progression/LevelUpSpellSelectionModal"\n',
    '',
)
text = text.replace(
    'import { materializeProgressionChoices } from "../../models/leveling/materializeProgressionChoices"\n',
    '',
)
text = text.replace(
    'import { refreshProgressionFeatureMechanics } from "../../models/leveling/refreshProgressionFeatureMechanics"\n',
    '',
)
text = text.replace(
    '''        onComplete={(updated) => {
          const finalized = refreshProgressionFeatureMechanics(
            materializeProgressionChoices(updated),
          )
          updateCharacter(characterId, () => finalized)
          navigate(returnPath, { replace: true })
        }}''',
    '''        onComplete={(updated) => {
          updateCharacter(characterId, () => updated)
          navigate(returnPath, { replace: true })
        }}''',
)
text = text.replace('      <LevelUpSpellSelectionModal />\n', '')
level_up.write_text(text)

# These modules existed only to derive or present bundled progression content.
for file_path in [
    'src/models/leveling/materializeProgressionChoices.ts',
    'src/models/leveling/ProgressionChoiceDescriptions.ts',
    'src/features/characters/progression/LevelUpSpellSelectionModal.tsx',
    'src/features/characters/progression/bridges/ProgressionFeatureDescriptionSync.tsx',
]:
    target = ROOT / file_path
    if target.exists():
        target.unlink()

# Fail before build if an automatic progression bridge still survives.
forbidden_tokens = [
    'materializeProgressionChoices',
    'ProgressionChoiceDescriptions',
    'ProgressionFeatureMechanics',
    'ProgressionFeatureFinalization',
    'refreshProgressionFeatureMechanics',
    'LevelUpSpellSelectionModal',
    'ProgressionFeatureDescriptionSync',
]
leftovers = []
for target in (ROOT / 'src').rglob('*'):
    if not target.is_file() or target.suffix not in {'.ts', '.tsx', '.md'}:
        continue
    content = target.read_text()
    for token in forbidden_tokens:
        if token in content:
            leftovers.append(f'{target}: {token}')
if leftovers:
    raise SystemExit('Automatic progression references remain:\n' + '\n'.join(leftovers))
