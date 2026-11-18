import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
const built = await build({
  stdin: { contents: `
    export { SessionActor } from "./apps/session-server/src/routes/characters/inventory/InventorySessionActor";
    export { SessionActor as DeployedActor } from "./apps/session-server/src/routes/index";
    export { SessionActor as CoreActor } from "./apps/session-server/src/routes/session/SessionActor";
    export { CharacterTemplate } from "./apps/web/src/models/characters/CharacterTemplate";
    export { parseInventoryClientMessage } from "./apps/session-server/src/routes/characters/inventory/inventoryProtocol";
    export * from "./apps/web/src/models/items/PartyDepot";
    export { consumeSelectedSupplies } from "./apps/web/src/models/supplies/partySupply";
    export { planPartyDailySupplies } from "./apps/web/src/models/supplies/partyDailySupplies";
    export { applyGameOperation } from "./apps/web/src/models/game/applyGameOperation";
  `, loader: "ts", resolveDir: fileURLToPath(new URL("../../../", import.meta.url)) },
  bundle: true, platform: "node", format: "esm", write: false, plugins: [{ name: "workers", setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "workers" }))
    b.onLoad({ filter: /.*/, namespace: "workers" }, () => ({ contents: "export class DurableObject { constructor(ctx) { this.ctx = ctx } }" }))
  }}],
})
const { SessionActor, DeployedActor, CoreActor, CharacterTemplate, parseInventoryClientMessage, getPartyDepots, createPartyDepot, updatePartyDepot, setPartyDepotItems, getDailyDepotSupplies, applyDailyDepotSupplies, consumeSelectedSupplies, planPartyDailySupplies, applyGameOperation } =
  await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
