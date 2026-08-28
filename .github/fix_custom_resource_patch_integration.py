from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# Preserve the resource lookup runtime guard, but tell TypeScript the captured
# callback value is narrowed after that guard. The value is never dereferenced
# before `if (!resource || !resourceState) return null`.
path = "src/features/characters/customSystems/CustomSystemsTab.tsx"
text = read(path)
text = replace_once(
    text,
    "const resource = definition.resources.find((entry) => entry.id === resourceId)\n",
    "const resource = definition.resources.find((entry) => entry.id === resourceId)!\n",
    "custom resource definition narrowing",
)
write(path, text)


# Session log updates now live in their own context so receiving a timeline
# message does not invalidate every character-sheet consumer.
path = "src/features/characters/characterSheet/masterConcentrationAlerts.tsx"
text = read(path)
text = replace_once(
    text,
    'import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"\n',
    'import {\n  useOptionalSessionRuntime,\n  useOptionalSessionRuntimeLog,\n} from "../../session-runtime/useSessionRuntime"\n',
    "concentration log hook import",
)
text = replace_once(
    text,
    "  const runtime = useOptionalSessionRuntime()\n",
    "  const runtime = useOptionalSessionRuntime()\n  const logRuntime = useOptionalSessionRuntimeLog()\n",
    "concentration log hook",
)
text = replace_once(
    text,
    "      for (const record of runtime?.hpLog ?? []) seenOperationIds.current.add(record.id)\n",
    "      for (const record of logRuntime?.hpLog ?? []) seenOperationIds.current.add(record.id)\n",
    "concentration initial session log",
)
text = replace_once(
    text,
    "    const records = runtime\n      ? runtime.hpLog\n      : operationLog\n",
    "    const records = runtime\n      ? logRuntime?.hpLog ?? []\n      : operationLog\n",
    "concentration incoming session log",
)
text = replace_once(
    text,
    "  }, [canAssignOwners, operationLog, runtime, visibleCharacters])\n",
    "  }, [canAssignOwners, logRuntime, operationLog, runtime, visibleCharacters])\n",
    "concentration effect dependencies",
)
write(path, text)


path = "src/views/dev/SessionRuntimeDevView.tsx"
text = read(path)
text = replace_once(
    text,
    'import { useSessionRuntime } from "../../features/session-runtime/useSessionRuntime"\n',
    'import {\n  useSessionRuntime,\n  useSessionRuntimeLog,\n} from "../../features/session-runtime/useSessionRuntime"\n',
    "dev log hook import",
)
text = replace_once(
    text,
    "  const runtime = useSessionRuntime()\n",
    "  const runtime = useSessionRuntime()\n  const logRuntime = useSessionRuntimeLog()\n",
    "dev log hook",
)
text = text.replace("runtime.hpLog", "logRuntime.hpLog")
text = text.replace("runtime.undoLog", "logRuntime.undoLog")
write(path, text)

print("performance patch integration fixes applied")
