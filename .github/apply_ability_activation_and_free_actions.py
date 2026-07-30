from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


# Expand ability kinds and allow arbitrary written triggers.
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    "export type AbilityKind = 'active' | 'passive'",
    "export type AbilityKind = 'active' | 'passive' | 'feature'",
    "ability characteristic kind",
)
if "export type AbilityTriggerPreset =" not in text:
    start = text.index("export type Trigger =")
    end_marker = "  | 'always'"
    end = text.index(end_marker, start) + len(end_marker)
    preset_block = text[start:end].replace(
        "export type Trigger =",
        "export type AbilityTriggerPreset =",
        1,
    )
    text = (
        text[:start]
        + preset_block
        + "\n\nexport type Trigger = AbilityTriggerPreset | (string & {})"
        + text[end:]
    )
write(path, text)


# Add Característica to the shared kind options.
path = "src/features/characters/abilities/abilityOptions.ts"
text = read(path)
text = replace_once(
    text,
    '  { value: "passive", label: "Passiva" },',
    '  { value: "passive", label: "Passiva" },\n  { value: "feature", label: "Característica" },',
    "characteristic kind option",
)
write(path, text)


# Make the trigger field free-form while retaining preset suggestions.
path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    '                disabled={draft.kind === "passive"}',
    '                disabled={draft.kind !== "active"}',
    "disable action for non-active abilities",
)
old_trigger = '''          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>
            <Select
              value={draft.trigger ?? "always"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  trigger: event.target.value as Trigger,
                })
              }
            >
              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>'''
new_trigger = '''          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>
            <Input
              list="ability-trigger-suggestions"
              value={draft.trigger ?? "always"}
              placeholder="Ex.: Quando um aliado cair a 0 PV"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  trigger: event.target.value as Trigger,
                })
              }
            />
            <datalist id="ability-trigger-suggestions">
              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
            <span className="text-[10px] text-textMuted">
              Escolha uma sugestão ou escreva qualquer condição de acionamento.
            </span>
          </label>'''
text = replace_once(text, old_trigger, new_trigger, "free-form trigger input")
old_help = '''          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "passive"
                ? "Esta passiva possui um gatilho. Seus bônus, proficiências e magias só ficam ativos depois de Acionar."
                : "Habilidades ativas só aplicam seus bônus, proficiências e magias depois de Usar, mesmo sem contador de usos."
              : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>'''
new_help = '''          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "active"
                ? "Habilidades ativas só aplicam seus bônus, proficiências e magias depois de Usar, mesmo sem contador de usos."
                : `${draft.kind === "feature" ? "Esta característica" : "Esta passiva"} possui um gatilho. Seus bônus, proficiências e magias só ficam ativos depois de Acionar.`
              : draft.kind === "feature"
                ? "Esta característica não possui condição e concede seus benefícios permanentemente. Ela não aparece na seção de ações."
                : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>'''
text = replace_once(text, old_help, new_help, "characteristic activation explanation")
write(path, text)


# Display custom trigger text and the Característica label in detailed cards.
path = "src/features/characters/abilities/abilityCard.tsx"
text = read(path)
text = replace_once(
    text,
    '  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"',
    '  const kindLabel = ability.kind === "passive"\n    ? "Passiva"\n    : ability.kind === "feature"\n      ? "Característica"\n      : "Ativa"',
    "detailed characteristic label",
)
old_summary = '''    return ability.kind === "passive"
      ? `${kindLabel} • ${ABILITY_TRIGGER_OPTIONS.find((option) => option.value === (ability.trigger ?? "always"))?.label ?? "Sempre"}`
      : `${kindLabel} • ${ABILITY_ACTION_OPTIONS.find((option) => option.value === (ability.actionKind ?? "action"))?.label ?? "Ação"}`'''
new_summary = '''    return (ability.kind ?? "active") !== "active"
      ? `${kindLabel} • ${ABILITY_TRIGGER_OPTIONS.find((option) => option.value === (ability.trigger ?? "always"))?.label ?? ability.trigger ?? "Sempre"}`
      : `${kindLabel} • ${ABILITY_ACTION_OPTIONS.find((option) => option.value === (ability.actionKind ?? "action"))?.label ?? "Ação"}`'''
text = replace_once(text, old_summary, new_summary, "custom trigger card summary")
text = replace_once(
    text,
    '{(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}',
    '{(ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}',
    "detailed characteristic action label",
)
write(path, text)


# Display Característica correctly in compact cards.
path = "src/features/characters/abilities/compactAbilityCard.tsx"
text = read(path)
text = replace_once(
    text,
    '  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"',
    '  const kindLabel = ability.kind === "passive"\n    ? "Passiva"\n    : ability.kind === "feature"\n      ? "Característica"\n      : "Ativa"',
    "compact characteristic label",
)
text = replace_once(
    text,
    '{(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}',
    '{(ability.kind ?? "active") === "active" ? "Usar" : "Acionar"}',
    "compact characteristic action label",
)
write(path, text)


# Add a dedicated ability-tab filter for characteristics.
path = "src/features/characters/abilities/characterAbilities.tsx"
text = read(path)
text = replace_once(
    text,
    'type AbilityKindFilter = "all" | "active" | "passive"',
    'type AbilityKindFilter = "all" | "active" | "passive" | "feature"',
    "characteristic filter type",
)
text = replace_once(
    text,
    '              <option value="passive">Somente passivas</option>',
    '              <option value="passive">Somente passivas</option>\n              <option value="feature">Somente características</option>',
    "characteristic filter option",
)
write(path, text)


# Normalize written triggers before persistence.
path = "src/lib/textNormalization.ts"
text = read(path)
text = replace_once(
    text,
    '    description: trimOptionalMultiline(ability.description),',
    '    description: trimOptionalMultiline(ability.description),\n    trigger: trimOptionalSingleLine(ability.trigger),',
    "normalize custom trigger",
)
write(path, text)


# Structural checks: characteristics must remain outside both action groups.
minimal_actions = read("src/features/characters/characterSheet/minimalCharacterActions.tsx")
required = [
    '(ability.kind ?? "active") === "active"',
    '(ability.kind ?? "active") === "passive"',
]
missing = [entry for entry in required if entry not in minimal_actions]
if missing:
    raise SystemExit(f"minimal action exclusions missing: {missing}")

for file_path, required_text in {
    "src/models/abilities/Ability.ts": ["| 'feature'", "export type Trigger = AbilityTriggerPreset | (string & {})"],
    "src/features/characters/abilities/abilityDialog.tsx": ["ability-trigger-suggestions", "Esta característica"],
    "src/features/characters/abilities/abilityOptions.ts": ['value: "feature"'],
    "src/features/characters/abilities/characterAbilities.tsx": ['value="feature"'],
}.items():
    current = read(file_path)
    absent = [entry for entry in required_text if entry not in current]
    if absent:
        raise SystemExit(f"{file_path} missing {absent}")
