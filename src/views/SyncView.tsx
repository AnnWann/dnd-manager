import { useEffect, useRef, useState } from "react"

import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { useCustomSystemsContext } from "../contexts/customSystemsContext"
import { useSyncContext } from "../contexts/syncContext"
import { confirmAndResetLocalAppData } from "../lib/resetLocalAppData"

export function SyncView() {
  const {
    syncKey,
    setSyncKey,
    userRole,
    setUserRole,
    userKey,
    setUserKey,
    canSync,
    pullFromServer,
    syncStatus,
    exportState,
    importState,
  } = useSyncContext()
  const { definitions, saveDefinitions } = useCustomSystemsContext()
  const [syncKeyDraft, setSyncKeyDraft] = useState(syncKey)
  const [backupMessage, setBackupMessage] = useState("")
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => setSyncKeyDraft(syncKey), [syncKey])

  function loadSession() {
    const nextKey = syncKeyDraft.trim()
    if (nextKey.length < 12) return
    if (nextKey !== syncKey) {
      setSyncKey(nextKey)
      return
    }
    void pullFromServer()
  }

  function exportBackup() {
    const backup = {
      schema: "dndmm-session-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      syncKey,
      state: exportState(),
      customSystems: definitions,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `dndmm-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setBackupMessage("Backup exportado.")
  }

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        schema?: string
        state?: unknown
        customSystems?: unknown
      }
      if (parsed.schema !== "dndmm-session-backup" || !parsed.state) {
        throw new Error("Arquivo de backup inválido.")
      }
      if (!window.confirm("Importar este backup substituirá o estado principal da sessão atual. Continuar?")) return
      importState(parsed.state)
      if (Array.isArray(parsed.customSystems)) saveDefinitions(parsed.customSystems)
      setBackupMessage("Backup importado e marcado para sincronização.")
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Falha ao importar backup.")
    } finally {
      if (importRef.current) importRef.current.value = ""
    }
  }

  const draftCanSync = syncKeyDraft.trim().length >= 12

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Sincronização (grupo)</div>
          <div className="mt-1 text-xs text-text">
            Use a senha da sessão, escolha seu papel e defina o nome de Jogador que identifica seu usuário.
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                className="h-9 text-xs"
                value={syncKeyDraft}
                onChange={(e) => setSyncKeyDraft(e.target.value)}
                placeholder="ex: minha-senha-compartilhada"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={loadSession}
                disabled={!draftCanSync}
                title={!draftCanSync ? "A senha precisa ter pelo menos 12 caracteres" : "Trocar/carregar sessão"}
              >
                {syncKeyDraft.trim() !== syncKey ? "Trocar sessão" : "Carregar"}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-[11px] leading-5 text-textMuted">
              Digitar uma nova chave não troca mais a sessão imediatamente. A troca só ocorre ao clicar em <strong>Trocar sessão</strong>, e cada chave mantém uma cópia local separada.
            </div>

            <label className="flex items-center gap-2 text-xs text-text">
              <span className="min-w-16 font-medium text-textH">Papel</span>
              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as "master" | "player")}
              >
                <option value="player">Player</option>
                <option value="master">Master</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-text">
              <span className="min-w-16 font-medium text-textH">Nome do Jogador</span>
              <Input className="h-9 text-xs" value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder="ex: nome-do-player" />
            </label>
          </div>

          <div className="mt-2 text-xs text-text">
            Status:{" "}
            <span className="font-mono">
              {syncStatus.kind === "idle" ? "local" : syncStatus.kind === "loading" ? "carregando…" : syncStatus.kind === "saving" ? "salvando…" : syncStatus.kind === "synced" ? "sincronizado" : "erro"}
            </span>
            {syncStatus.kind === "error" ? <div className="mt-1 text-[11px] text-text">{syncStatus.message}</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Backup da sessão</div>
          <div className="mt-1 text-xs leading-5 text-text">
            Exporta personagens, inventários, chão, magias homebrew, missões, metadados de sincronização e sistemas personalizados para um único JSON.
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={exportBackup}>Exportar sessão</Button>
            <Button variant="secondary" onClick={() => importRef.current?.click()}>Importar sessão</Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importBackup(file)
              }}
            />
          </div>
          {backupMessage ? <div className="mt-2 text-xs text-textMuted">{backupMessage}</div> : null}
          <div className="mt-3 rounded-xl border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
            Antes de trocar de sessão ou tentar recuperar dados, exporte a sessão atual. O arquivo fica independente do servidor e pode ser reimportado depois.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Recuperação deste dispositivo</div>
          <div className="mt-1 text-xs leading-5 text-text">
            Use isto quando o app ficar preso em um estado antigo, trocar de usuário incorretamente ou não conseguir mais sincronizar.
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
            A limpeza remove apenas os dados locais deste navegador: estado salvo, chave de sincronização, nome do jogador, papel, cache e registro do aplicativo. O conteúdo remoto da sessão não é apagado.
          </div>
          <Button className="mt-3 w-full sm:w-auto" variant="secondary" onClick={confirmAndResetLocalAppData}>
            Limpar tudo neste dispositivo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}