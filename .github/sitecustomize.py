from pathlib import Path

path = Path("src/features/characters/creation/characterCreationWizardV4.tsx")
text = path.read_text()
old = '''               onSelectCustom={selectCustomRace}
               onChange={setRace}'''
new = '''               onSelectCustom={selectCustomRace}
               bonusPattern={customRaceBonusPattern}
               onBonusPatternChange={changeCustomRaceBonusPattern}
               onChange={setRace}'''
if new not in text:
    if old not in text:
        old = '''              onSelectCustom={selectCustomRace}
              onChange={setRace}'''
        new = '''              onSelectCustom={selectCustomRace}
              bonusPattern={customRaceBonusPattern}
              onBonusPatternChange={changeCustomRaceBonusPattern}
              onChange={setRace}'''
    if old in text:
        text = text.replace(old, new, 1)
path.write_text(text)

# Remove this tracked bootstrap from the implementation commit.
Path(__file__).unlink(missing_ok=True)
