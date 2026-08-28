from pathlib import Path

path = Path("src/features/session/SessionActionLog.tsx")
text = path.read_text()
old = '''    case "initiative.viewMode.set": return `Alterou a visualização da iniciativa para ${operation.viewMode === "cards" ? "cartões" : "tabela"}.`\n    case "initiative.reset": return `Limpou o combate atual.`\n'''
new = '''    case "initiative.viewMode.set": return `Alterou a visualização da iniciativa para ${operation.viewMode === "cards" ? "cartões" : "tabela"}.`\n    case "initiative.settings.update": return `Alterou as configurações de saves de morte da iniciativa.`\n    case "initiative.deathSaves.set": return `Atualizou os saves de morte de um personagem na iniciativa (${operation.successes} sucessos, ${operation.failures} falhas).`\n    case "initiative.reset": return `Limpou o combate atual.`\n'''
if old not in text:
    raise SystemExit("initiative log anchor not found")
path.write_text(text.replace(old, new, 1))
print("initiative log cases applied")
