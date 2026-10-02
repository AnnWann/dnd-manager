import type { ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Select } from "../../components/ui/Select"
import type { CustomFieldDefinition, CustomReferenceSource } from "../../models/customSystems/CustomFieldDefinition"
import type { CustomSystemItemTypeDefinition } from "../../models/customSystems/CustomItemTypeDefinition"
import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"

export function CustomSystemItemTypesEditor({draft,setDraft}:{draft:CustomSystemDefinition;setDraft:(value:CustomSystemDefinition)=>void}) {
  const types=draft.itemTypes??[]
  const setTypes=(itemTypes:CustomSystemItemTypeDefinition[])=>setDraft({...draft,itemTypes})
  const replace=(index:number,value:CustomSystemItemTypeDefinition)=>setTypes(types.map((entry,i)=>i===index?value:entry))
  const add=()=>{const id=uniqueId("tipo-item",types.map(t=>t.id));setTypes([...types,{id,name:"Novo tipo de item",fields:[]}])}
  return <div className="grid gap-4">
    <div className="rounded-lg border border-border bg-bg-subtle p-3 text-sm text-text">Tipos classificam itens sem substituir o tipo nativo do inventário. Cada tipo pode definir seus próprios campos; referências podem ser limitadas a outro tipo de item.</div>
    <div><Button onClick={add}><Plus className="h-4 w-4"/> Novo tipo de item</Button></div>
    {types.map((type,index)=><article key={type.id} className="grid gap-4 rounded-xl border border-border p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input label="Nome" value={type.name} onChange={name=>replace(index,{...type,name})}/>
        <Input label="ID" value={type.id} onChange={id=>replace(index,{...type,id:slugify(id)})}/>
        <div className="flex items-end"><Danger onClick={()=>setTypes(types.filter((_,i)=>i!==index))}><Trash2 className="h-4 w-4"/></Danger></div>
      </div>
      <Input label="Descrição" value={type.description??""} onChange={description=>replace(index,{...type,description:description||undefined})}/>
      <FieldSchema fields={type.fields} itemTypes={types} onChange={fields=>replace(index,{...type,fields})}/>
    </article>)}
  </div>
}

function FieldSchema({fields,itemTypes,onChange}:{fields:CustomFieldDefinition[];itemTypes:CustomSystemItemTypeDefinition[];onChange:(fields:CustomFieldDefinition[])=>void}) {
  const add=(kind:"text"|"number"|"boolean"|"reference"|"quantityReference"|"collectionGroup")=>{
    const id=uniqueId("campo",fields.map(f=>f.id))
    const base={id,name:"Novo campo"}
    const field:CustomFieldDefinition=kind==="reference"?{...base,type:"reference",targets:[{type:"compendiumItem"}]}
      :kind==="quantityReference"?{...base,type:"quantityReference",targets:[{type:"compendiumItem"}],minimumQuantity:1}
      :kind==="collectionGroup"?{...base,type:"collectionGroup",fields:[]}
      :kind==="number"?{...base,type:"number"}
      :kind==="boolean"?{...base,type:"boolean"}
      :{...base,type:"text"}
    onChange([...fields,field])
  }
  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-textH">Campos do tipo</strong><div className="flex flex-wrap gap-1">
      <Button onClick={()=>add("text")}>Texto</Button><Button onClick={()=>add("number")}>Número</Button><Button onClick={()=>add("boolean")}>Sim/Não</Button><Button onClick={()=>add("reference")}>Referência</Button><Button onClick={()=>add("quantityReference")}>Referência quantitativa</Button><Button onClick={()=>add("collectionGroup")}>Agrupado</Button>
    </div></div>
    {fields.map((field,index)=><div key={field.id} className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_170px_auto]">
        <Input label="Nome" value={field.name} onChange={name=>onChange(fields.map((f,i)=>i===index?{...f,name}:f))}/>
        <Input label="ID" value={field.id} onChange={id=>onChange(fields.map((f,i)=>i===index?{...f,id:slugify(id)}:f))}/>
        <div className="grid gap-1 text-xs text-text"><span>Tipo</span><div className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH">{field.type}</div></div>
        <div className="flex items-end"><Danger onClick={()=>onChange(fields.filter((_,i)=>i!==index))}><Trash2 className="h-4 w-4"/></Danger></div>
      </div>
      {(field.type==="reference"||field.type==="quantityReference")?<ReferenceTargetEditor targets={field.targets??[]} itemTypes={itemTypes} onChange={targets=>onChange(fields.map((f,i)=>i===index?{...field,targets}:f))}/>:null}
      {field.type==="collectionGroup"?<div className="ml-3 border-l border-border pl-3"><FieldSchema fields={field.fields} itemTypes={itemTypes} onChange={nested=>onChange(fields.map((f,i)=>i===index?{...field,fields:nested}:f))}/></div>:null}
    </div>)}
  </div>
}

function ReferenceTargetEditor({targets,itemTypes,onChange}:{targets:CustomReferenceSource[];itemTypes:CustomSystemItemTypeDefinition[];onChange:(targets:CustomReferenceSource[])=>void}) {
  const selected=targets.find(t=>t.type==="itemType")
  const value=selected&&"itemTypeId" in selected?selected.itemTypeId:""
  return <label className="grid gap-1 text-xs text-text"><span>Restringir a tipo de item</span><Select className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" value={value} onChange={e=>{
    const rest=targets.filter(t=>t.type!=="itemType")
    onChange(e.target.value?[...rest,{type:"itemType",itemTypeId:e.target.value}]:rest.length?rest:[{type:"compendiumItem"}])
  }}><option value="">Qualquer item permitido</option>{itemTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></label>
}
function Input({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="grid gap-1 text-xs text-text"><span>{label}</span><input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textH" value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Button({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-textH hover:bg-accentBg">{children}</button>}
function Danger({children,onClick}:{children:ReactNode;onClick:()=>void}){return <button type="button" onClick={onClick} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10">{children}</button>}
function slugify(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function uniqueId(base:string,ids:string[]){let id=base,n=2;while(ids.includes(id))id=`${base}-${n++}`;return id}
