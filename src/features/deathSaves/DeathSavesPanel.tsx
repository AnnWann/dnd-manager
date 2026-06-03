import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import type { Character } from '../models/types'

type Props = {
  character: Character
  canEdit: boolean
  onChange: (characterId: string, updater: (current: Character) => Character) => void
}

export function DeathSavesPanel({ character, canEdit, onChange }: Props) {
  const deathSaves = character.deathSaves ?? { successes: 0, failures: 0 }

  function setNext(next: { successes: number; failures: number }) {
    onChange(character.id, (current) => ({
      ...current,
      deathSaves: next,
    }))
  }

  function step(kind: 'successes' | 'failures', delta: 1 | -1) {
    const nextValue = Math.max(0, Math.min(3, deathSaves[kind] + delta))
    setNext({
      ...deathSaves,
      [kind]: nextValue,
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Salvaguardas de Morte</div>
        <div className="mt-1 text-xs text-text">Registre sucessos, falhas e reinicie o estado quando a cena terminar.</div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wide text-text">Sucessos</div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <button
                  key={`success-${index}`}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => step('successes', deathSaves.successes > index ? -1 : 1)}
                  className={
                    deathSaves.successes > index
                      ? 'flex h-10 w-10 items-center justify-center rounded-full border border-green-500 bg-green-500 text-sm font-bold text-white'
                      : 'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg text-sm font-bold text-text'
                  }
                >
                  ✓
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-xs uppercase tracking-wide text-text">Falhas</div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <button
                  key={`failure-${index}`}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => step('failures', deathSaves.failures > index ? -1 : 1)}
                  className={
                    deathSaves.failures > index
                      ? 'flex h-10 w-10 items-center justify-center rounded-full border border-red-500 bg-red-500 text-sm font-bold text-white'
                      : 'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg text-sm font-bold text-text'
                  }
                >
                  ✕
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-text">
            <span>Sucessos: {deathSaves.successes}/3</span>
            <span>Falhas: {deathSaves.failures}/3</span>
            {canEdit ? (
              <Button size="sm" variant="secondary" onClick={() => setNext({ successes: 0, failures: 0 })}>
                Reiniciar
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}