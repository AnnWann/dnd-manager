from pathlib import Path

path = Path("src/models/creatures/CreatureCombatRuntime.ts")
text = path.read_text()
old = '      type: "monster",\n'
new = '      type: "monstruosidade",\n'
if old not in text:
    raise SystemExit("synthetic creature type anchor not found")
path.write_text(text.replace(old, new, 1))
print("synthetic creature type fixed")
