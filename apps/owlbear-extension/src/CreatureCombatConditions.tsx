import { useEffect, useState } from "react"
import { STANDARD_CONDITION_PRESETS } from "../../web/src/features/characters/characterSheet/standardConditionPresets"
import type { InitiativeCondition, InitiativeConditionDuration, InitiativeEntry } from "../../web/src/models/initiative/Initiative"
import type { Bonus, BonusCollection } from "../../web/src/models/bonuses/Bonus"
import type { Attribute } from "../../web/src/models/sheet/Attribute"

type ModifierTarget = "armorClass" | "initiative" | "speed" | "attackBonus" | "damageBonus"
  | "savingThrowBonus" | "abilityCheckBonus" | "generalTestBonus" | "passivePerception"
  | "saveDcBonus" | `save:${Attribute}`
type ModifierDraft = { id: string; target: ModifierTarget; type: Bonus["type"]; value: string }
type DurationDraft = InitiativeConditionDuration["type"]
type Draft = {
  id?: string
  name: string
  behavior: string
  description: string
  source: string
  tags: string[]
  durationType: DurationDraft
  remaining: string
  modifiers: ModifierDraft[]
}
const TARGETS: { value: ModifierTarget; label: string }[] = [
  { value: "armorClass", label: "Classe de Armadura" },
  { value: "initiative", label: "Iniciativa" },
  { value: "speed", label: "Deslocamento" },
  { value: "attackBonus", label: "Ataques" },
  { value: "damageBonus", label: "Dano" },
  { value: "savingThrowBonus", label: "Todas as salvaguardas" },
  { value: "abilityCheckBonus", label: "Testes de habilidade" },
  { value: "generalTestBonus", label: "Todos os testes" },
  { value: "passivePerception", label: "Percepção passiva" },
  { value: "saveDcBonus", label: "CDs" },
  { value: "save:str", label: "Salvaguarda de Força" },
  { value: "save:dex", label: "Salvaguarda de Destreza" },
  { value: "save:con", label: "Salvaguarda de Constituição" },
  { value: "save:int", label: "Salvaguarda de Inteligência" },
  { value: "save:wis", label: "Salvaguarda de Sabedoria" },
  { value: "save:cha", label: "Salvaguarda de Carisma" },
]
const DURATION_OPTIONS: { value: DurationDraft; label: string }[] = [
  { value: "manual", label: "Até remover manualmente" },
  { value: "rounds", label: "Rodadas" },
  { value: "turns", label: "Turnos (da criatura)" },
  { value: "untilTurnStart", label: "Até o início do próximo turno" },
  { value: "untilTurnEnd", label: "Até o fim do próximo turno" },
]
const fields = "w-full rounded-lg border border-border bg-bg px-2 py-2 text-xs text-textH"
const action = "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-textH disabled:opacity-40"
const makeModifier = (): ModifierDraft => ({ id: crypto.randomUUID(), target: "armorClass", type: "add", value: "1" })
const emptyDraft = (): Draft => ({
  name: "", behavior: "", description: "", source: "", tags: [], durationType: "manual",
  remaining: "1", modifiers: [],
})

function readModifiers(bonuses?: BonusCollection): ModifierDraft[] {
  if (!bonuses) return []
  const entries: ModifierDraft[] = []
  for (const { value } of TARGETS) {
    if (value.startsWith("save:")) {
      const attribute = value.slice(5)
      for (const entry of bonuses.savingThrowAttributeBonus ?? []) {
        if (entry.attribute !== attribute) continue
        entries.push({id: crypto.randomUUID(), target: value, type: entry.bonus.type, value: String(entry.bonus.value)})
      }
    } else {
      const list = bonuses[value as keyof BonusCollection]
      if (!Array.isArray(list)) continue
      for (const bonus of list) {
        if (!bonus || typeof bonus !== "object" || !("type" in bonus) || !("value" in bonus)) continue
        const numeric = bonus as Bonus
        if (typeof numeric.value === "number" && Number.isFinite(numeric.value)) {
          entries.push({id: crypto.randomUUID(), target: value, type: numeric.type, value: String(numeric.value)})
        }
      }
    }
  }
  return entries
}

