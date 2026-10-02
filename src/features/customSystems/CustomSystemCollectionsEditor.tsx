import { Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import type { CustomFieldDefinition, CustomFieldType } from "../../models/customSystems/CustomFieldDefinition"
import type { CustomCollectionDefinition } from "../../models/customSystems/CustomCollectionDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"

const FIELD_TYPES: CustomFieldType[] = ["text","number","boolean","richText","reference"]

export function CustomSystemCollectionsEditor({ draft, setDraft }: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
}) {
  const collections = draft.collections ?? []
  const setCollections = (next: CustomCollectionDefinition[]) => setDraft({ ...draft, collections: next })
  const replace = (index: number, next: CustomCollectionDefinition) => setCollections(collections.map((c,i)=>i===index?next:c))

  function addCollection() {
    const id = uniqueId("collection", collections.map(c=>c.id))
    setCollections([...collections, { id, name: "Nova coleção", fields: [], permissions: { create: "ownerAndMaster", remove: "ownerAndMaster" }, display: { layout: "cards" } }])
  }

  return <div className="grid gap-4">
    <div className="rounded-lg border border-border bg-bg-subtle p-3 text-sm text-text">
      Coleções são registros repetíveis sem significado imposto pelo site. Use-as para projetos, pesquisas, ferimentos, missões, tripulação ou qualquer outra estrutura que precise de várias instâncias.
    </div>
    <div><Button onClick={addCollection}><Plus className="h-4 w-4"/> Nova coleção</Button></div>
    {collections.map((collection,index)=><article key={collection.id} className="grid gap-4 rounded-xl border border-border p-4">
      <div className="flex gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-2">
          <Input label="Nome" value={collection.name} onChange={name=>replace(index,{...collection,name})}/>
          <Input label="ID" value={collection.id} onChange={id=>replace(index,{...collection,id:slugify(id)})}/>
          <Input label="Descrição" value={collection.description??""} onChange={description=>replace(index,{...collection,description:description||undefined})}/>
          <Select label="Layout" value={collection.display?.layout??"cards"} options={["cards","list","compact"]} onChange={layout=>replace(index,{...collection,display:{...collection.display,layout:layout as any}})}/>
        </div>
        <IconButton onClick={()=>setCollections(collections.filter((_,i)=>i!==index))}><Trash2 className="h-4 w-4"/></IconButton>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between"><strong className="text-sm text-textH">Campos de cada registro</strong><Button onClick={()=>{
          const id=uniqueId("campo",collection.fields.map(f=>f.id))
          replace(index,{...collection,fields:[...collection.fields,{id,name:"Novo campo",type:"text"}]})
        }}><Plus className="h-3.5 w-3.5"/> Campo</Button></div>
        <div className="grid gap-2">
          {collection.fields.map((field,fi)=><div key={field.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_160px_auto]">
            <Input label="Nome" value={field.name} onChange={name=>replaceField(index,fi,{...field,name},collections,setCollections)}/>
            <Input label="ID" value={field.id} onChange={id=>replaceField(index,fi,{...field,id:slugify(id)},collections,setCollections)}/>
            <Select label="Tipo" value={field.type} options={FIELD_TYPES} onChange={type=>replaceField(index,fi,makeField(field,type as CustomFieldType),collections,setCollections)}/>
            <div className="flex items-end"><IconButton onClick={()=>replace(index,{...collection,fields:collection.fields.filter((_,i)=>i!==fi)})}><Trash2 className="h-4 w-4"/></IconButton></div>
          </div>)}
          {!collection.fields.length?<div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text">Adicione os campos que cada registro desta coleção deve possuir.</div>:null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Select label="Campo de título" value={collection.display?.titleFieldId??""} options={["",...collection.fields.map(f=>f.id)]} onChange={titleFieldId=>replace(index,{...collection,display:{...collection.display,titleFieldId:titleFieldId||undefined}})}/>
        <Select label="Quem pode criar" value={collection.permissions?.create??"ownerAndMaster"} options={["owner","masterOnly","ownerAndMaster","automaticOnly"]} onChange={create=>replace(index,{...collection,permissions:{...collection.permissions,create:create as any}})}/>
        <Select label="Quem pode remover" value={collection.permissions?.remove??"ownerAndMaster"} options={["owner","masterOnly","ownerAndMaster","automaticOnly"]} onChange={remove=>replace(index,{...collection,permissions:{...collection.permissions,remove:remove as any}})}/>
      </div>
    </article>)}
  </div>
}

function replaceField(ci:number,fi:number,field:CustomFieldDefinition,collections:CustomCollectionDefinition[],set:(v:CustomCollectionDefinition[])=>void){
  set(collections.map((c,i)=>i===ci?{...c,fields:c.fields.map((f,j)=>j===fi?field:f)}:c))
}
function makeField(old:CustomFieldDefinition,type:CustomFieldType):CustomFieldDefinition{
  const base={id:old.id,name:old.name,description:old.description,required:old.required,editPermission:old.editPermission}
  if(type==="number") return {...base,type:"number"}
  if(type==="boolean") return {...base,type:"boolean"}
  if(type==="richText") return {...base,type:"richText"}
  if(type==="reference") return {...base,type:"reference",target:"item"}
  return {...base,type:"text"}
}
function Input({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}){return <label className="grid gap-1 text-xs text-text"><span>{label}</span><input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Select({label,value,options,onChange}:{label:string,value:string,options:readonly string[],onChange:(v:string)=>void}){return <label className="grid gap-1 text-xs text-text"><span>{label}</span><select className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o} value={o}>{o||"Nenhum"}</option>)}</select></label>}
function Button({children,onClick}:{children:ReactNode,onClick:()=>void}){return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textH hover:bg-accentBg">{children}</button>}
function IconButton({children,onClick}:{children:ReactNode,onClick:()=>void}){return <button type="button" onClick={onClick} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10">{children}</button>}
function slugify(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function uniqueId(base:string,ids:string[]){let id=base,n=2;while(ids.includes(id))id=`${base}-${n++}`;return id}