const item = (id = "item", quantity = 4) => ({ id, name: "Carga", kind: "general", quantity, weight: 1 })
const food = amount => ({ id: "same-food-id", name: "Comida", kind: "supply", supplyCategory: "food", supplyUnitsPerItem: amount, quantity: 1 })
const settings = { enabled: true, useRaceMultipliers: true, shortageMode: "block", food: { enabled:true, portionsPerStandardRest:1, amountPerPortion:0.45, unit:"kg",label:"Comida" }, drink: { enabled:false, portionsPerStandardRest:1, amountPerPortion:4, unit:"L",label:"Água" } }
function setup() {
  const data = new Map([
    ["inventory-state", { initialized:true, revision:0, partyInventory:[item()], groundInventory:[], carryCapacity:100, additionalSupplyConsumption:1 }],
    ["runtime-config-state", { creationRevision:1, config:{longRestSupplies:settings} }],
  ])
  const sockets = ["MASTER","PLAYER"].map(role => ({ messages:[], deserializeAttachment:()=>({role,userId:role,lastHeartbeatAt:Date.now()}), send(raw){this.messages.push(JSON.parse(raw))} }))
  const storage={get:async key=>structuredClone(data.get(key)),put:async(key,value)=>{if(typeof key==="string")data.set(key,structuredClone(value));else for(const[k,v]of Object.entries(key))data.set(k,structuredClone(v))}}
  storage.transaction=async callback=>callback(storage)
  const actor=new SessionActor({storage,getWebSockets:()=>sockets})
  const send=async(operation,role=0)=>actor.handleInventoryOperation(sockets[role],sockets[role].deserializeAttachment(),{characterId:"session",...operation})
  return {data,sockets,send,actor,stock:()=>data.get("inventory-state")}
}
test("legacy shared items become the default named depot and metadata survives serialization", () => {
  const state={partyInventory:[item()],partyCarryCapacity:90,partyInventoryAccessible:false}
  assert.equal(getPartyDepots(state)[0].name,"Inventário do grupo")
  createPartyDepot(state,"ship","Navio")
  updatePartyDepot(state,"default",{name:"Casa",description:"Luskan"})
  updatePartyDepot(state,"ship",{carryCapacity:500,useForDailySupplies:false})
  const restored=JSON.parse(JSON.stringify(state))
  const depots=getPartyDepots(restored)
  assert.equal(depots[0].name,"Casa")
  assert.equal(depots[0].accessible,false)
  assert.equal(depots[0].carryCapacity,90)
  assert.deepEqual(depots[0].items,[item()])
  assert.equal(depots[1].carryCapacity,500)
  assert.equal(depots[1].useForDailySupplies,false)
  assert.equal(createPartyDepot(restored,"ship","Duplicado"),false)
})
test("masters create and rename depots without altering their contents; players cannot configure them",async()=>{
  const {send,stock,sockets}=setup()
  await send({type:"party.depot.create",depotId:"ship",name:"Navio"},1)
  assert.equal(sockets[1].messages.at(-1).code,"CHARACTER_ACCESS_DENIED")
  await send({type:"party.depot.create",depotId:"ship",name:"Navio"})
  await send({type:"party.item.add",depotId:"ship",item:item("cargo")})
  await send({type:"party.depot.update",depotId:"ship",patch:{name:"Agulha",description:"Escuna",carryCapacity:800,accessible:false}})
  assert.equal(getPartyDepots(stock())[1].name,"Agulha")
  assert.equal(getPartyDepots(stock())[1].items[0].id,"cargo")
  assert.equal(stock().partyInventory[0].id,"item")
})
test("server isolates item updates and blocks inaccessible depots for players, including forged transfers",async()=>{
  const {send,stock,sockets}=setup()
  await send({type:"party.depot.create",depotId:"ship",name:"Navio"})
  await send({type:"party.item.add",depotId:"ship",item:item("cargo")})
  await send({type:"party.depot.update",depotId:"ship",patch:{accessible:false}})
  for(const operation of [
    {type:"party.item.remove",depotId:"ship",itemId:"cargo"},
    {type:"party.item.update",depotId:"ship",itemId:"cargo",item:item("cargo",9)},
    {type:"party.item.add",depotId:"ship",item:item("bad")},
    {type:"inventory.item.transfer",request:{itemId:"cargo",quantity:1,from:{type:"party",depotId:"ship"},to:{type:"party"}}},
    {type:"inventory.item.transfer",request:{itemId:"item",quantity:1,from:{type:"party"},to:{type:"party",depotId:"ship"}}},
  ]) {
    await send(operation,1)
    assert.equal(sockets[1].messages.at(-1).code,"CHARACTER_ACCESS_DENIED")
  }
  assert.equal(getPartyDepots(stock())[1].items[0].quantity,4)
  await send({type:"party.item.update",depotId:"ship",itemId:"cargo",item:item("cargo",2)})
  assert.equal(getPartyDepots(stock())[1].items[0].quantity,2)
  assert.equal(stock().partyInventory[0].quantity,4)
})
test("accessible depot transfers still work when the default depot is unavailable",async()=>{
  const {send,stock,sockets}=setup()
  for(const id of ["ship","cart"])await send({type:"party.depot.create",depotId:id,name:id})
  await send({type:"party.depot.update",depotId:"default",patch:{accessible:false}})
  await send({type:"party.item.add",depotId:"ship",item:item("cargo",4)})
  await send({type:"inventory.item.transfer",request:{itemId:"cargo",quantity:2,destinationItemId:"moved",from:{type:"party",depotId:"ship"},to:{type:"party",depotId:"cart"}}},1)
  assert.notEqual(sockets[1].messages.at(-1)?.type,"session.error")
  assert.equal(getPartyDepots(stock()).find(d=>d.id==="ship").items[0].quantity,2)
  assert.equal(getPartyDepots(stock()).find(d=>d.id==="cart").items[0].quantity,2)
})
test("local transfers support character-to-depot and depot-to-depot without losing legacy stock",()=>{
  const state={schemaVersion:1,characters:[{id:"a",name:"A",inventory:[item("personal",2)]}],partyInventory:[item("legacy")]}
  createPartyDepot(state,"ship","Navio");createPartyDepot(state,"cart","Carroça")
  const moved=applyGameOperation(state,{type:"inventory.item.transfer",request:{itemId:"personal",quantity:1,destinationItemId:"moved",from:{type:"character",characterId:"a"},to:{type:"party",depotId:"ship"}}})
  assert.equal(moved.characters[0].inventory[0].quantity,1)
  assert.equal(getPartyDepots(moved)[1].items[0].quantity,1)
  const transferred=applyGameOperation(moved,{type:"inventory.item.transfer",request:{itemId:"moved",quantity:1,from:{type:"party",depotId:"ship"},to:{type:"party",depotId:"cart"}}})
  assert.equal(getPartyDepots(transferred)[1].items.length,0)
  assert.equal(getPartyDepots(transferred)[2].items.length,1)
  assert.deepEqual(transferred.partyInventory,state.partyInventory)
})
test("daily supplies draw only from accessible selected depots and preserve duplicate IDs across depots",()=>{
  const state={partyInventory:[food(10)]}
  for(const id of ["home","ship","cart"])createPartyDepot(state,id,id)
  setPartyDepotItems(state,"home",[food(100)])
  setPartyDepotItems(state,"ship",[food(2)])
  setPartyDepotItems(state,"cart",[food(30)])
  updatePartyDepot(state,"default",{accessible:false})
  updatePartyDepot(state,"home",{accessible:false})
  updatePartyDepot(state,"cart",{useForDailySupplies:false})
  const available=getDailyDepotSupplies(state)
  assert.equal(available.length,1)
  const plan=planPartyDailySupplies(available,{count:1,food:1,drink:1},0,settings)
  assert.equal(plan.error,null)
  applyDailyDepotSupplies(state,plan.consumption.items)
  assert.equal(getPartyDepots(state).find(d=>d.id==="ship").items[0].remainingSupplyUnits,1)
  assert.equal(getPartyDepots(state).find(d=>d.id==="home").items[0].remainingSupplyUnits,undefined)
  assert.equal(getPartyDepots(state).find(d=>d.id==="ship").items[0].id,"same-food-id")
  assert.equal(state.partyInventory[0].remainingSupplyUnits,undefined)
})
test("master daily debit uses depot sources server-side and creates an undo snapshot with every depot",async()=>{
  const {send,stock,data}=setup()
  await send({type:"party.depot.create",depotId:"ship",name:"Navio"})
  await send({type:"party.item.add",depotId:"ship",item:food(10)})
  await send({type:"party.depot.update",depotId:"default",patch:{accessible:false}})
  const revision=stock().revision
  await send({type:"party.supplies.day.consume",expectedRevision:revision})
  assert.equal(getPartyDepots(stock()).find(d=>d.id==="ship").items[0].remainingSupplyUnits,9)
  assert.deepEqual(stock().partyInventory,[item()])
  const logs=[...data.values()].find(value=>Array.isArray(value)&&value.some(record=>record.operation?.type==="party.supplies.day.consume"))
  assert.ok(logs)
  const undo=logs.find(record=>record.operation?.type==="party.supplies.day.consume").reverseOperation.snapshot.inventory
  assert.equal(getPartyDepots(undo).find(d=>d.id==="ship").items[0].remainingSupplyUnits,undefined)
})
test("rest selections cannot consume excluded supplies but map valid depot portions back correctly",()=>{
  const state={partyInventory:[food(20)]}
  createPartyDepot(state,"ship","Navio")
  setPartyDepotItems(state,"ship",[food(10)])
  updatePartyDepot(state,"default",{useForDailySupplies:false})
  const source=getDailyDepotSupplies(state)
  assert.equal(consumeSelectedSupplies(source,[{itemId:"same-food-id",portions:1}]).valid,false)
  const result=consumeSelectedSupplies(source,[{itemId:source[0].id,portions:1.5}])
  assert.equal(result.valid,true)
  applyDailyDepotSupplies(state,result.items)
  assert.equal(getPartyDepots(state)[1].items[0].remainingSupplyUnits,8.5)
  assert.equal(state.partyInventory[0].remainingSupplyUnits,undefined)
})
test("depot protocol validates bounded names, settings, IDs and rejects content injection",()=>{
  const parse=operation=>parseInventoryClientMessage(JSON.stringify({type:"session.inventory.operation",operation:{characterId:"session",...operation}}))
  assert.ok(parse({type:"party.depot.create",depotId:"ship",name:"Navio"}))
  assert.equal(parse({type:"party.depot.create",depotId:"ship",name:"  "}),null)
  assert.equal(parse({type:"party.depot.update",depotId:"ship",patch:{items:[]}}),null)
  assert.equal(parse({type:"party.depot.update",depotId:"ship",patch:{carryCapacity:-1}}),null)
  assert.equal(parse({type:"party.depot.update",depotId:"ship",patch:{accessible:"yes"}}),null)
})

