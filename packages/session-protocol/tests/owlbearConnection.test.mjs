import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
const root=fileURLToPath(new URL("../../../",import.meta.url))
const built=await build({stdin:{contents:`
 export * from "./apps/owlbear-extension/src/connectionPreferences";
 export * from "./apps/owlbear-extension/src/creatureTokens";
 export * from "./apps/owlbear-extension/src/spawnCreatureTokens";
 export { createCompendiumCreature } from "./apps/web/src/models/creatures/CompendiumCreature";
 export { createInitiativeSession, normalizeInitiativeSession } from "./apps/web/src/models/initiative/Initiative";
 export { createCreatureInitiativeEntries } from "./apps/web/src/models/initiative/creatureInitiativeEntries";
 export * from "./apps/web/server/owlbearRoomBinding";
`,loader:"ts",resolveDir:root},bundle:true,platform:"node",format:"esm",write:false})
const m=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].contents).toString("base64"))

test("signed room bindings cannot be moved to another room or edited to another campaign",()=>{
 const b=m.signOwlbearRoomBinding("room","session","Campanha","secret")
 assert.equal(m.verifyOwlbearRoomBinding(b,"room","secret"),true)
 assert.equal(m.verifyOwlbearRoomBinding(b,"other","secret"),false)
 assert.equal(m.verifyOwlbearRoomBinding({...b,sessionId:"private"},"room","secret"),false)
 assert.equal(m.verifyOwlbearRoomBinding({...b,sessionName:"forged"},"room","secret"),false)
 assert.equal(m.verifyOwlbearRoomBinding(b,"room","wrong"),false)
 assert.deepEqual(Object.keys(b).sort(),["roomId","sessionId","sessionName","signature","version"])
})
test("saved account and character preferences are scoped, expired and malformed credentials are rejected",()=>{
 const data=new Map(),storage={getItem:key=>data.get(key)??null}
 data.set(m.accountStorageKey("site"),JSON.stringify({token:"private",userId:"user",expiresAt:200}))
 assert.equal(m.readRememberedAccount(storage,"site",100).userId,"user")
 assert.equal(m.readRememberedAccount(storage,"site",200),null)
 assert.equal(m.readRememberedAccount(storage,"other",100),null)
 data.set(m.accountStorageKey("site"),"{broken")
 assert.equal(m.readRememberedAccount(storage,"site"),null)
 assert.notEqual(m.characterStorageKey("site","a","s"),m.characterStorageKey("site","b","s"))
 assert.notEqual(m.characterStorageKey("site","a","s"),m.characterStorageKey("site","a","other"))
})
test("dedicated dice rolls never open the popup, even after navigating away before the response",()=>{
 assert.equal(m.shouldOpenDicePopover("dice",false,false),false)
 assert.equal(m.shouldOpenDicePopover("sheet",true,false),false)
 assert.equal(m.shouldOpenDicePopover("sheet",false,true),false)
 assert.equal(m.shouldOpenDicePopover("sheet",false,false),true)
})
function setup(patch={}) {
 let snapshot={initialized:false,session:m.createInitiativeSession("Test")}
 const events=[],tokens=[],selected=[],packets=[]
 let existing=[],sceneReady=true
 const buildImage=(image,grid)=>{
   const token={id:crypto.randomUUID(),image,grid}
   const b={build:()=>token}
   for(const key of ["name","layer","position","visible","metadata"])b[key]=value=>{token[key]=value;return b}
   return b
 }
 const services={
   sessionId:"session",isMaster:true,isCurrent:()=>true,digitalDiceEnabled:false,
   getSnapshot:()=>snapshot,
   buildImage,
   imageLoader:async()=>({url:"https://image.test/token.png",mime:"image/png",width:400,height:600}),
   obr:{
     player:{getRole:async()=>"GM",select:async ids=>selected.push(ids)},
     scene:{isReady:async()=>sceneReady,grid:{getDpi:async()=>150},items:{getItems:async()=>existing,addItems:async items=>{events.push("map-add");tokens.push(...items)}}},
     viewport:{getWidth:async()=>900,getHeight:async()=>600,inverseTransformPoint:async p=>p},
   },
   send:message=>{
     packets.push(message)
     if(message.type==="session.initiative.initialize")snapshot={initialized:true,session:message.session}
     const op=message.operation
     if(op?.type==="initiative.entries.add")snapshot={initialized:true,session:m.normalizeInitiativeSession({...snapshot.session,entries:[...snapshot.session.entries,...op.entries]})}
     if(op?.type==="initiative.entry.remove")snapshot.session.entries=snapshot.session.entries.filter(entry=>entry.id!==op.entryId)
     if(op?.type==="initiative.entry.update")snapshot.session.entries=snapshot.session.entries.map(entry=>entry.id===op.entryId?{...entry,...op.patch}:entry)
     return true
   },
   wait:async(predicate,send)=>{
     assert.equal(send(),true)
     assert.equal(predicate(snapshot),true)
     events.push("server-confirm")
     return snapshot
   },...patch,
 }
 const creature=m.createCompendiumCreature({id:"monster",name:"Segredo do monstro",basicName:"Criatura",size:"Grande",sheetImageUrl:"https://image.test/token.png",maxHp:25})
 return {services,creature,events,tokens,selected,packets,getSnapshot:()=>snapshot,setSnapshot:value=>{snapshot=value},setExisting:value=>{existing=value},setSceneReady:value=>{sceneReady=value}}
}
test("batch spawn creates independent hidden combatants and linked image tokens only after server confirmation",async()=>{
 const f=setup()
 await m.spawnCompendiumTokens(f.creature,3,true,true,f.services)
 assert.equal(f.tokens.length,3)
 const entries=f.getSnapshot().session.entries
 assert.equal(entries.length,3)
 assert.equal(new Set(entries.map(entry=>entry.id)).size,3)
 assert.equal(entries.every(entry=>entry.hidden&&entry.maxHp===25),true)
 assert.ok(f.events.indexOf("map-add")>f.events.lastIndexOf("server-confirm"))
 for(let i=0;i<3;i++){
   assert.equal(f.tokens[i].metadata["com.dnd-manager.owlbear/creature-link"].entryId,entries[i].id)
   assert.equal(f.tokens[i].metadata["com.dnd-manager.owlbear/compendium-creature"].sessionId,"session")
   assert.equal(f.tokens[i].visible,false)
   assert.equal(f.tokens[i].name.startsWith("Criatura"),true)
   assert.equal(f.tokens[i].grid.dpi,300)
 }
 assert.equal(new Set(f.tokens.map(token=>JSON.stringify(token.position))).size,3)
})
test("map-only tokens carry catalog association and do not alter initiative",async()=>{
 const f=setup()
 await m.spawnCompendiumTokens(f.creature,2,false,false,f.services)
 assert.equal(f.packets.length,0)
 assert.equal(f.tokens.length,2)
 assert.equal(f.tokens[0].metadata["com.dnd-manager.owlbear/compendium-creature"].creatureId,f.creature.id)
 assert.equal(f.tokens[0].metadata["com.dnd-manager.owlbear/creature-link"],undefined)
})
test("unique NPCs reuse their existing combatant and retain HP/resources across multiple turns",async()=>{
 const f=setup()
 f.creature.unique=true;f.creature.initiativeTurns=2
 const entries=m.createCreatureInitiativeEntries(f.creature,[],{digitalDiceEnabled:false}).map(entry=>({...entry,currentHp:7,creatureFeatureResources:{feature:{used:1,max:2}},hidden:true}))
 f.setSnapshot({initialized:true,session:m.normalizeInitiativeSession({...m.createInitiativeSession(),entries})})
 await m.spawnCompendiumTokens(f.creature,20,true,false,f.services)
 assert.equal(f.tokens.length,1)
 assert.equal(f.packets.length,0)
 assert.equal(f.getSnapshot().session.entries[0].currentHp,7)
 assert.equal(f.tokens[0].metadata["com.dnd-manager.owlbear/creature-link"].entryId,entries[0].id)
 assert.equal(f.tokens[0].visible,false)
})
test("a failed image insertion rolls back only newly created initiative entries",async()=>{
 const f=setup()
 f.services.obr.scene.items.addItems=async()=>{throw Error("map unavailable")}
 await assert.rejects(m.spawnCompendiumTokens(f.creature,2,true,false,f.services),/Não foi possível/)
 assert.equal(f.getSnapshot().session.entries.length,0)
 assert.equal(f.packets.filter(packet=>packet.operation?.type==="initiative.entry.remove").length,2)
})
test("denied initiative creation, a closed map or a changed session cannot produce orphan tokens",async()=>{
 const denied=setup({wait:async()=>{throw Error("Access denied")}})
 await assert.rejects(m.spawnCompendiumTokens(denied.creature,2,true,false,denied.services),/Access denied/)
 assert.equal(denied.tokens.length,0)
 const closed=setup();closed.setSceneReady(false)
 await assert.rejects(m.spawnCompendiumTokens(closed.creature,1,true,false,closed.services),/Abra um mapa/)
 assert.equal(closed.packets.length,0)
 const changed=setup({isCurrent:()=>false})
 await assert.rejects(m.spawnCompendiumTokens(changed.creature,1,true,false,changed.services),/sessão mudou/)
 assert.equal(changed.tokens.length,0)
})
test("unique token duplication selects the existing token instead of making another",async()=>{
 const f=setup();f.creature.unique=true
 f.setExisting([{id:"old",metadata:{"com.dnd-manager.owlbear/compendium-creature":{sessionId:"session",creatureId:f.creature.id}}}])
 await assert.rejects(m.spawnCompendiumTokens(f.creature,5,true,false,f.services),/já tem um token/)
 assert.equal(f.tokens.length,0)
 assert.deepEqual(f.selected,[["old"]])
})
test("token footprint and quantity accept Portuguese/imported sizes and bound large batches",()=>{
 assert.equal(m.creatureTokenCells("Médio"),1)
 assert.equal(m.creatureTokenCells("Large"),2)
 assert.equal(m.creatureTokenCells("Enorme"),3)
 assert.equal(m.creatureTokenCells("Gargantuan"),4)
 assert.equal(m.creatureTokenQuantity({unique:false},1000),50)
 assert.equal(m.creatureTokenQuantity({unique:true},1000),1)
})
test("a room change during map insertion removes the just-created tokens",async()=>{
 const f=setup();let current=true
 f.services.isCurrent=()=>current
 const removed=[]
 f.services.obr.scene.items.addItems=async items=>{f.tokens.push(...items);current=false}
 f.services.obr.scene.items.deleteItems=async ids=>removed.push(...ids)
 await assert.rejects(m.spawnCompendiumTokens(f.creature,2,false,false,f.services),/sessão mudou/)
 assert.deepEqual(removed,f.tokens.map(token=>token.id))
})
