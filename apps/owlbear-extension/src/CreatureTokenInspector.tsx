import { CreatureQuickSheet, quickSheetFromInitiativeEntry, quickSheetFromCompendiumCreature } from "../../web/src/features/creatures/CreatureQuickSheet"
import { useState } from "react"
import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import type { InitiativeEntry } from "../../web/src/models/initiative/Initiative"

export function CreatureTokenInspector({ entry, creature, onOperation, connected }: {
  entry: InitiativeEntry
  creature?: CompendiumCreature
  connected: boolean
  onOperation: (operation: Record<string, unknown>) => boolean
}) {
  const [amount,setAmount]=useState("1")
  const [condition,setCondition]=useState("")
  const [initiative,setInitiative]=useState(String(entry.initiative))
  const [error,setError]=useState("")
  const send=(operation:Record<string,unknown>)=>{
    if(!connected||!onOperation(operation))setError("Não foi possível enviar a operação à sessão.")
    else setError("")
  }
  const numericAmount=Number(amount)
  return <article className="grid gap-3 rounded-xl border border-border bg-bg p-4 text-textH">
    <CreatureQuickSheet data={creature ? quickSheetFromCompendiumCreature(creature,entry,{enableRolls:true}) : quickSheetFromInitiativeEntry(entry)} compact />
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
      <div className="mt-3 flex gap-2">
        <input aria-label="Quantidade de PV" type="number" min={1} max={100000} className="w-20 rounded-lg border border-border bg-bg px-2 py-1" value={amount} onChange={e=>setAmount(e.target.value)}/>
        <button type="button" disabled={!connected||!Number.isSafeInteger(numericAmount)||numericAmount<=0}
          className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
          onClick={()=>send({type:"initiative.hp.apply",characterId:"session",entryIds:[entry.id],mode:"damage",parts:[{amount:numericAmount}]})}>Dano</button>
        <button type="button" disabled={!connected||!Number.isSafeInteger(numericAmount)||numericAmount<=0}
          className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
          onClick={()=>send({type:"initiative.hp.apply",characterId:"session",entryIds:[entry.id],mode:"heal",amount:numericAmount})}>Curar</button>
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
    <div className="grid gap-2 text-xs">
      <strong>Condições</strong>
      {entry.conditions.length===0&&<span className="text-textMuted">Nenhuma condição ativa.</span>}
      {entry.conditions.map(c=><div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-2">
        <span>{c.name}</span><button type="button" disabled={!connected} onClick={()=>send({type:"initiative.conditions.bulk",characterId:"session",entryIds:[entry.id],mode:"remove",conditionName:c.name})}>Remover</button>
      </div>)}
      <div className="flex gap-2">
        <input value={condition} onChange={e=>setCondition(e.target.value)} placeholder="Adicionar condição" className="min-w-0 flex-1 rounded-lg border border-border bg-bg-subtle px-2 py-1"/>
        <button type="button" disabled={!connected||!condition.trim()} onClick={()=>{send({type:"initiative.conditions.bulk",characterId:"session",entryIds:[entry.id],mode:"add",condition:{id:crypto.randomUUID(),name:condition.trim(),duration:{type:"manual"}}});setCondition("")}}>Adicionar</button>
      </div>
    </div>
    {error&&<p role="alert" className="text-xs text-danger">{error}</p>}
  </article>
}
