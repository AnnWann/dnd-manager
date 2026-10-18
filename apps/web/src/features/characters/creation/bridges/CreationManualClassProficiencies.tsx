import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import type { Proficiency } from "../../../../models/sheet/Proficiency"
import { GrantedProficienciesEditor } from "../../proficiencies/grantedProficienciesEditor"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

type Props = {
  open: boolean
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
}

export function CreationManualClassProficiencies({
  open,
  proficiencies,
  onChange,
}: Props) {
  const [mount, setMount] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      setMount(null)
      return
    }

    let frame = 0
    let observer: MutationObserver | undefined

    const syncMount = () => {
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      const heading = Array.from(main?.querySelectorAll<HTMLElement>("h2") ?? [])
        .find((entry) =>
          /classe inicial e distribuição de níveis/i.test(
            entry.textContent?.trim() ?? "",
          ),
        )

      if (!main || !heading) {
        setMount(null)
        return
      }

      const existing = main.querySelector<HTMLElement>(
        '[data-manual-class-proficiencies="true"]',
      )
      if (existing) {
        setMount(existing)
        return
      }

      const container = document.createElement("div")
      container.dataset.manualClassProficiencies = "true"
      const section = heading.closest("section")
      section?.insertAdjacentElement("afterend", container)
      setMount(container)
    }

    frame = window.requestAnimationFrame(() => {
      syncMount()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(syncMount)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      const root = findCharacterCreationRoot()
      root
        ?.querySelector('[data-manual-class-proficiencies="true"]')
        ?.remove()
      setMount(null)
    }
  }, [open])

  if (!mount) return null

  return createPortal(
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <GrantedProficienciesEditor
        proficiencies={proficiencies}
        onChange={onChange}
        title="Proficiências concedidas pelas classes"
        description="Consulte sua referência e adicione somente as proficiências que as classes realmente concedem. O aplicativo não preenche esta lista automaticamente."
        emptyMessage="Nenhuma proficiência de classe adicionada."
      />
    </section>,
    mount,
  )
}
