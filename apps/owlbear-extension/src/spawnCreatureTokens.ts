import type OBR from "@owlbear-rodeo/sdk"
import type { buildImage } from "@owlbear-rodeo/sdk"
import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import { createCreatureInitiativeEntries } from "../../web/src/models/initiative/creatureInitiativeEntries"
import { createInitiativeSession, normalizeInitiativeSession, type InitiativeSession } from "../../web/src/models/initiative/Initiative"
import { creatureTokenCells, creatureTokenQuantity, loadCreatureImage, tokenBatchPositions } from "./creatureTokens"

const CATALOG_KEY="com.dnd-manager.owlbear/compendium-creature"
const CREATURE_KEY="com.dnd-manager.owlbear/creature-link"
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"?value as Record<string,unknown>:{}

type Services = {
  obr: Pick<typeof OBR,"scene"|"viewport"|"player">
  buildImage: typeof buildImage
  imageLoader?: typeof loadCreatureImage
  sessionId: string
  isMaster: boolean
  isCurrent: () => boolean
  digitalDiceEnabled: boolean
  getSnapshot: () => Record<string,unknown>|null
  send: (message: Record<string,unknown>) => boolean
  wait: (predicate:(state:Record<string,unknown>)=>boolean,send:()=>boolean)=>Promise<Record<string,unknown>>
}
export async function spawnCompendiumTokens(creature:CompendiumCreature,requested:number,addInitiative:boolean,hidden:boolean,services:Services):Promise<void> {
  const {obr,sessionId,send,wait}=services
  if(!services.isMaster || await obr.player.getRole()!=="GM")throw Error("Conecte-se como mestre para adicionar tokens.")
  if(!await obr.scene.isReady())throw Error("Abra um mapa no Owlbear antes de adicionar tokens.")
  const assertCurrent=()=>{if(!services.isCurrent())throw Error("A sessão mudou durante a criação dos tokens.")}
  const currentEntries=()=>normalizeInitiativeSession(record(services.getSnapshot()?.session) as Partial<InitiativeSession>).entries
  const existingItems=await obr.scene.items.getItems()
  if(creature.unique) {
    const existing=existingItems.find(item=>{
      const catalog=record(item.metadata[CATALOG_KEY]),link=record(item.metadata[CREATURE_KEY])
      const entry=currentEntries().find(entry=>entry.id===link.entryId)
      return (catalog.sessionId===sessionId&&catalog.creatureId===creature.id)||(link.sessionId===sessionId&&entry?.sourceId==="compendium:"+creature.id)
    })
    if(existing){await obr.player.select([existing.id]);throw Error("Esta criatura única já tem um token no mapa. O token existente foi selecionado.")}
  }
  const count=creatureTokenQuantity(creature,requested)
  const image=await (services.imageLoader??loadCreatureImage)(creature.sheetImageUrl??"")
  const [dpi,width,height]=await Promise.all([obr.scene.grid.getDpi(),obr.viewport.getWidth(),obr.viewport.getHeight()])
  const center=await obr.viewport.inverseTransformPoint({x:width/2,y:height/2})
  const cells=creatureTokenCells(creature.size),positions=tokenBatchPositions(count,cells,dpi,center)
  assertCurrent()
  let entries:ReturnType<typeof createCreatureInitiativeEntries>=[]
  let createdIds:string[]=[]
  if(addInitiative) {
    if(services.getSnapshot()?.initialized!==true)await wait(state=>state.initialized===true,()=>send({type:"session.initiative.initialize",session:createInitiativeSession("Combate da sessão")}))
    assertCurrent()
    const existing=currentEntries().filter(entry=>entry.sourceId==="compendium:"+creature.id)
    if(creature.unique&&existing.length) {
      entries=existing
      if(hidden && entries.some(entry=>!entry.hidden)) {
        await wait(state=>{
          const rows=record(state.session).entries
          return Array.isArray(rows)&&entries.every(entry=>rows.some(row=>record(row).id===entry.id&&record(row).hidden===true))
        },()=>entries.every(entry=>send({type:"session.initiative.operation",operation:{type:"initiative.entry.update",characterId:"session",entryId:entry.id,patch:{hidden:true}}})))
      }
    } else {
      entries=createCreatureInitiativeEntries(creature,currentEntries(),{quantity:count,hidden,digitalDiceEnabled:services.digitalDiceEnabled})
      if(!entries.length)throw Error("Não foi possível criar as criaturas na iniciativa.")
      createdIds=entries.map(entry=>entry.id!)
      await wait(state=>{
        const rows=record(state.session).entries
        return Array.isArray(rows)&&createdIds.every(id=>rows.some(row=>record(row).id===id))
      },()=>send({type:"session.initiative.operation",operation:{type:"initiative.entries.add",characterId:"session",entries}}))
      // Use the confirmed state, including persistent NPC resources and public names.
      entries=currentEntries().filter(entry=>createdIds.includes(entry.id))
    }
  }
  assertCurrent()
  const tokens=positions.map((position,index)=>{
    const entry=creature.unique?entries[0]:entries[index]
    const metadata:Record<string,unknown>={[CATALOG_KEY]:{sessionId,creatureId:creature.id}}
    if(entry)metadata[CREATURE_KEY]={sessionId,entryId:entry.id}
    return services.buildImage(image,{dpi:Math.max(image.width,image.height)/cells,offset:{x:image.width/2,y:image.height/2}})
      .name(String(entry?.basicName||creature.basicName||creature.name)).layer("CHARACTER").position(position)
      .visible(!hidden&&!entry?.hidden).metadata(metadata).build()
  })
  try{await obr.scene.items.addItems(tokens)}
  catch(error){
    if(createdIds.length&&services.isCurrent()) {
      try {
        await wait(state=>{
          const rows=record(state.session).entries
          return Array.isArray(rows)&&createdIds.every(id=>!rows.some(row=>record(row).id===id))
        },()=>createdIds.every(entryId=>send({type:"session.initiative.operation",operation:{type:"initiative.entry.remove",characterId:"session",entryId}})))
      }catch{throw Error("O mapa recusou os tokens. Confira as entradas na iniciativa antes de tentar novamente.")}
    }
    throw Error("Não foi possível colocar os tokens no mapa. "+String(error))
  }
  if(!services.isCurrent()) {
    await obr.scene.items.deleteItems(tokens.map(token=>token.id))
    throw Error("A sessão mudou. Os tokens desta operação foram cancelados.")
  }
  // Selection is a convenience; a failed selection must not report the successful batch as failed.
  try{await obr.player.select(tokens.map(token=>token.id))}catch{}
}
