from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


path = Path("src/features/characters/abilities/abilityDialog.tsx")
text = path.read_text()
text = replace_once(
    text,
    '''  const requiresActivation = abilityRequiresActivation(draft)

  function updateUsageMaximum''',
    '''  const requiresActivation = abilityRequiresActivation(draft)
  const triggerInputValue =
    ABILITY_TRIGGER_OPTIONS.find(
      (option) => option.value === (draft.trigger ?? "always"),
    )?.label ?? draft.trigger ?? ""

  function updateUsageMaximum''',
    "trigger display value",
)
text = replace_once(
    text,
    '''              value={draft.trigger ?? "always"}
              placeholder="Ex.: Quando um aliado cair a 0 PV"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  trigger: event.target.value as Trigger,
                })
              }''',
    '''              value={triggerInputValue}
              placeholder="Ex.: Quando um aliado cair a 0 PV"
              onChange={(event) => {
                const preset = ABILITY_TRIGGER_OPTIONS.find(
                  (option) => option.label === event.target.value,
                )
                setDraft({
                  ...draft,
                  trigger: (preset?.value ?? event.target.value) as Trigger,
                })
              }}''',
    "localized trigger input",
)
text = replace_once(
    text,
    '''              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}''',
    '''              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.label} />
              ))}''',
    "localized trigger datalist",
)
path.write_text(text)

required = [
    "const triggerInputValue =",
    "option.label === event.target.value",
    "value={option.label}",
]
missing = [entry for entry in required if entry not in text]
if missing:
    raise SystemExit(f"localized custom trigger requirements missing: {missing}")
