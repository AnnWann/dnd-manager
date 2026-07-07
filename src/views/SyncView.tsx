import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
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
  } = useSyncContext()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Sincronização (grupo)
          </div>
          <div className="mt-1 text-xs text-text">
            Use a senha da sessão, escolha seu papel e defina o nome de Jogador que identifica seu usuário.
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                className="h-9 text-xs"
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                placeholder="ex: minha-senha-compartilhada"
              />

              <Button
                size="sm"
                variant="primary"
                onClick={() => void pullFromServer()}
                disabled={!canSync}
                title={
                  !canSync
                    ? "A senha precisa ter pelo menos 12 caracteres"
                    : "Carregar do servidor"
                }
              >
                Carregar
              </Button>
            </div>

            <label className="flex items-center gap-2 text-xs text-text">
              <span className="min-w-16 font-medium text-textH">Papel</span>
              <select
                className="h-9 rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={userRole}
                onChange={(e) =>
                  setUserRole(e.target.value as "master" | "player")
                }
              >
                <option value="player">Player</option>
                <option value="master">Master</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-text">
              <span className="min-w-16 font-medium text-textH">
                Nome do Jogador
              </span>
              <Input
                className="h-9 text-xs"
                value={userKey}
                onChange={(e) => setUserKey(e.target.value)}
                placeholder="ex: nome-do-player"
              />
            </label>
          </div>

          <div className="mt-2 text-xs text-text">
            Status:{" "}
            <span className="font-mono">
              {syncStatus.kind === "idle"
                ? "local"
                : syncStatus.kind === "loading"
                  ? "carregando…"
                  : syncStatus.kind === "saving"
                    ? "salvando…"
                    : syncStatus.kind === "synced"
                      ? "sincronizado"
                      : "erro"}
            </span>

            {syncStatus.kind === "error" ? (
              <div className="mt-1 text-[11px] text-text">
                {syncStatus.message}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Recuperação deste dispositivo
          </div>
          <div className="mt-1 text-xs leading-5 text-text">
            Use isto quando o app ficar preso em um estado antigo, trocar de usuário incorretamente ou não conseguir mais sincronizar.
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
            A limpeza remove apenas os dados locais deste navegador: estado salvo,
            chave de sincronização, nome do jogador, papel, cache e registro do
            aplicativo. O conteúdo remoto da sessão não é apagado.
          </div>
          <Button
            className="mt-3 w-full sm:w-auto"
            variant="secondary"
            onClick={confirmAndResetLocalAppData}
          >
            Limpar tudo neste dispositivo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
