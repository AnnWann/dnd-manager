from pathlib import Path

ROOT = Path('.')
old_path = ROOT / 'session-server/src/routes/characters/sheet/hpState.ts'
new_path = ROOT / 'session-server/src/routes/characters/sheet/characterState.ts'

source = old_path.read_text()

# Introduce accurate canonical names while retaining source-compatible aliases.
source = source.replace(
    'export const MAX_HP_LOG_RECORDS = 100;\n\nexport type HpApplyResult =\n  | { ok: true; next: SessionHpState; record: SessionHpLogRecord }\n  | { ok: false; code: string; message: string };',
    '''export const MAX_CHARACTER_STATE_LOG_RECORDS = 100;\n/** @deprecated Use MAX_CHARACTER_STATE_LOG_RECORDS. */\nexport const MAX_HP_LOG_RECORDS = MAX_CHARACTER_STATE_LOG_RECORDS;\n\nexport type CharacterStateApplyResult =\n  | { ok: true; next: SessionHpState; record: SessionHpLogRecord }\n  | { ok: false; code: string; message: string };\n/** @deprecated Use CharacterStateApplyResult. */\nexport type HpApplyResult = CharacterStateApplyResult;'''
)
source = source.replace(
    'export function normalizeHpSeed(state: SessionHpSeed): SessionHpState {',
    'export function normalizeCharacterStateSeed(state: SessionHpSeed): SessionHpState {'
)
source = source.replace(
    'export function applyHpOperation(\n  previous: SessionHpState,\n  operation: SessionAuthoritativeOperation,\n  connection: SessionConnection,\n): HpApplyResult {',
    'export function applyCharacterStateOperation(\n  previous: SessionHpState,\n  operation: SessionAuthoritativeOperation,\n  connection: SessionConnection,\n): CharacterStateApplyResult {'
)
source = source.replace(
    'export function applyHpUndo(\n  current: SessionHpState,\n  source: SessionHpLogRecord,\n  connection: SessionConnection,\n): HpApplyResult {',
    'export function applyCharacterStateUndo(\n  current: SessionHpState,\n  source: SessionHpLogRecord,\n  connection: SessionConnection,\n): CharacterStateApplyResult {'
)

# Compatibility exports intentionally stay in the canonical module. This lets
# old deployments/imports coexist with the new naming during rollout.
alias_anchor = '\nfunction createReverseOperation(\n'
aliases = '''\n/** @deprecated Use normalizeCharacterStateSeed. */\nexport const normalizeHpSeed = normalizeCharacterStateSeed;\n/** @deprecated Use applyCharacterStateOperation. */\nexport const applyHpOperation = applyCharacterStateOperation;\n/** @deprecated Use applyCharacterStateUndo. */\nexport const applyHpUndo = applyCharacterStateUndo;\n\n'''
if alias_anchor not in source:
    raise SystemExit('Could not find compatibility alias anchor')
source = source.replace(alias_anchor, aliases + 'function createReverseOperation(\n', 1)

new_path.write_text(source)

# Keep the old module path alive. No existing import has to change atomically.
old_path.write_text('''/**\n * @deprecated The authoritative sheet state outgrew HP.\n * Import from "./characterState" in new code.\n *\n * This compatibility shim intentionally remains during the staged rename so\n * already-deployed clients/workers and older internal imports keep compiling.\n */\nexport * from "./characterState";\n''')

# Migrate server source imports to the canonical module path. The compatibility
# shim means any missed reference is harmless, but new server code no longer
# reinforces the misleading name.
for path in (ROOT / 'session-server/src').rglob('*.ts'):
    if path in {old_path, new_path}:
        continue
    text = path.read_text()
    updated = text.replace('/hpState"', '/characterState"').replace('/hpState\';', '/characterState\';')
    updated = updated.replace('./hpState"', './characterState"').replace("./hpState'", "./characterState'")
    if updated != text:
        path.write_text(updated)

# Prefer the new function/constant names inside session-server only. Aliases are
# kept exported so this is not an all-or-nothing migration.
renames = {
    'MAX_HP_LOG_RECORDS': 'MAX_CHARACTER_STATE_LOG_RECORDS',
    'normalizeHpSeed': 'normalizeCharacterStateSeed',
    'applyHpOperation': 'applyCharacterStateOperation',
    'applyHpUndo': 'applyCharacterStateUndo',
}
for path in (ROOT / 'session-server/src').rglob('*.ts'):
    if path in {old_path, new_path}:
        continue
    text = path.read_text()
    updated = text
    for old, new in renames.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated)

print('safe character-state rename applied')
