from pathlib import Path

path = Path('.github/patch_session_log_actor_names.py')
text = path.read_text()
old = '''text = replace_once(
    text,
    '    records: page.records.map(toClientLogRecord),\\n',
    '    records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, sockets))),\\n',
    "broadcast old record names",
)
'''
new = '''text = replace_once(
    text,
    '    records: page.records.map(toClientLogRecord),\\n',
    '    records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, [socket]))),\\n',
    "send page old record names",
)
text = replace_once(
    text,
    '    records: page.records.map(toClientLogRecord),\\n',
    '    records: page.records.map((record) => toClientLogRecord(withResolvedActorName(record, sockets))),\\n',
    "broadcast old record names",
)
'''
if old not in text:
    raise SystemExit('actor name patch target not found')
path.write_text(text.replace(old, new, 1))
print('actor name patch integration fixed')