function toBonuses(rows: ModifierDraft[]): BonusCollection | null {
  const result: BonusCollection = {}
  for (const row of rows) {
    const value = Number(row.value)
    if (!row.value.trim() || !Number.isFinite(value)) return null
    const bonus: Bonus = { type: row.type, value }
    if (row.target.startsWith("save:")) {
      const attribute = row.target.slice(5) as Attribute
      result.savingThrowAttributeBonus ??= []
      result.savingThrowAttributeBonus.push({ attribute, bonus })
    } else {
      // These target keys all have a homogeneous Bonus[] shape.
      const target = row.target as Exclude<ModifierTarget, `save:${Attribute}`>
      const list = result[target] as Bonus[] | undefined
      Object.assign(result, { [target]: [...(list ?? []), bonus] })
    }
  }
  return result
}

function durationLabel(duration: InitiativeConditionDuration): string {
  switch (duration.type) {
    case "manual": return "Até remover"
    case "rounds": return `${duration.remaining} rodada(s)`
    case "turns": return `${duration.remaining} turno(s)`
    case "untilTurnStart": return "Até início do próximo turno"
    case "untilTurnEnd": return "Até fim do próximo turno"
  }
}

function draftFromCondition(condition: InitiativeCondition): Draft {
  return {
    id: condition.id,
    name: condition.name,
    behavior: condition.behavior ?? "",
    description: condition.description ?? "",
    source: condition.source ?? "",
    tags: condition.tags ?? [],
    durationType: condition.duration.type,
    remaining: "remaining" in condition.duration ? String(condition.duration.remaining) : "1",
    modifiers: readModifiers(condition.bonuses),
  }
}

function toCondition(draft: Draft, entryId: string): InitiativeCondition | null {
  const name = draft.name.trim()
  if (!name || name.length > 200) return null
  const bonuses = toBonuses(draft.modifiers)
  if (!bonuses) return null
  const count = Number(draft.remaining)
  if ((draft.durationType === "rounds" || draft.durationType === "turns")
    && (!Number.isSafeInteger(count) || count < 1 || count > 10000)) return null
  const duration: InitiativeConditionDuration = draft.durationType === "rounds"
    || draft.durationType === "turns"
    ? { type: draft.durationType, remaining: count }
    : draft.durationType === "manual"
      ? { type: "manual" }
      : { type: draft.durationType, ownerEntryId: entryId }
  return {
    id: draft.id ?? crypto.randomUUID(),
    name,
    behavior: draft.behavior.trim(),
    description: draft.description.trim(),
    source: draft.source.trim(),
    tags: draft.tags,
    bonuses,
    duration,
  }
}

