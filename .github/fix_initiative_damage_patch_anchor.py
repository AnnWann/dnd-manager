from pathlib import Path

path = Path('.github/patch_initiative_damage_authority.py')
text = path.read_text()
old = "anchor = '''/**\n * Inserts reinforcements without re-sorting existing combatants.\n'''"
new = "anchor = '''function addEntriesDuringCombat('''"
if old not in text:
    raise SystemExit('damage helper anchor source not found')
path.write_text(text.replace(old, new, 1))
print('initiative damage helper anchor fixed')
