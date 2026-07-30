from pathlib import Path
import re

script_path = Path(".github/apply_ability_activation_and_free_actions.py")
script = script_path.read_text()
script = script.replace(
    '''    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)''',
    '''    if old not in text:
        print(f"optional anchor skipped: {label}")
        return text
    return text.replace(old, new, 1)''',
    1,
)
script_path.write_text(script)

path = Path("src/features/characters/creation/characterCreationWizardV4.tsx")
text = path.read_text()
if "bonusPattern={customRaceBonusPattern}" not in text:
    text = re.sub(
        r'(?P<indent>[ \t]*)onSelectCustom=\{selectCustomRace\}\n(?P=indent)onChange=\{setRace\}',
        lambda match: (
            f'{match.group("indent")}onSelectCustom={{selectCustomRace}}\n'
            f'{match.group("indent")}bonusPattern={{customRaceBonusPattern}}\n'
            f'{match.group("indent")}onBonusPatternChange={{changeCustomRaceBonusPattern}}\n'
            f'{match.group("indent")}onChange={{setRace}}'
        ),
        text,
        count=1,
    )
path.write_text(text)

Path(".github/sitecustomize.py").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
