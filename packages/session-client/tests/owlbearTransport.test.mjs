import assert from "node:assert/strict"
import test from "node:test"
import { SessionTransport } from "../src/sessionTransport.ts"
const tick=()=>new Promise(resolve=>setImmediate(resolve))
test("Owlbear watchdog retries stalled connections, renews tokens, detects lost heartbeats and stops on kick",async()=>{
 const originals={WebSocket:globalThis.WebSocket,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout}
 const timers=new Map();let timerId=0
 class Socket {
   static OPEN=1;static CLOSING=2;static instances=[]
   readyState=0;sent=[]
   constructor(url){this.url=url;Socket.instances.push(this)}
   send(raw){this.sent.push(JSON.parse(raw))}
   receive(raw){this.onmessage?.({data:JSON.stringify(raw)})}
   close(code){this.readyState=3;this.onclose?.({code})}
 }
 globalThis.WebSocket=Socket
 globalThis.setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id}
 globalThis.clearTimeout=id=>timers.delete(id)
 const fire=delay=>{
   const entry=[...timers].find(([,timer])=>typeof delay==="function"?delay(timer.delay):timer.delay===delay)
   assert.ok(entry,"expected timer")
   timers.delete(entry[0]);entry[1].fn()
 }
 const statuses=[];let tokens=0,kicks=0
 const transport=new SessionTransport({
   baseUrl:"https://session.test",sessionId:"campaign",userId:"user",role:"PLAYER",clientId:"same-client",useTokenAuth:true,tokenEndpoint:"",
   healthTimeoutMs:15000,getConnectionToken:async()=>"token-"+(++tokens),onStatusChange:value=>statuses.push(value),
   onMessage:()=>{},onKicked:()=>kicks++,
 })
 try{
   transport.connect();await tick()
   assert.equal(Socket.instances.length,1)
   fire(15000) // handshake stalled
   assert.equal(statuses.at(-1),"reconnecting")
   fire(1000);await tick()
   const socket=Socket.instances.at(-1)
   assert.equal(new URL(socket.url).searchParams.get("token"),"token-2")
   socket.readyState=1;socket.receive({type:"session.ready"})
   assert.equal(statuses.at(-1),"connected")
   fire(delay=>delay>=27000&&delay<=33000)
   assert.equal(socket.sent.at(-1).clientId,"same-client")
   socket.receive({type:"session.heartbeat.ack"})
   assert.equal([...timers.values()].some(timer=>timer.delay===15000),false)
   fire(delay=>delay>=27000&&delay<=33000)
   fire(15000) // heartbeat response lost
   assert.equal(statuses.at(-1),"reconnecting")
   fire(1000);await tick()
   const last=Socket.instances.at(-1)
   last.readyState=1;last.receive({type:"session.ready"})
   last.close(4002)
   assert.equal(kicks,1)
   assert.equal(timers.size,0)
   transport.disconnect()
 }finally{
   transport.disconnect()
   Object.assign(globalThis,originals)
 }
})
