import { Plus, Trash2 } from "lucide-react"
import type { CustomProjectDefinition } from "../../models/customSystems/CustomProjectDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"

export function CustomSystemProjectsEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const projects = draft.projects ?? []

  function update(index: number, patch: Partial<CustomProjectDefinition>) {
    setDraft({ ...draft, projects: projects.map((p, i) => i === index ? { ...p, ...patch } : p) })
  }

  function add() {
    const id = uniqueId("project", projects.map((p) => p.id))
    const project: CustomProjectDefinition = {
      id,
      name: "Novo projeto",
      enabled: true,
      fields: [],
      work: { total: 1, minimumProgress: 0 },
      trigger: {
        event: "longRestCompleted",
        dc: 10,
        outcomes: {
          criticalFailure: { progress: -1, label: "Falha crítica" },
          failure: { progress: 0, label: "Falha" },
          success: { progress: 1, label: "Sucesso" },
          criticalSuccess: { progress: 2, label: "Sucesso crítico" },
        },
      },
      requirements: [],
      inventory: {
        allowInputs: true,
        reserveInputs: true,
        consumeInputsOnCompletion: true,
        releaseInputsOnCancellation: true,
        allowOutput: true,
      },
    }
    setDraft({ ...draft, projects: [...projects, project] })
  }

  return <section className="grid gap-4">
    <div className="rounded-lg border border-border bg-bg-subtle p-3 text-sm text-text">
      Projetos são atividades persistentes que avançam por eventos. O motor é genérico: pode representar criação,
      pesquisa, treinamento, construção, rituais ou qualquer outra atividade de longo prazo.
    </div>

    <div>
      <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">
        <Plus className="h-4 w-4" /> Adicionar projeto
      </button>
    </div>

    {projects.map((project, index) => <article key={project.id} className="grid gap-4 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-2">
          <Field label="Nome" value={project.name} onChange={(name) => update(index, { name })} />
          <Field label="ID" value={project.id} onChange={(id) => update(index, { id: slugify(id) })} />
          <Field label="Descrição" value={project.description ?? ""} onChange={(description) => update(index, { description: description || undefined })} />
          <NumberField label="Trabalho total" value={project.work.total ?? 1} min={1} onChange={(total) => update(index, { work: { ...project.work, total } })} />
          <NumberField label="Progresso mínimo" value={project.work.minimumProgress ?? 0} min={0} onChange={(minimumProgress) => update(index, { work: { ...project.work, minimumProgress } })} />
          <NumberField label="CD" value={project.trigger.dc ?? 10} min={0} onChange={(dc) => update(index, { trigger: { ...project.trigger, dc } })} />
        </div>
        <button type="button" title="Remover projeto" onClick={() => setDraft({ ...draft, projects: projects.filter((_, i) => i !== index) })} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-textH">Progresso por resultado</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["criticalFailure", "Falha crítica"],
            ["failure", "Falha"],
            ["success", "Sucesso"],
            ["criticalSuccess", "Sucesso crítico"],
          ] as const).map(([key, label]) => <NumberField key={key} label={label} value={project.trigger.outcomes[key].progress} onChange={(progress) => update(index, {
            trigger: { ...project.trigger, outcomes: { ...project.trigger.outcomes, [key]: { ...project.trigger.outcomes[key], progress } } },
          })} />)}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Check label="Exigir acesso ao inventário do grupo" checked={(project.requirements ?? []).some((r) => r.type === "inventoryAccess" && r.location === "party")} onChange={(checked) => {
          const rest = (project.requirements ?? []).filter((r) => !(r.type === "inventoryAccess" && r.location === "party"))
          update(index, { requirements: checked ? [...rest, { id: "party-inventory", type: "inventoryAccess", location: "party", description: "Requer acesso ao inventário do grupo." }] : rest })
        }} />
        <Check label="Reservar materiais" checked={project.inventory?.reserveInputs !== false} onChange={(reserveInputs) => update(index, { inventory: { ...project.inventory, reserveInputs } })} />
        <Check label="Consumir ao concluir" checked={project.inventory?.consumeInputsOnCompletion !== false} onChange={(consumeInputsOnCompletion) => update(index, { inventory: { ...project.inventory, consumeInputsOnCompletion } })} />
        <Check label="Liberar ao cancelar" checked={project.inventory?.releaseInputsOnCancellation !== false} onChange={(releaseInputsOnCancellation) => update(index, { inventory: { ...project.inventory, releaseInputsOnCancellation } })} />
      </div>
    </article>)}

    {!projects.length ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text">Nenhum projeto configurado.</div> : null}
  </section>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs text-text"><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" /></label>
}
function NumberField({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1 text-xs text-text"><span>{label}</span><input type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value))} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" /></label>
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
}
function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
function uniqueId(base: string, ids: string[]) {
  let id = base, n = 2
  while (ids.includes(id)) id = `${base}-${n++}`
  return id
}
