import type { ReactNode } from "react"
import { FileImage } from "lucide-react"

/** Shared gallery layout; a sheet is reachable only when the caller supplies onOpen. */
export function CreaturePortraitCard({ name, imageUrl, onOpen, children, actions }: {
  name: string
  imageUrl?: string
  onOpen?: () => void
  children?: ReactNode
  actions?: ReactNode
}) {
  const content = <>
    <div className="aspect-[16/9] w-full overflow-hidden border-b border-border bg-bg-subtle">
      {imageUrl ? <img src={imageUrl} alt={name} className="h-full w-full object-contain object-center" />
        : <div className="flex h-full items-center justify-center"><FileImage className="h-10 w-10 text-textMuted" /></div>}
    </div>
    <div className="grid gap-3 p-4">
      <h2 className="font-heading text-base font-semibold text-textH">{name}</h2>
      {children}
    </div>
  </>
  return <article className="overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm">
    {onOpen ? <button type="button" aria-label={`Abrir ficha de ${name}`} onClick={onOpen} className="block w-full text-left transition-colors hover:bg-bg-subtle">{content}</button> : content}
    {actions ? <div className="flex justify-end border-t border-border px-3 py-2">{actions}</div> : null}
  </article>
}
