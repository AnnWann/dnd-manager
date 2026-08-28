from pathlib import Path

path = Path('.github/patch_initiative_damage_authority.py')
text = path.read_text()
old = '          patch.armorClassOverride = cleanNumber(patch.armorClass - (effective - base));\n'
new = '          patch.armorClassOverride = patch.armorClass - (effective - base);\n'
if old not in text:
    raise SystemExit('cleanNumber patch source not found')
path.write_text(text.replace(old, new, 1))
print('initiative damage typecheck fix applied')
