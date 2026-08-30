from pathlib import Path
import runpy

path = Path('.github/apply_ability_roll_affinity_fixes.py')
text = path.read_text()
old = '''    ''' + "'''            <BonusesFields\n              bonuses={draft.bonuses ?? {}}\n              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}\n              description=\"Aplique modificadores enquanto os benefícios desta habilidade estiverem ativos.\"\n            />'''" + ''',
    ''' + "'''            <BonusesFields\n              bonuses={draft.bonuses ?? {}}\n              character={character}\n              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}\n              description=\"Aplique modificadores enquanto os benefícios desta habilidade estiverem ativos.\"\n            />\n            <AbilityBonusRollEditor\n              bonuses={draft.bonuses ?? {}}\n              character={character}\n              onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}\n            />'''" + ''','''
new = '''    ''' + "'''                <BonusesFields\n                  bonuses={draft.bonuses ?? {}}\n                  onChange={(bonuses) => setDraft({ ...draft, bonuses })}\n                />'''" + ''',
    ''' + "'''                <BonusesFields\n                  bonuses={draft.bonuses ?? {}}\n                  character={character}\n                  onChange={(bonuses) => setDraft({ ...draft, bonuses })}\n                />\n                <div className=\"mt-3\">\n                  <AbilityBonusRollEditor\n                    bonuses={draft.bonuses ?? {}}\n                    character={character}\n                    onChange={(bonuses) => setDraft({ ...draft, bonuses })}\n                  />\n                </div>'''" + ''','''
if old not in text:
    raise SystemExit('ability dialog patch source anchor not found')
path.write_text(text.replace(old, new, 1))
runpy.run_path(str(path), run_name='__main__')
