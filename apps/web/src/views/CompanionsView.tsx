import { useState } from "react"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Modal } from "../components/ui/Modal"
import { saveSessionCompanionVisibility } from "../features/creatures/sessionCompanions"
import { FileImage, Plus, Users, X } from "lucide-react"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { projectCompanionPortraits } from "../shared/session-runtime/companionPortraits"

export function CompanionsView() {
  const runtime = useOptionalSessionRuntime()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const isMaster = runtime?.role === "MASTER"
  const canEdit = isMaster && runtime.status === "connected"
  const config = runtime?.runtimeConfigSnapshot?.config
  const companions = config?.companionPortraits ?? projectCompanionPortraits(config?.creatureCompendium ?? [])
  const candidates = (config?.creatureCompendium ?? []).filter(creature =>
    !creature.showInCompanions && creature.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")),
  )

  async function setVisible(creatureId: string, visible: boolean) {
    if (!runtime || runtime.role !== "MASTER" || runtime.status !== "connected" || saving) return
    setSaving(true)
    setError("")
    try {
      const snapshot = await saveSessionCompanionVisibility(runtime.sessionId, creatureId, visible, (config?.spells ?? []).map(spell => spell.index))
      if (!runtime.publishRuntimeConfig(snapshot)) throw new Error("Alteração salva, mas não foi possível atualizar a sessão. Reconecte e tente novamente.")
      setAdding(false)
      setQuery("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar os acompanhantes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Users className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-heading text-xl font-semibold text-textH">Acompanhantes</h1>
            <p className="mt-1 text-sm text-text">Quem acompanha o grupo. As fichas permanecem privadas.</p>
          </div>
          {isMaster ? <Button className="ml-auto" disabled={!canEdit || saving || !config} onClick={() => { setError(""); setAdding(true) }}>
            <Plus className="h-4 w-4" /> Adicionar acompanhante
          </Button> : null}
        </div>
        {isMaster && !canEdit ? <p className="mt-2 text-sm text-textMuted">Conecte-se à sessão para alterar os acompanhantes.</p> : null}
      </section>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {companions.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {companions.map(companion => (
            <article key={companion.id} className="overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm">
              <div className="aspect-[16/9] overflow-hidden bg-bg-subtle">
                {companion.imageUrl ? <img src={companion.imageUrl} alt={companion.name} className="h-full w-full object-cover object-center" />
                  : <div className="flex h-full items-center justify-center"><FileImage className="h-10 w-10 text-textMuted" /></div>}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <h2 className="font-heading text-base font-semibold text-textH">{companion.name}</h2>
                {isMaster ? <Button variant="ghost" size="sm" aria-label={`Remover ${companion.name} dos acompanhantes`} disabled={!canEdit || saving} onClick={() => void setVisible(companion.id, false)}><X className="h-4 w-4" /></Button> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-bg p-10 text-center text-textMuted">
          Nenhum acompanhante apresentado.{isMaster ? " Use Adicionar acompanhante para escolher uma criatura." : " O mestre pode adicionar acompanhantes ao grupo."}
        </section>
      )}
      {adding && isMaster ? <Modal title="Adicionar acompanhante" onClose={() => { if (!saving) setAdding(false) }}>
        <div className="grid gap-3">
          <p className="text-sm text-textMuted">Escolha uma criatura do compêndio da campanha. Os jogadores verão apenas seu nome e imagem.</p>
          <Input aria-label="Buscar criatura" placeholder="Buscar criatura pelo nome…" value={query} onChange={event => setQuery(event.target.value)} />
          <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
            {candidates.map(creature => <div key={creature.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              {creature.sheetImageUrl ? <img src={creature.sheetImageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <FileImage className="h-8 w-8 shrink-0 text-textMuted" />}
              <span className="min-w-0 flex-1 text-sm text-textH">{creature.name}</span>
              <Button size="sm" disabled={!canEdit || saving} onClick={() => void setVisible(creature.id, true)}>Adicionar</Button>
            </div>)}
            {!candidates.length ? <p className="py-4 text-sm text-textMuted">Nenhuma criatura disponível{query.trim() ? " para essa busca" : ": todas já foram adicionadas ou o compêndio está vazio"}.</p> : null}
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
      </Modal> : null}
    </div>
  )
}
