import { useEffect } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import { GrantedProficienciesEditor } from "./grantedProficienciesEditor"

type Props = {
  open: boolean
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
  onClose: () => void
  title?: string
  description?: string
}

export function ProficiencySelectionModal({
  open,
  proficiencies,
  onChange,
  onClose,
  title = "Adicionar proficiências",
  description =
    "Consulte sua referência e adicione apenas as proficiências recebidas. Perícias podem ser marcadas como expertise.",
}: Props) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[12500] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              {description}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4">
          <GrantedProficienciesEditor
            proficiencies={proficiencies}
            onChange={onChange}
            title="Proficiências configuradas"
            description="Adicione perícias, salvaguardas, armas, armaduras, idiomas, ferramentas ou outras proficiências."
            emptyMessage="Nenhuma proficiência adicionada."
          />
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
