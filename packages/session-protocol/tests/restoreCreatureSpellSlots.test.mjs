import test from "node:test"
import assert from "node:assert/strict"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../../../apps/session-server/src/routes/initiative/InitiativeSessionActor.ts", import.meta.url))],
  alias: Object.fromEntries([
    ["critical-damage", "criticalDamage"], ["campaign-progression", "campaignProgression"],
    ["long-rest-settings", "longRestSupplySettings"], ["manual-dice", "manualDiceExpression"],
  ].map(([key, file]) => [`@dnd-manager/game-core/${key}`, fileURLToPath(new URL(`../../game-core/src/${file}.ts`, import.meta.url))])),
  bundle: true, platform: "node", format: "esm", target: "node24", write: false,
})
const { applyInitiativeOperation, SessionActor } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"))
const parserModule = await build({
  entryPoints: [fileURLToPath(new URL("../../../apps/session-server/src/routes/initiative/initiativeProtocol.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", target: "node24", write: false,
})
const { parseInitiativeClientMessage } = await import("data:text/javascript;base64," + Buffer.from(parserModule.outputFiles[0].contents).toString("base64"))
const operation = (level = 2, entryId = "a") => ({type:"initiative.spellSlot.restore",characterId:"session",entryId,level})
const message = op => JSON.stringify({type:"session.initiative.operation",operation:op})
const entry = (id, combatantId = "eldren") => ({ id, combatantId, sourceType:"monster",sourceId:"compendium:eldren",name:"Eldren",
  currentHp:52,maxHp:68,temporaryHp:0,conditions:[],side:"enemy",hidden:false,defeated:false,initiative:20,initiativeBonus:0,order:0,createdAt:1,
  creatureSpellResources:{slots:{1:{current:4,max:4},2:{current:0,max:2}},perDay:{fear:{used:1,max:3}}} })
const before = () => ({version:1,id:"combat",entries:[entry("a"),entry("b"),entry("other","other")],round:1,started:false,createdAt:1,updatedAt:1})
const config = {config:{creatureCompendium:[{id:"eldren",spellcasting:{slots:{1:4,2:2}}}]}}
const apply = (state, op = operation()) => applyInitiativeOperation(state,op,config,{}, {})

test("restores one slot and syncs all turns without touching another creature or other resources",()=>{
  const state=before(),result=apply(state)
  assert.equal(result.ok,true)
  assert.deepEqual(result.session.entries.map(e=>e.creatureSpellResources.slots[2].current),[1,1,0])
  assert.deepEqual(result.session.entries[0].creatureSpellResources.slots[1],{current:4,max:4})
  assert.deepEqual(result.session.entries[0].creatureSpellResources.perDay,{fear:{used:1,max:3}})
  assert.equal(state.entries[0].creatureSpellResources.slots[2].current,0)
  assert.equal(result.session.entries[0].currentHp,52)
})
test("sequential corrections use current server state and stop at configured maximum",()=>{
  const first=apply(before()),second=apply(first.session,operation(2,"b")),third=apply(second.session)
  assert.equal(second.ok,true)
  assert.deepEqual(second.session.entries.slice(0,2).map(e=>e.creatureSpellResources.slots[2].current),[2,2])
  assert.equal(third.ok,false)
  assert.equal(third.code,"CREATURE_SPELL_SLOTS_FULL")
})
test("rejects full, nonexistent and unsupported circles",()=>{
  for(const level of [1,0,3,10,1.5]) assert.equal(apply(before(),operation(level)).ok,false)
  assert.equal(apply(before(),operation(2,"missing")).code,"INITIATIVE_ENTRY_NOT_FOUND")
  const state=before();delete state.entries[0].creatureSpellResources
  assert.equal(apply(state).code,"CREATURE_SPELL_SLOTS_FULL")
})
test("wire parser validates slot-restoration payload",()=>{
  assert.ok(parseInitiativeClientMessage(message(operation())))
  for(const level of [0,10,1.5,"2",null]) assert.equal(parseInitiativeClientMessage(message(operation(level))),null)
  assert.equal(parseInitiativeClientMessage(message({...operation(),entryId:""})),null)
  assert.equal(parseInitiativeClientMessage(message({...operation(),characterId:"somebody"})),null)
})
test("players cannot restore arbitrary initiative creature slots",async()=>{
  const output=[]
  const socket={deserializeAttachment:()=>({userId:"player",role:"PLAYER"}),serializeAttachment:()=>{},send:raw=>output.push(JSON.parse(raw))}
  await new SessionActor().webSocketMessage(socket,message(operation()))
  assert.equal(output[0].code,"MASTER_REQUIRED")
})

test("stored display maxima cannot restore more than the configured limit",()=>{
  const state=before()
  state.entries[0].creatureSpellResources.slots[2]={current:1,max:99}
  const result=apply(state)
  assert.equal(result.ok,true)
  assert.deepEqual(result.session.entries[0].creatureSpellResources.slots[2],{current:2,max:2})
})
