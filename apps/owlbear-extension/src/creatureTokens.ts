import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"

/** Creature footprints in grid cells, accepting the compendium's Portuguese names and imports. */
export function creatureTokenCells(size: string): number {
  const normalized = size.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  if (["grande", "large"].includes(normalized)) return 2
  if (["enorme", "huge"].includes(normalized)) return 3
  if (["imenso", "colossal", "gigantesco", "gargantuan"].includes(normalized)) return 4
  return 1
}
export function creatureTokenQuantity(creature: Pick<CompendiumCreature, "unique">, quantity: number): number {
  return creature.unique ? 1 : Math.min(50, Math.max(1, Math.trunc(Number.isFinite(quantity) ? quantity : 1)))
}
export function tokenBatchPositions(count: number, cells: number, dpi: number, center: {x:number;y:number}) {
  const columns=Math.ceil(Math.sqrt(count)), rows=Math.ceil(count/columns), spacing=(cells+0.25)*dpi
  return Array.from({length:count},(_,index)=>({
    x:center.x+(index%columns-(columns-1)/2)*spacing,
    y:center.y+(Math.floor(index/columns)-(rows-1)/2)*spacing,
  }))
}
export async function loadCreatureImage(url: string): Promise<{url:string;mime:string;width:number;height:number}> {
  if (!/^(https?:\/\/|data:image\/)/i.test(url)) throw Error("Cadastre uma imagem válida para a criatura no compêndio.")
  return new Promise((resolve,reject)=>{
    const image=new Image()
    const timer=setTimeout(()=>{image.src="";reject(Error("A imagem demorou para carregar. Verifique o endereço no compêndio."))},15000)
    image.onload=()=>{
      clearTimeout(timer)
      if(!image.naturalWidth||!image.naturalHeight){reject(Error("A imagem da criatura está vazia."));return}
      const mime=url.startsWith("data:")?url.slice(5,url.indexOf(";")):/\.jpe?g(?:[?#]|$)/i.test(url)?"image/jpeg":/\.webp(?:[?#]|$)/i.test(url)?"image/webp":/\.svg(?:[?#]|$)/i.test(url)?"image/svg+xml":"image/png"
      resolve({url,mime,width:image.naturalWidth,height:image.naturalHeight})
    }
    image.onerror=()=>{clearTimeout(timer);reject(Error("Não foi possível carregar a imagem da criatura. Confira a imagem no compêndio."))}
    image.src=url
  })
}
