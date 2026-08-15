import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  createCustomSlotPool,
  getCustomClassConfig,
  updateCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"

const ATTRIBUTES: Array<{ value: CustomClassRuntimeConfig["castingAttribute"]; label: string }> = [
  { value: "str", label: "Força" }, { value: "dex", label: "Destreza" }, { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" }, { value: "wis", label: "Sabedoria" }, { value: "cha", label: "Carisma" },
]
const HIT_DICE: CustomClassRuntimeConfig["hitDie"][] = ["d4", "d6", "d8", "d10", "d12"]
const LEVELS = Array.from({ length: 20 }, (_, index) => String(index + 1))
const CIRCLES = Array.from({ length: 9 }, (_, index) => String(index + 1))

type Props = {
  character: CharacterTemplate
  updateCharacter: (characterId: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
}

export function CustomClassConfigurationTab({ character, updateCharacter }: Props) {
  const persisted = useMemo(() => getCustomClassConfig(character), [character])
  const [draft, setDraft] = useState<CustomClassRuntimeConfig | undefined>(persisted)
  if (!persisted || !draft) return null

  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted)
  const patch = (value: Partial<CustomClassRuntimeConfig>) => setDraft((current) => current ? { ...current, ...value } : current)
  const save = () => updateCharacter(character.get("id"), (current) => updateCustomClassConfig(current, draft))

  return <div className="grid gap-4">
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold text-textH">Configuração da classe</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">Estas opções existem somente para classes personalizadas e controlam sua estrutura básica e progressão mágica.</p></div>
        <Button variant="primary" disabled={!dirty} onClick={save}>Salvar alterações</Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Nome da classe</span><Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></label>
        <label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Dado de vida</span><Select value={draft.hitDie} onChange={(e) => patch({ hitDie: e.target.value as CustomClassRuntimeConfig["hitDie"] })}>{HIT_DICE.map((die) => <option key={die} value={die}>{die}</option>)}</Select></label>
        <label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Progressão padrão de conjurador</span><Select value={draft.casterType} onChange={(e) => patch({ casterType: e.target.value as CustomClassRuntimeConfig["casterType"] })}><option value="none">Não conjurador</option><option value="full">Conjurador completo</option><option value="half">Meio conjurador</option><option value="third">1/3 de conjurador</option></Select></label>
        {draft.casterType !== "none" ? <>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Atributo de conjuração</span><Select value={draft.castingAttribute} onChange={(e) => patch({ castingAttribute: e.target.value as CustomClassRuntimeConfig["castingAttribute"] })}>{ATTRIBUTES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Modelo de magias</span><Select value={draft.knownSpellMode} onChange={(e) => patch({ knownSpellMode: e.target.value as CustomClassRuntimeConfig["knownSpellMode"] })}><option value="limited">Magias conhecidas</option><option value="spellbook">Grimório</option><option value="prepared-only">Somente preparadas</option></Select></label>
          {draft.knownSpellMode !== "prepared-only" ? <div className="grid grid-cols-2 gap-2"><label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Conhecidas no N1</span><Input type="number" min={0} value={draft.knownAtLevel1} onChange={(e) => patch({ knownAtLevel1: Math.max(0, Number(e.target.value) || 0) })} /></label><label className="grid gap-1.5"><span className="text-xs font-medium text-textH">Por nível</span><Input type="number" min={0} step={0.5} value={draft.knownPerLevel} onChange={(e) => patch({ knownPerLevel: Math.max(0, Number(e.target.value) || 0) })} /></label></div> : null}
        </> : null}
      </div>
    </section>

    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-textH">Pools adicionais de espaços</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">São independentes da progressão padrão. Assim uma classe pode ser conjuradora completa e ainda possuir, por exemplo, “Espaços de Arcanomancer”.</p></div><Button variant="secondary" onClick={() => patch({ additionalSlotPools: [...draft.additionalSlotPools, createCustomSlotPool()] })}>+ Adicionar pool</Button></div>
      <div className="mt-4 grid gap-4">
        {!draft.additionalSlotPools.length ? <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">Nenhum pool adicional configurado.</div> : null}
        {draft.additionalSlotPools.map((pool, poolIndex) => <div key={pool.id} className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-52 flex-1 gap-1"><span className="text-[11px] font-medium text-textH">Nome do recurso</span><Input value={pool.name} onChange={(e) => { const pools = [...draft.additionalSlotPools]; pools[poolIndex] = { ...pool, name: e.target.value }; patch({ additionalSlotPools: pools }) }} /></label>
            <label className="grid min-w-40 gap-1"><span className="text-[11px] font-medium text-textH">Recupera em</span><Select value={pool.recovery} onChange={(e) => { const pools = [...draft.additionalSlotPools]; pools[poolIndex] = { ...pool, recovery: e.target.value === "short" ? "short" : "long" }; patch({ additionalSlotPools: pools }) }}><option value="long">Descanso longo</option><option value="short">Descanso curto</option></Select></label>
            <Button variant="secondary" onClick={() => patch({ additionalSlotPools: draft.additionalSlotPools.filter((_, index) => index !== poolIndex) })}>Remover</Button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-bg" data-no-tab-swipe>
            <table className="min-w-[760px] w-full border-collapse text-center text-xs"><thead><tr className="border-b border-border text-textMuted"><th className="sticky left-0 bg-bg px-2 py-2 text-left">Nível</th>{CIRCLES.map((circle) => <th key={circle} className="px-2 py-2">{circle}º</th>)}</tr></thead><tbody>
              {LEVELS.map((level) => <tr key={level} className="border-b border-border/70 last:border-0"><th className="sticky left-0 bg-bg px-2 py-1.5 text-left font-semibold text-textH">{level}</th>{CIRCLES.map((circle) => <td key={circle} className="p-1"><input type="number" min={0} max={20} inputMode="numeric" className="h-8 w-14 rounded-md border border-border bg-bg-subtle px-1 text-center text-xs text-textH" value={pool.progression[level]?.[circle] ?? ""} placeholder="—" onChange={(e) => { const amount = Math.max(0, Math.trunc(Number(e.target.value) || 0)); const progression = { ...pool.progression }; const row = { ...(progression[level] ?? {}) }; if (amount) row[circle] = amount; else delete row[circle]; if (Object.keys(row).length) progression[level] = row; else delete progression[level]; const pools = [...draft.additionalSlotPools]; pools[poolIndex] = { ...pool, progression }; patch({ additionalSlotPools: pools }) }} /></td>)}</tr>)}
            </tbody></table>
          </div>
        </div>)}
      </div>
    </section>
  </div>
}
