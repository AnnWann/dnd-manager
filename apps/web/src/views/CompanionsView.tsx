import { FileImage, Users } from "lucide-react"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { projectCompanionPortraits } from "../shared/session-runtime/companionPortraits"

export function CompanionsView() {
  const runtime = useOptionalSessionRuntime()
  const config = runtime?.runtimeConfigSnapshot?.config
  const companions = config?.companionPortraits ?? projectCompanionPortraits(config?.creatureCompendium ?? [])
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-heading text-xl font-semibold text-textH">Acompanhantes</h1>
            <p className="mt-1 text-sm text-text">Quem acompanha o grupo. As fichas permanecem privadas.</p>
          </div>
        </div>
      </section>
      {companions.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {companions.map(companion => (
            <article key={companion.id} className="overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm">
              <div className="aspect-[16/9] overflow-hidden bg-bg-subtle">
                {companion.imageUrl ? <img src={companion.imageUrl} alt={companion.name} className="h-full w-full object-cover object-center" />
                  : <div className="flex h-full items-center justify-center"><FileImage className="h-10 w-10 text-textMuted" /></div>}
              </div>
              <h2 className="p-4 font-heading text-base font-semibold text-textH">{companion.name}</h2>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-bg p-10 text-center text-textMuted">
          Nenhum acompanhante apresentado. O mestre pode selecionar “Exibir em Acompanhantes do grupo” ao editar uma criatura no compêndio.
        </section>
      )}
    </div>
  )
}
