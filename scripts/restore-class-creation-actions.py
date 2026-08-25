from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


integrated_path = Path("src/features/characters/creation/IntegratedCharacterCreationWizard.tsx")
integrated = integrated_path.read_text()
integrated = replace_once(
    integrated,
    '''          <section
            key={plan.className}
            className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
          >''',
    '''          <section
            key={plan.className}
            data-creation-class-name={String(plan.className)}
            data-creation-class-level={String(plan.level)}
            className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4"
          >''',
    "class section metadata",
)
integrated_path.write_text(integrated)

bridge_path = Path("src/features/characters/creation/bridges/CreationProgressionConfigurationBridge.tsx")
bridge = bridge_path.read_text()
bridge = replace_once(
    bridge,
    '''      for (const section of Array.from(main.querySelectorAll<HTMLElement>("section"))) {
        const heading = section.querySelector<HTMLElement>(":scope > div h2, :scope > h2")
        const parsedClass = parseClassHeading(heading?.textContent ?? "")
        if (parsedClass) {''',
    '''      for (const section of Array.from(main.querySelectorAll<HTMLElement>("section"))) {
        const heading = section.querySelector<HTMLElement>(":scope > div h2, :scope > h2")
        const datasetClassName = section.dataset.creationClassName as ClassName | undefined
        const datasetLevel = Number(section.dataset.creationClassLevel)
        const parsedClass =
          datasetClassName && Number.isFinite(datasetLevel) && datasetLevel > 0
            ? { className: datasetClassName, level: datasetLevel }
            : parseClassHeading(heading?.textContent ?? "")
        if (parsedClass) {''',
    "class bridge metadata read",
)
bridge = replace_once(
    bridge,
    '''function parseClassHeading(
  text: string,
): { className: ClassName; level: number } | undefined {
  const normalized = text.trim()
  for (const className of ALL_CLASS_NAMES) {
    const label = getClassProgression(className).label
    if (!normalized.startsWith(`${label} `)) continue
    const level = Number(normalized.slice(label.length).trim().match(/^\\d+/)?.[0])
    if (Number.isFinite(level) && level > 0) return { className, level }
  }
  return undefined
}''',
    '''function parseClassHeading(
  text: string,
): { className: ClassName; level: number } | undefined {
  const normalized = text.trim()
  for (const className of ALL_CLASS_NAMES) {
    const label = getClassProgression(className).label
    if (!normalized.startsWith(label)) continue
    const suffix = normalized.slice(label.length).trim()
    const level = Number(
      suffix.match(/^(?:—\\s*)?(?:nível\\s*)?(\\d+)/i)?.[1],
    )
    if (Number.isFinite(level) && level > 0) return { className, level }
  }
  return undefined
}''',
    "class heading parser",
)
bridge_path.write_text(bridge)