test("authoritative long rests debit the chosen accessible depot, not the unavailable legacy inventory",async()=>{
  const {data,sockets,send,actor,stock}=setup()
  await send({type:"party.depot.create",depotId:"ship",name:"Navio"})
  await send({type:"party.item.add",depotId:"ship",item:food(10)})
  await send({type:"party.depot.update",depotId:"default",patch:{accessible:false}})
  const character=CharacterTemplate.fromJSON({id:"a",name:"A",sheet:{HP:{current:3,max:10,currentMax:10,temporary:0,hitDice:{}}}})
  data.set("abilities-state",{a:{characterId:"a",initialized:true,revision:1,character:character.toJSON()}})
  data.set("hp-state",{a:{characterId:"a",current:3,max:10,currentMax:10,temporary:0,maxHpBonus:0,hitDice:{},revision:1,attributesInitialized:false,savingThrowsInitialized:false,skillsInitialized:false,statsInitialized:false}})
  data.set("conditions-state",{a:{characterId:"a",initialized:true,conditions:[],revision:1}})
  data.get("runtime-config-state").config.customSystems=[]
  data.get("runtime-config-state").config.characters=[]
  const source=getDailyDepotSupplies(stock())
  await CoreActor.prototype.handleRestOperation.call(actor,sockets[0],sockets[0].deserializeAttachment(),{
    type:"character.rest.long",characterId:"a",recovery:"full",selection:[{itemId:source[0].id,portions:1}],
  })
  assert.equal(sockets[0].messages.some(message=>message.type==="session.error"),false)
  assert.equal(getPartyDepots(stock()).find(depot=>depot.id==="ship").items[0].remainingSupplyUnits,9)
  assert.deepEqual(stock().partyInventory,[item()])
  assert.equal(data.get("hp-state").a.current,10)
})

