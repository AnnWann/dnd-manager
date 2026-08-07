from pathlib import Path

path = Path("src/models/characters/CharacterTemplate.ts")
text = path.read_text()

wrong_with_patch = '''  withPatch(patch: Partial<CharacterTemplateProps>): CharacterTemplate {
    const character = new CharacterTemplate({
      ...this.props,
      ...patch
    })
  }'''
correct_with_patch = '''  withPatch(patch: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({
      ...this.props,
      ...patch
    })
  }'''
if wrong_with_patch not in text:
    raise SystemExit("The expected incorrect withPatch replacement was not found.")
text = text.replace(wrong_with_patch, correct_with_patch, 1)

old_from_json = '''  static fromJSON(props: Partial<CharacterTemplateProps>): CharacterTemplate {
    return new CharacterTemplate({'''
new_from_json = '''  static fromJSON(props: Partial<CharacterTemplateProps>): CharacterTemplate {
    const character = new CharacterTemplate({'''
if old_from_json not in text:
    raise SystemExit("CharacterTemplate.fromJSON constructor was not found.")
text = text.replace(old_from_json, new_from_json, 1)

path.write_text(text)
