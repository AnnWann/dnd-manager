import { Select as SharedSelect } from "../../components/ui/Select"
import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Monitor,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { CustomSystemIcon } from './CustomSystemIcon'
import {
  isPresentationItemVisible,
  listCustomSystemPresentationItems,
  setCustomSystemPresentationItems,
} from '../../lib/customSystems'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type {
  CustomSystemDefinition,
  CustomSystemPresentationItem,
} from '../../models/customSystems/CustomSystemDefinition'

export function CustomSystemPreviewEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const [role, setRole] = useState<'player' | 'master'>('player')
  const resolved = useMemo(() => listCustomSystemPresentationItems(draft), [draft])
  const visible = resolved.filter((item) => isPresentationItemVisible(item, role))

  function commit(items: CustomSystemPresentationItem[]) {
    setDraft(setCustomSystemPresentationItems(draft, items))
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= resolved.length) return
    const next = resolved.map(({ key, hiddenForMaster, hiddenForPlayer }) => ({ key, hiddenForMaster, hiddenForPlayer }))
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }

  function toggleVisibility(index: number) {
    const next = resolved.map(({ key, hiddenForMaster, hiddenForPlayer }, current) => {
      if (current !== index) return { key, hiddenForMaster, hiddenForPlayer }
      return role === 'master'
        ? { key, hiddenForPlayer, hiddenForMaster: !hiddenForMaster }
        : { key, hiddenForMaster, hiddenForPlayer: !hiddenForPlayer }
    })
    commit(next)
  }

  function reset() {
    if (!window.confirm('Restaurar a ordem padrão e tornar todos os itens visíveis para jogador e mestre?')) return
    setDraft({ ...draft, presentation: undefined })
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-textH">Pré-visualização da ficha</h2>
          <p className="mt-1 text-sm text-text">
            Veja como o sistema será exibido e organize a experiência de jogador e mestre separadamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RoleButton active={role === 'player'} onClick={() => setRole('player')} icon={<Monitor className="h-4 w-4" />}>Jogador</RoleButton>
          <RoleButton active={role === 'master'} onClick={() => setRole('master')} icon={<ShieldCheck className="h-4 w-4" />}>Mestre</RoleButton>
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">
            <RotateCcw className="h-4 w-4" /> Restaurar
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border border-border bg-bg p-3">
          <div className="mb-3">
            <h3 className="font-medium text-textH">Organização</h3>
            <p className="mt-1 text-xs text-text">
              Use as setas para alterar a ordem e o olho para esconder apenas na visão selecionada.
            </p>
          </div>
          <div className="grid gap-2">
            {resolved.map((item, index) => {
              const itemVisible = isPresentationItemVisible(item, role)
              return (
                <article key={item.key} className={`flex items-center gap-2 rounded-lg border p-2 ${itemVisible ? 'border-border' : 'border-dashed border-border opacity-60'}`}>
                  <GripVertical className="h-4 w-4 shrink-0 text-text" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-textH">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-text">{kindLabel(item.kind)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Mover para cima" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp className="h-4 w-4" /></IconButton>
                    <IconButton label="Mover para baixo" disabled={index === resolved.length - 1} onClick={() => move(index, 1)}><ChevronDown className="h-4 w-4" /></IconButton>
                    <IconButton label={itemVisible ? `Esconder para ${roleLabel(role)}` : `Mostrar para ${roleLabel(role)}`} onClick={() => toggleVisibility(index)}>
                      {itemVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </IconButton>
                  </div>
                </article>
              )
            })}
            {!resolved.length ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text">Crie campos, recursos ou tipos de habilidade para montar a prévia.</div> : null}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-xl border border-border bg-[color:var(--social-bg)] p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-text">
            <span>Visualização de {roleLabel(role)}</span>
            <span>{visible.length} de {resolved.length} item(ns) visível(is)</span>
          </div>
          <section className="grid gap-4 rounded-xl border border-border bg-bg p-4">
            <header className="flex items-start gap-3 border-b border-border pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accentBorder bg-accentBg text-accent">
                <CustomSystemIcon icon={draft.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-textH">{draft.name || 'Sistema personalizado'}</h3>
                <p className="mt-1 text-sm text-text">{draft.description || 'A descrição do sistema aparecerá aqui.'}</p>
                {role === 'master' ? <span className="mt-2 inline-flex rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[11px] text-textH">Visão do mestre</span> : null}
              </div>
            </header>

            {visible.map((item) => <PreviewItem key={item.key} definition={draft} item={item} role={role} />)}
            {!visible.length ? <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text">Todos os itens estão escondidos nesta visualização.</div> : null}
          </section>
        </main>
      </div>
    </div>
  )
}

function PreviewItem({
  definition,
  item,
  role,
}: {
  definition: CustomSystemDefinition
  item: ReturnType<typeof listCustomSystemPresentationItems>[number]
  role: 'player' | 'master'
}) {
  if (item.kind === 'resource') {
    const resource = definition.resources.find((entry) => entry.id === item.id)
    if (!resource) return null
    const maximum = resource.maximum ?? 10
    const current = Math.min(maximum, resource.initialValue ?? Math.ceil(maximum / 2))
    return <section className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h4 className="font-medium text-textH">{resource.name}</h4>{resource.description ? <p className="mt-1 text-xs text-text">{resource.description}</p> : null}</div>
        {resource.editPermission === 'masterOnly' ? <MasterBadge /> : null}
      </div>
      <div className="mt-3 flex items-center gap-2"><button type="button" disabled className="h-9 w-9 rounded-lg border border-border text-textH">−</button><div className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-textH">{current}</div><button type="button" disabled className="h-9 w-9 rounded-lg border border-border text-textH">+</button></div>
      <div className="mt-2 text-center text-xs text-text">Máximo: {maximum}</div>
    </section>
  }

  if (item.kind === 'field') {
    const field = definition.fields.find((entry) => entry.id === item.id)
    if (!field) return null
    return <section className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-medium text-textH">{field.name}</h4>{field.editPermission === 'masterOnly' ? <MasterBadge /> : null}</div>
      <MockField field={field} disabled={role === 'player' && field.editPermission === 'masterOnly'} />
      {field.description ? <p className="mt-2 text-xs text-text">{field.description}</p> : null}
    </section>
  }

  const ability = definition.abilityTypes.find((entry) => entry.id === item.id)
  if (!ability) return null
  const sample = ability.predefinedAbilities?.[0]
  const titleValue = sample?.values[ability.display.titleFieldId]
  const title = typeof titleValue === 'string' && titleValue.trim() ? titleValue : `Exemplo de ${ability.name}`
  return <section className="rounded-xl border border-border p-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-medium text-textH">{ability.name}</h4>{ability.description ? <p className="mt-1 text-xs text-text">{ability.description}</p> : null}</div><button type="button" disabled className="rounded-lg border border-border px-3 py-2 text-xs text-textH">Adicionar</button></div>
    <article className="mt-3 rounded-lg border border-border p-3"><div className="font-medium text-textH">{title}</div><div className="mt-1 text-xs text-text">{sample?.description || 'Descrição e informações da habilidade.'}</div>{ability.acquisition?.mode === 'learnedAndPrepared' || ability.acquisition?.mode === 'prepared' ? <div className="mt-3 flex gap-3 text-xs text-textH"><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked readOnly /> Aprendida</label><label className="inline-flex items-center gap-1.5"><input type="checkbox" readOnly /> Preparada</label></div> : null}</article>
  </section>
}

function MockField({ field, disabled }: { field: CustomFieldDefinition; disabled: boolean }) {
  const className = 'w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-textH disabled:opacity-60'
  if (field.type === 'boolean') return <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH"><input type="checkbox" disabled={disabled} readOnly /> Não</label>
  if (field.type === 'select') return <SharedSelect className={className} disabled={disabled} defaultValue=""><option value="">Selecione</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SharedSelect>
  if (field.type === 'multiSelect') return <SharedSelect className={`${className} min-h-24`} multiple disabled={disabled}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SharedSelect>
  if (field.type === 'richText') return <textarea className={`${className} min-h-24`} disabled={disabled} placeholder={field.placeholder || 'Texto longo'} />
  if (field.type === 'formula') return <div className="rounded-lg border border-border bg-[color:var(--social-bg)] px-3 py-2 text-sm text-text">Resultado calculado</div>
  if (field.type === 'number') return <input className={className} type="number" disabled={disabled} placeholder="0" />
  return <input className={className} disabled={disabled} placeholder={'placeholder' in field ? field.placeholder : field.name} />
}

function RoleButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${active ? 'border-accent bg-accentBg font-medium text-textH' : 'border-border text-text hover:bg-accentBg'}`}>{icon}{children}</button>
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="rounded-md border border-border p-1.5 text-text hover:bg-accentBg disabled:opacity-30">{children}</button>
}

function MasterBadge() {
  return <span className="shrink-0 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">Só mestre edita</span>
}

function kindLabel(kind: 'field' | 'resource' | 'ability') {
  if (kind === 'field') return 'Campo'
  if (kind === 'resource') return 'Recurso'
  return 'Tipo de habilidade'
}

function roleLabel(role: 'player' | 'master') {
  return role === 'master' ? 'mestre' : 'jogador'
}