test("character moderators cannot bypass unavailable depot access through character transfer proxies",async()=>{
  const data=new Map([["inventory-state",{partyInventory:[],partyInventoryAccessible:false}]])
  const storage={get:async key=>data.get(key)}
  const connection={role:"PLAYER",userId:"moderator",canWriteAnyCharacter:true,lastHeartbeatAt:Date.now()}
  const socket={messages:[],deserializeAttachment:()=>connection,send(raw){this.messages.push(JSON.parse(raw))}}
  const actor=new DeployedActor({storage,getWebSockets:()=>[socket]})
  await actor.webSocketMessage(socket,JSON.stringify({
    type:"session.inventory.operation",
    operation:{type:"inventory.item.transfer",characterId:"a",request:{itemId:"x",quantity:1,from:{type:"character",characterId:"a"},to:{type:"party"}}},
  }))
  assert.equal(socket.messages.at(-1).code,"CHARACTER_ACCESS_DENIED")
})

test("legacy travel rations retain their supply semantics inside named depots",()=>{
  const state={partyInventory:[]}
  createPartyDepot(state,"ship","Navio")
  setPartyDepotItems(state,"ship",[{id:"compendium-rations",name:"Rações",kind:"supply",quantity:2}])
  const plan=planPartyDailySupplies(getDailyDepotSupplies(state),{count:1,food:1,drink:1},0,settings)
  assert.equal(plan.error,null)
  applyDailyDepotSupplies(state,plan.consumption.items)
  assert.equal(getPartyDepots(state)[1].items[0].id,"compendium-rations")
  assert.equal(getPartyDepots(state)[1].items[0].remainingSupplyUnits,1)
})