export function CreatureCombatConditions({ entry, connected, onOperation }: {
  entry: InitiativeEntry
  connected: boolean
  onOperation: (operation: Record<string, unknown>) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (editingId && !entry.conditions.some(condition => condition.id === editingId)) {
      setEditingId(null)
      setOpen(false)
    }
  }, [editingId, entry.conditions])

  function send(operation: Record<string, unknown>): boolean {
    if (!connected || !onOperation({ characterId: "session", ...operation })) {
      setError("Não foi possível enviar a condição à sessão.")
      return false
    }
    setError("")
    return true
  }
  function beginEdit(condition?: InitiativeCondition) {
    setDraft(condition ? draftFromCondition(condition) : emptyDraft())
    setEditingId(condition?.id ?? null)
    setError("")
    setOpen(true)
  }
  function save() {
    const condition = toCondition(draft, entry.id)
    if (!condition) {
      setError("Informe um nome, uma duração válida e valores numéricos para os modificadores.")
      return
    }
    const operation = editingId
      ? { type: "initiative.entry.update", entryId: entry.id, patch: {
          conditions: entry.conditions.map(existing => existing.id === editingId ? condition : existing),
        } }
      : { type: "initiative.conditions.bulk", entryIds: [entry.id], mode: "add", condition }
    if (send(operation)) { setOpen(false); setEditingId(null) }
  }
  function remove(name: string) {
    if (send({ type: "initiative.conditions.bulk", entryIds: [entry.id], mode: "remove", conditionName: name })) {
      setOpen(false)
    }
  }
  return <section className="grid gap-2 text-xs">
    <div className="flex items-center justify-between gap-2">
      <strong>Condições</strong>
      <button type="button" className={action} onClick={() => beginEdit()}>+ Condição</button>
    </div>
    {entry.conditions.length === 0 && <span className="text-textMuted">Nenhuma condição ativa.</span>}
    {entry.conditions.map(condition => <div key={condition.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle p-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-textH">{condition.name}</div>
        <span className="text-[11px] text-textMuted">
          {durationLabel(condition.duration)}
          {Object.keys(condition.bonuses ?? {}).length ? " · Com modificadores" : ""}
        </span>
      </div>
      <button type="button" className={action} onClick={() => beginEdit(condition)}>Editar</button>
      <button type="button" disabled={!connected} className={action} onClick={() => remove(condition.name)}>Remover</button>
    </div>)}
    {open && <div className="grid gap-3 rounded-xl border border-accentBorder bg-bg-subtle p-3">
      <div className="flex items-center justify-between">
        <strong>{editingId ? "Editar condição" : "Adicionar condição"}</strong>
        <button type="button" className={action} onClick={() => {setOpen(false);setError("")}}>Fechar</button>
      </div>
      <label className="grid gap-1">Condição padrão
        <select className={fields} value="" onChange={event => {
          const preset = STANDARD_CONDITION_PRESETS.find(p => p.id === event.target.value)
          if (!preset) return
          setDraft(current => ({...current,name:preset.name,description:preset.description,behavior:preset.behavior,tags:preset.tags}))
        }}>
          <option value="">Escolha ou digite abaixo...</option>
          {STANDARD_CONDITION_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1">Nome
        <input className={fields} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} placeholder="Ex.: Envenenado"/>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">Duração
          <select className={fields} value={draft.durationType} onChange={e=>setDraft(d=>({...d,durationType:e.target.value as DurationDraft}))}>
            {DURATION_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {(draft.durationType === "rounds" || draft.durationType === "turns") && <label className="grid gap-1">Restante
          <input className={fields} type="number" min={1} max={10000} value={draft.remaining} onChange={e=>setDraft(d=>({...d,remaining:e.target.value}))}/>
        </label>}
      </div>
      <label className="grid gap-1">Efeito
        <textarea className={fields} rows={2} value={draft.behavior} onChange={e=>setDraft(d=>({...d,behavior:e.target.value}))} placeholder="Descrição mecânica ou narrativa"/>
      </label>
      <details className="rounded-lg border border-border p-2">
        <summary className="cursor-pointer font-semibold">Fonte, descrição e modificadores</summary>
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1">Fonte
            <input className={fields} value={draft.source} onChange={e=>setDraft(d=>({...d,source:e.target.value}))} placeholder="Magia, criatura..."/>
          </label>
          <label className="grid gap-1">Descrição
            <textarea className={fields} rows={2} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/>
          </label>
          <div className="flex items-center justify-between">
            <strong>Modificadores mecânicos</strong>
            <button type="button" className={action} onClick={()=>setDraft(d=>({...d,modifiers:[...d.modifiers,makeModifier()]}))}>+ Modificador</button>
          </div>
          {draft.modifiers.map(row => <div className="grid grid-cols-[minmax(0,1fr)_68px_64px_auto] gap-1" key={row.id}>
            <select aria-label="Alvo do modificador" className={fields} value={row.target} onChange={e=>setDraft(d=>({...d,modifiers:d.modifiers.map(m=>m.id===row.id?{...m,target:e.target.value as ModifierTarget}:m)}))}>
              {TARGETS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select aria-label="Operação do modificador" className={fields} value={row.type} onChange={e=>setDraft(d=>({...d,modifiers:d.modifiers.map(m=>m.id===row.id?{...m,type:e.target.value as Bonus["type"]}:m)}))}>
              <option value="add">+</option>
              <option value="sub">−</option>
              <option value="flat">Fixo</option>
            </select>
            <input aria-label="Valor do modificador" className={fields} type="number" value={row.value} onChange={e=>setDraft(d=>({...d,modifiers:d.modifiers.map(m=>m.id===row.id?{...m,value:e.target.value}:m)}))}/>
            <button aria-label="Remover modificador" type="button" className={action} onClick={()=>setDraft(d=>({...d,modifiers:d.modifiers.filter(m=>m.id!==row.id)}))}>×</button>
          </div>)}
          <p className="text-[11px] text-textMuted">Bônus e penalidades são aplicados enquanto a condição estiver ativa. Efeitos descritos apenas em texto precisam de arbitragem do mestre.</p>
        </div>
      </details>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button type="button" disabled={!connected} className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 font-semibold text-textH disabled:opacity-40" onClick={save}>Salvar condição</button>
    </div>}
    {!open && error && <p role="alert" className="text-danger">{error}</p>}
  </section>
}
