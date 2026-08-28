from pathlib import Path

path = Path("src/features/session/SessionActionLog.tsx")
text = path.read_text()
old = '''    case "initiative.deathSaves.set": return `Atualizou os saves de morte de um personagem na iniciativa (${operation.successes} sucessos, ${operation.failures} falhas).`\n    case "initiative.reset": return `Limpou o combate atual.`\n'''
new = '''    case "initiative.deathSaves.set": return `Atualizou os saves de morte de um personagem na iniciativa (${operation.successes} sucessos, ${operation.failures} falhas).`\n    case "initiative.conditions.bulk": return operation.mode === "add" ? `Aplicou uma condição em ${operation.entryIds.length} participantes da iniciativa.` : `Removeu ${operation.conditionName || "uma condição"} de ${operation.entryIds.length} participantes da iniciativa.`\n    case "initiative.customAction.execute": {\n      const definition = customSystemDefinitions.find((entry) => entry.id === operation.systemId)\n      const action = definition?.actions?.find((entry) => entry.id === operation.actionId)\n      return `Executou ${action?.name ?? operation.actionId} em ${operation.entryIds.length} alvo${operation.entryIds.length === 1 ? "" : "s"} da iniciativa${definition ? ` — ${definition.name}` : ""}.`\n    }\n    case "initiative.reset": return `Limpou o combate atual.`\n'''
if old not in text:
    raise SystemExit("anchor not found: exact initiative log operations")
path.write_text(text.replace(old, new, 1))

path = Path("src/features/initiative/InitiativeTable.tsx")
text = path.read_text()
old = '''  onOpen,\n  onRename,\n  onCondition,\n'''
new = '''  onOpen,\n  onRename,\n  selectedEntryIds,\n  onSelectEntry,\n  onCondition,\n'''
if old not in text:
    raise SystemExit("anchor not found: table selection destructuring")
path.write_text(text.replace(old, new, 1))

trigger = Path("src/qaDeployTrigger.ts")
if trigger.exists():
    trigger.unlink()

print("initiative continuation applied")
