import type { ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'synced' }
  | { kind: 'error'; message: string }

export function SyncView(props: {
  syncKey: string
  setSyncKey: (value: string) => void
  canSync: boolean
  pullFromServer: () => Promise<void> | void
  syncStatus: SyncStatus
  footer?: ReactNode
}) {
  const { syncKey, setSyncKey, canSync, pullFromServer, syncStatus, footer } = props

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">Sincronização (grupo)</div>
          <div className="mt-1 text-xs text-text">Use uma chave secreta compartilhada (mín. 12 caracteres).</div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              className="h-9 text-xs"
              value={syncKey}
              onChange={(e) => setSyncKey(e.target.value)}
              placeholder="ex: minha-chave-super-secreta"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={() => void pullFromServer()}
              disabled={!canSync}
              title={!canSync ? 'A chave precisa ter pelo menos 12 caracteres' : 'Carregar do servidor'}
            >
              Carregar
            </Button>
          </div>

          <div className="mt-2 text-xs text-text">
            Status:{' '}
            <span className="font-mono">
              {syncStatus.kind === 'idle'
                ? 'local'
                : syncStatus.kind === 'loading'
                  ? 'carregando…'
                  : syncStatus.kind === 'saving'
                    ? 'salvando…'
                    : syncStatus.kind === 'synced'
                      ? 'sincronizado'
                      : 'erro'}
            </span>
            {syncStatus.kind === 'error' ? (
              <div className="mt-1 text-[11px] text-text">{syncStatus.message}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {footer}
    </div>
  )
}
