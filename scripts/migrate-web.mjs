import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync,rmSync,cpSync} from "node:fs"
import {dirname,join,relative,resolve,sep} from "node:path"
const toMove=["src","api","api-handlers","server","public","prisma","index.html","vite.config.ts","tsconfig.json","tsconfig.app.json","tsconfig.node.json","prisma.config.ts","postcss.config.cjs","tailwind.config.js"]
if(!existsSync("src")||existsSync("apps/web/src"))throw Error("unexpected website migration state")
const pathMap=new Map([...toMove,"generated"].map(p=>[resolve(p),resolve("apps/web",p)]))
function relocate(p){for(const [a,b] of pathMap)if(p===a||p.startsWith(a+sep))return b+p.slice(a.length);return p}
function walk(dir,out){if(!existsSync(dir))return;for(const e of readdirSync(dir,{withFileTypes:true})){if(["node_modules","dist",".git"].includes(e.name))continue;const p=join(dir,e.name);if(e.isDirectory())walk(p,out);else if(e.isFile())out.push(p)}}
for(const p of ["src","api","api-handlers","server"])cpSync(p,"apps/web/"+p,{recursive:true,force:true})
const files=[];for(const d of ["src","api","api-handlers","server","apps/session-server/src","packages","scripts"])walk(d,files)
const imp=/(\b(?:from\s*|import\s*\(|import\s*|require\s*\()\s*["'])(\.{1,2}\/[^"']+)(["'])/g
for(const file of files){if(!/\.(?:ts|tsx|js|jsx|mjs|mts|cts)$/.test(file))continue;const abs=resolve(file),target=relocate(abs),original=readFileSync(abs,"utf8")
const code=original.replace(imp,(whole,a,spec,b)=>{const oldTarget=resolve(dirname(abs),spec);const newTarget=relocate(oldTarget);let path=relative(dirname(target),newTarget).replaceAll("\\","/");if(!path.startsWith("."))path="./"+path;return a+path+b})
if(target!==abs){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,code)}
else if(code!==original)writeFileSync(abs,code)
}
for(const p of toMove){const origin=resolve(p),target=resolve("apps/web",p);if(!existsSync(origin))continue;mkdirSync(dirname(target),{recursive:true});if(existsSync(target)){if(["src","api","api-handlers","server"].includes(p)){rmSync(origin,{recursive:true,force:true});continue}throw Error("destination conflict: "+p)}renameSync(origin,target)}
const ts="apps/web/tsconfig.app.json";let t=readFileSync(ts,"utf8");t=t.replace('"include": ["./"]','"include": ["src/**/*"]');writeFileSync(ts,t)
const fallbackTs=t.replace('"include": ["src/**/*"]', '"include": ["apps/web/src/**/*", "packages/**/*"]').replace('"./node_modules/.tmp/tsconfig.app.tsbuildinfo"', '"./node_modules/.tmp/root-tsconfig.app.tsbuildinfo"')
writeFileSync("tsconfig.app.json",fallbackTs)
for(const file of ["scripts/check-compendium-volumes.mjs","scripts/check-native-selects.mjs","scripts/check-user-workspace-boundaries.mjs","scripts/check-vercel-functions.mjs","scripts/audit-workspace-imports.mjs"]){let s=readFileSync(file,"utf8");s=s.replaceAll('"src/','"apps/web/src/').replaceAll('"api/','"apps/web/api/').replaceAll('path.resolve("src")','path.resolve("apps/web/src")').replaceAll('path.resolve("api")','path.resolve("apps/web/api")')
if(file.includes("audit-workspace-imports"))s=s.replace('"src", "api", "api-handlers", "server",','"apps/web/src", "apps/web/api", "apps/web/api-handlers", "apps/web/server",')
writeFileSync(file,s)}
const w="apps/web/package.json",web=JSON.parse(readFileSync(w,"utf8"))
web.dependencies={...web.dependencies,"@dnd-manager/game-ui":"0.1.0","@dnd-manager/game-core":"0.1.0"}
web.scripts={dev:"vite",build:"npm --prefix ../.. run check:compendium-volumes && npm --prefix ../.. run check:user-workspace-boundaries && npm --prefix ../.. run check:vercel-functions && npm --prefix ../.. run check:native-selects && tsc -b && vite build",lint:"eslint .",preview:"vite preview"}
writeFileSync(w,JSON.stringify(web,null,2)+"\n")
const root="package.json",pkg=JSON.parse(readFileSync(root,"utf8"))
for(const name of ["dev","dev:vite","lint","preview","build"])pkg.scripts[name]="npm run --workspace @dnd-manager/web "+(name==="dev:vite"?"dev":name)
for(const name of ["prisma:generate","prisma:migrate:deploy","postinstall"]){const command=name==="prisma:migrate:deploy"?"migrate deploy":"generate";pkg.scripts[name]="prisma "+command+" --config apps/web/prisma.config.ts"}
writeFileSync(root,JSON.stringify(pkg,null,2)+"\n")
const boundary="scripts/check-workspace-layout.mjs";let check=readFileSync(boundary,"utf8").replace('assert.equal(web.scripts.build, "npm --prefix ../.. run build")','assert.ok(web.scripts.build.includes("vite build"))');writeFileSync(boundary,check)
const vercelPath="vercel.json",vercel=JSON.parse(readFileSync(vercelPath,"utf8"));vercel.buildCommand="npm run build:app-web";vercel.outputDirectory="apps/web/dist";writeFileSync(vercelPath,JSON.stringify(vercel,null,2)+"\n")
console.log("Physical website migration staged")
