from pathlib import Path

base = Path(".github/channel_divinity_alignment_base.py")
text = base.read_text()
text = text.replace(
    "'''      )\n\n  const magic = nextCharacter.get(\"magic\")'''",
    "'''    )\n\n  const magic = nextCharacter.get(\"magic\")'''",
)
try:
    exec(compile(text, str(base), "exec"))
finally:
    base.unlink(missing_ok=True)
