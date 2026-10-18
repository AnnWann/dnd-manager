import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

export function CustomResourceActionsEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  if (!draft.resources.length) return null

  return (
    <section className="mt-4 rounded-xl border border-border bg-bg p-4">
      <h3 className="font-semibold text-textH">Recursos na tela de Ações</h3>
      <p className="mt-1 text-xs leading-5 text-textMuted">
        Marque os recursos que o jogador deve conseguir acompanhar sem sair da tela de Ações.
        Recursos com ajuste manual também recebem controles de aumentar e reduzir nessa tela.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {draft.resources.map((resource, index) => (
          <label
            key={resource.id || `resource-${index}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-subtle p-3 hover:border-accentBorder"
          >
            <input
              type="checkbox"
              checked={resource.showInActions === true}
              onChange={(event) => {
                const showInActions = event.target.checked
                setDraft({
                  ...draft,
                  resources: draft.resources.map((entry, current) =>
                    current === index ? { ...entry, showInActions } : entry,
                  ),
                })
              }}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-textH">
                {resource.name || resource.id || 'Recurso sem nome'}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-textMuted">
                {resource.allowManualAdjustment
                  ? 'Exibe valor e controles de ajuste.'
                  : 'Exibe o valor como acompanhamento somente leitura.'}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
