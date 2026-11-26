import { useMemo, useRef, useState } from "react"
import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import { creatureTokenQuantity } from "./creatureTokens"

export function CreatureSpawner({ creatures, connected, onSpawn }: {
  creatures: readonly CompendiumCreature[]
  connected: boolean
  onSpawn: (creature: CompendiumCreature, quantity: number, initiative: boolean, hidden: boolean) => Promise<void>
}) {
  const [search,setSearch]=useState("")
  const [selected,setSelected]=useState("")
  const [quantity,setQuantity]=useState(1)
  const [hidden,setHidden]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState("")
  const [error,setError]=useState("")
  const inFlight=useRef(false)
  const filtered=useMemo(()=>creatures.filter(creature=>(creature.name+" "+(creature.folder??"")).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[creatures,search])
  const creature=creatures.find(entry=>entry.id===selected)
  async function spawn(initiative:boolean) {
    if(!creature||!connected||inFlight.current)return
    inFlight.current=true;setBusy(true);setNotice("");setError("")
    try{
      await onSpawn(creature,creatureTokenQuantity(creature,quantity),initiative,hidden)
      setNotice(initiative?"Tokens e criaturas adicionados à iniciativa.":"Tokens adicionados ao mapa e associados ao compêndio.")
    }catch(error){setError(error instanceof Error?error.message:String(error))}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <section className="grid gap-3 rounded-xl border border-border bg-bg p-3">
    <h2 className="font-semibold text-textH">Criaturas do compêndio</h2>
    <input className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-textH" aria-label="Buscar criatura" placeholder="Buscar por nome ou pasta" value={search} onChange={event=>setSearch(event.target.value)} />
    <select className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-textH" aria-label="Criatura do compêndio" value={selected} onChange={event=>setSelected(event.target.value)}>
      <option value="">Escolha uma criatura</option>
      {filtered.map(creature=><option key={creature.id} value={creature.id}>{creature.name}{creature.unique?" · Única":""}</option>)}
    </select>
    {creature ? <>
      {creature.sheetImageUrl ? <img src={creature.sheetImageUrl} alt={creature.name} className="max-h-40 w-full rounded-lg object-contain" /> : <p className="text-xs text-textMuted">Esta criatura precisa de uma imagem cadastrada no compêndio.</p>}
      <label className="grid gap-1 text-xs text-textH">Quantidade
        <input className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-textH" type="number" min={1} max={50} disabled={creature.unique||busy} value={creature.unique?1:quantity} onChange={event=>setQuantity(Number(event.target.value)||1)}/>
      </label>
      <label className="flex gap-2 text-xs text-textH"><input type="checkbox" checked={hidden} disabled={busy} onChange={event=>setHidden(event.target.checked)}/>Ocultar tokens e iniciativa dos jogadores</label>
      <p className="text-xs text-textMuted">{creature.unique ? "Usa a mesma criatura única e seu estado persistente na sessão." : "Cada cópia na iniciativa terá seus próprios PV, condições e recursos."}</p>
    </>:null}
    <div className="flex flex-wrap gap-2">
      <button className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-textH disabled:opacity-40" type="button" disabled={!connected||busy||!creature?.sheetImageUrl} onClick={()=>void spawn(false)}>Adicionar ao mapa</button>
      <button className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs text-textH disabled:opacity-40" type="button" disabled={!connected||busy||!creature?.sheetImageUrl} onClick={()=>void spawn(true)}>Adicionar ao mapa e à iniciativa</button>
    </div>
    {busy?<p role="status" className="text-xs text-textMuted">Preparando tokens e confirmando a iniciativa…</p>:null}
    {error?<p role="alert" className="error">{error}</p>:null}
    {notice?<p role="status" className="text-xs text-textH">{notice}</p>:null}
  </section>
}
