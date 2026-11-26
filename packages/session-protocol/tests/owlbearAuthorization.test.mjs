import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
process.env.BETTER_AUTH_SECRET="test-owlbear-session-secret"
const built=await build({
 entryPoints:[fileURLToPath(new URL("../../../apps/web/api/owlbear.ts",import.meta.url))],
 bundle:true,platform:"node",format:"esm",write:false,
 plugins:[{name:"auth-database",setup(b){
   b.onResolve({filter:/server\/auth\.js$/},()=>({path:"auth",namespace:"mock"}))
   b.onResolve({filter:/server\/prisma\.js$/},()=>({path:"prisma",namespace:"mock"}))
   b.onResolve({filter:/generated\/prisma\/client\.js$/},()=>({path:"enums",namespace:"mock"}))
   b.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:args.path==="auth"?
     "export const auth={api:{getSession:async()=>globalThis.__owlAuth}}":
     args.path==="prisma"?
     "export const prisma={session:{findUnique:async()=>globalThis.__owlDbSession},campaign:{findUnique:async()=>globalThis.__owlCampaign}}":
     'export const CampaignRole={MASTER:"MASTER",PLAYER:"PLAYER",MODERATOR:"MODERATOR"}; export const CampaignMemberStatus={ACTIVE:"ACTIVE"};export const CampaignSpellApprovalStatus={APPROVED:"APPROVED"};export const HomebrewSpellStatus={ACTIVE:"ACTIVE"};'}))
 }}],
})
const {GET,POST}=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].contents).toString("base64"))
const extension="https://dnd-manager-seven.vercel.app",site="https://manager.test"
function identity(userId){
 const expiresAt=new Date(Date.now()+7*86400000)
 globalThis.__owlAuth={user:{id:userId},session:{id:"auth-"+userId,expiresAt}}
 globalThis.__owlDbSession={userId,expiresAt}
 globalThis.__owlCampaign={ownerId:"master",name:"Campanha",members:userId==="master"?[]:[{role:"PLAYER"}]}
}
async function authorize(){
 const response=await POST(new Request(site+"/api/owlbear?op=authorize",{method:"POST",headers:{Origin:site,"Content-Type":"application/json"},body:JSON.stringify({extensionOrigin:extension})}))
 assert.equal(response.status,200)
 return (await response.json()).token
}
const request=(token,params)=>GET(new Request(site+"/api/owlbear?"+params,{headers:{Origin:extension,Authorization:"Bearer "+token}}))
test("remembered authorization is bounded by the actual login session and renews without cookies",async()=>{
 identity("master")
 const token=await authorize()
 const payload=JSON.parse(Buffer.from(token.split(".")[0],"base64url").toString())
 assert.ok(payload.expires>Date.now()+15*60000)
 assert.ok(payload.expires<=globalThis.__owlDbSession.expiresAt.getTime())
 const refresh=await request(token,"op=refresh")
 assert.equal(refresh.status,200)
 const account=await refresh.json()
 assert.equal(account.userId,"master")
 assert.ok(account.expiresAt<=globalThis.__owlDbSession.expiresAt.getTime())
 globalThis.__owlDbSession=null
 assert.equal((await request(account.token,"op=refresh")).status,401)
})
test("only campaign masters can sign a room binding; players resolve it using their own account",async()=>{
 identity("master")
 const masterToken=await authorize()
 const signed=await request(masterToken,"op=bind-room&sessionId=campaign&roomId=room")
 assert.equal(signed.status,200)
 const {binding}=await signed.json()
 assert.equal(binding.sessionId,"campaign")
 assert.equal(binding.token,undefined)
 identity("player")
 const playerToken=await authorize()
 assert.equal((await request(playerToken,"op=bind-room&sessionId=campaign&roomId=room")).status,403)
 const params="op=resolve-room&roomId=room&binding="+encodeURIComponent(JSON.stringify(binding))
 assert.equal((await request(playerToken,params)).status,200)
 assert.equal((await request(playerToken,params.replace("roomId=room","roomId=other"))).status,400)
 assert.equal((await request(playerToken,"op=resolve-room&roomId=room&binding="+encodeURIComponent(JSON.stringify({...binding,sessionId:"private"})))).status,400)
 globalThis.__owlCampaign={ownerId:"master",name:"Campanha",members:[]}
 assert.equal((await request(playerToken,params)).status,403)
})
