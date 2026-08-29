from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

path = "src/features/characters/characterSheet/masterConcentrationAlerts.tsx"
text = read(path)
text = replace_once(
    text,
    '  const seenOperationIds = useRef(new Set<string>())\n  const initialized = useRef(false)\n  const [alerts, setAlerts] = useState<ConcentrationAlert[]>([])\n\n  useEffect(() => {\n    if (!initialized.current) {\n      for (const record of operationLog) seenOperationIds.current.add(record.id)\n      for (const record of logRuntime?.hpLog ?? []) seenOperationIds.current.add(record.id)\n      initialized.current = true\n      return\n    }\n\n',
    '  const seenOperationIds = useRef(new Set<string>())\n  const mountedAt = useRef(Date.now())\n  const [alerts, setAlerts] = useState<ConcentrationAlert[]>([])\n\n  useEffect(() => {\n',
    "replace initialization with mount cutoff",
)
text = replace_once(
    text,
    '      if (seenOperationIds.current.has(record.id)) continue\n      seenOperationIds.current.add(record.id)\n\n      if (!canAssignOwners || ("undoneAt" in record && record.undoneAt)) continue\n',
    '      if (seenOperationIds.current.has(record.id)) continue\n      seenOperationIds.current.add(record.id)\n\n      const createdAt = new Date(record.createdAt).getTime()\n      if (!Number.isFinite(createdAt) || createdAt <= mountedAt.current) continue\n      if (!canAssignOwners || ("undoneAt" in record && record.undoneAt)) continue\n',
    "skip historical records",
)
write(path, text)

path = "src/views/InitiativeView.tsx"
text = read(path)
text = replace_once(
    text,
    '  const { visibleCharacters } = useCharacterContext()\n  const { creatures } = useCreatureCompendium()\n  const { userRole } = useSyncContext()\n  const runtime = useOptionalSessionRuntime()\n',
    '  const { visibleCharacters } = useCharacterContext()\n  const { creatures: localCreatures } = useCreatureCompendium()\n  const { userRole } = useSyncContext()\n  const runtime = useOptionalSessionRuntime()\n  const creatures = runtime?.runtimeConfigSnapshot\n    ? runtime.runtimeConfigSnapshot.config.creatureCompendium\n    : localCreatures\n',
    "use authoritative creature compendium",
)
write(path, text)

print("concentration and initiative compendium fixes applied")
