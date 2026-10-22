import { MagicProvider } from "../../web/src/contexts/magicContext"
import { listMissingCreatureSpells } from "./owlbearSpellCatalog"
import type { Spell } from "../../web/src/models/magic/spells/Spell"
import { CreatureQuickSheet, quickSheetFromInitiativeEntry, quickSheetFromCompendiumCreature } from "../../web/src/features/creatures/CreatureQuickSheet"
import { useEffect, useState } from "react"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../web/src/models/combat/Damage"
import { CreatureCombatConditions } from "./CreatureCombatConditions"
import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import type { InitiativeEntry } from "../../web/src/models/initiative/Initiative"

export function CreatureTokenInspector({ entry, creature, spells, serverSpellIndexes, creatureRollError, onOperation, connected }: {
  entry: InitiativeEntry
  creature?: CompendiumCreature
  connected: boolean
  spells: Spell[]
  serverSpellIndexes: ReadonlySet<string>
  creatureRollError?: string
  onOperation: (operation: Record<string, unknown>) => boolean
}) {
  const [amount,setAmount]=useState("1")
  const [damageParts,setDamageParts]=useState<Array<{id:string;amount:string;damageType:DamageType|"";magical:boolean}>>([{id:crypto.randomUUID(),amount:"1",damageType:"",magical:false}])
  const [initiative,setInitiative]=useState(String(entry.initiative))
  const [error,setError]=useState("")
  const send=(operation:Record<string,unknown>)=>{
    if(!connected||!onOperation(operation))setError("Não foi possível enviar a operação à sessão.")
    else setError("")
  }
  const numericAmount=Number(amount)
  const damageValid = damageParts.length > 0 && damageParts.every(part=>Number.isSafeInteger(Number(part.amount))&&Number(part.amount)>0)
  useEffect(()=>setInitiative(String(entry.initiative)),[entry.initiative,entry.id])
  const applyDamage=()=>send({type:"initiative.hp.apply",characterId:"session",entryIds:[entry.id],mode:"damage",parts:damageParts.map(part=>({amount:Number(part.amount),damageType:part.damageType||undefined,magical:part.magical}))})
  const unavailableSpells = listMissingCreatureSpells(creature, spells)
  const unsyncedSpells = creature?.spellcasting?.spells.filter(spell => !serverSpellIndexes.has(spell.spellIndex)) ?? []
  return <article className="grid gap-3 rounded-xl border border-border bg-bg p-4 text-textH">
    <MagicProvider spells={spells}>
      <CreatureQuickSheet data={creature
        ? quickSheetFromCompendiumCreature(creature,entry,{enableRolls:true,serverSpellIndexes})
        : quickSheetFromInitiativeEntry(entry)} compact
        onRestoreSpellSlot={connected ? level => onOperation({ type: "initiative.spellSlot.restore", characterId: "session", entryId: entry.id, level }) : undefined} />
    </MagicProvider>
    {unavailableSpells.length ? <p role="alert" className="rounded-lg border border-border p-2 text-xs text-textMuted">
      {unavailableSpells.length} magia(s) da criatura não têm definição disponível no Owlbear.
      Verifique a biblioteca da campanha.
    </p> : null}
    {unsyncedSpells.length ? <p role="alert" className="rounded-lg border border-border p-2 text-xs text-textMuted">
      {unsyncedSpells.length} magia(s) não estão sincronizadas com a configuração do servidor.
      Atualize a configuração da campanha no D&D Manager para habilitar a conjuração.
    </p> : null}
    {creatureRollError ? <p role="alert" className="rounded-lg border border-danger p-2 text-xs text-danger">
      Falha na rolagem: {creatureRollError}
    </p> : null}
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{entry.customName??entry.realName??entry.name}</h2>
        <p className="text-xs text-textMuted">Instância da iniciativa · {entry.sourceType}</p>
      </div>
      <span className="rounded-lg border border-border p-2 text-sm">CA {entry.armorClass??"—"}</span>
    </div>
    <div className="rounded-lg border border-border bg-bg-subtle p-3">
      <strong className="text-sm">PV: {entry.currentHp??"—"} / {entry.maxHp??"—"}</strong>
      {(entry.maxHp??0)>0&&<div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-accent" style={{width:`${Math.min(100,Math.max(0,100*(entry.currentHp??0)/(entry.maxHp??1)))}%`}}/>
      </div>}
      {Boolean(entry.temporaryHp)&&<p className="mt-1 text-xs text-textMuted">{entry.temporaryHp} PV temporários</p>}
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Componentes de dano</span>
          <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs" onClick={()=>setDamageParts(current=>[...current,{id:crypto.randomUUID(),amount:"1",damageType:"",magical:false}])}>+ Componente</button>
        </div>
        {damageParts.map(part=><div key={part.id} className="grid grid-cols-[65px_minmax(0,1fr)_auto_auto] items-center gap-2">
          <input aria-label="Quantidade de dano" type="number" min={1} value={part.amount} className="min-w-0 rounded-lg border border-border bg-bg px-2 py-2 text-xs"
            onChange={e=>setDamageParts(parts=>parts.map(p=>p.id===part.id?{...p,amount:e.target.value}:p))}/>
          <select aria-label="Tipo de dano" value={part.damageType} className="min-w-0 rounded-lg border border-border bg-bg px-2 py-2 text-xs"
            onChange={e=>setDamageParts(parts=>parts.map(p=>p.id===part.id?{...p,damageType:e.target.value as DamageType|""}:p))}>
            <option value="">Sem tipo</option>
            {DAMAGE_TYPE_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[11px]" title="Dano mágico">
            <input type="checkbox" checked={part.magical} onChange={e=>setDamageParts(parts=>parts.map(p=>p.id===part.id?{...p,magical:e.target.checked}:p))}/> Mágico
          </label>
          <button type="button" aria-label="Remover componente" disabled={damageParts.length===1} className="rounded-lg border border-border px-2 py-1 disabled:opacity-40" onClick={()=>setDamageParts(parts=>parts.filter(p=>p.id!==part.id))}>×</button>
        </div>)}
        <p className="text-[11px] text-textMuted">O servidor calcula resistências, vulnerabilidades e imunidades por tipo.</p>
        <div className="flex gap-2">
          <button type="button" disabled={!connected||!damageValid}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            onClick={applyDamage}>Aplicar dano</button>
          <input aria-label="Quantidade de cura" type="number" min={1} max={100000} className="w-20 rounded-lg border border-border bg-bg px-2 py-1" value={amount} onChange={e=>setAmount(e.target.value)}/>
          <button type="button" disabled={!connected||!Number.isSafeInteger(numericAmount)||numericAmount<=0}
            className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            onClick={()=>send({type:"initiative.hp.apply",characterId:"session",entryIds:[entry.id],mode:"heal",amount:numericAmount})}>Curar</button>
        </div>
      </div>
    </div>
    <div className="grid gap-2">
      <label className="text-xs">Iniciativa
        <input type="number" value={initiative} onChange={e=>setInitiative(e.target.value)}
          className="ml-2 w-20 rounded-lg border border-border bg-bg-subtle px-2 py-1"/>
      </label>
      <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" disabled={!connected||!Number.isFinite(Number(initiative))}
        onClick={()=>send({type:"initiative.entry.update",characterId:"session",entryId:entry.id,patch:{initiative:Number(initiative)}})}>Atualizar iniciativa</button>
    </div>
    <CreatureCombatConditions entry={entry} connected={connected} onOperation={onOperation}/>
    {error&&<p role="alert" className="text-xs text-danger">{error}</p>}
  </article>
}
