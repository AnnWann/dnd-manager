import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Input } from "../../../../components/ui/Input"
import { ALL_CLASS_NAMES, getClassProgression } from "../../../../data/classProgression"
import type { ClassName } from "../../../../models/sheet/Class"
import { findCharacterCreationRoot } from "../logic/characterCreationStepValidation"

export type ManualSubclassSelection = {
  name: string
  source: string
}

type Props = {
  open: boolean
  selections: Partial<Record<ClassName, ManualSubclassSelection>>
  onChange: (
    className: ClassName,
    selection: ManualSubclassSelection,
  ) => void
}

type Mount = {
  className: ClassName
  element: HTMLElement
}

export function CreationManualSubclassEditor({
  open,
  selections,
  onChange,
}: Props) {
  const [mounts, setMounts] = useState<Mount[]>([])

  useEffect(() => {
    if (!open) {
      setMounts([])
      return
    }

    let frame = 0
    let observer: MutationObserver | undefined

    const syncMounts = () => {
      const root = findCharacterCreationRoot()
      const main = root?.querySelector<HTMLElement>("main")
      if (!main) {
        setMounts([])
        return
      }

      const next: Mount[] = []
      const classSections = Array.from(main.querySelectorAll<HTMLElement>("section"))

      for (const section of classSections) {
        const heading = section.querySelector<HTMLElement>(":scope > div h2, :scope > h2")
        const className = resolveClassName(heading?.textContent ?? "")
        if (!className) continue

        let mount = section.querySelector<HTMLElement>(
          `:scope > [data-manual-subclass-for="${className}"]`,
        )
        if (!mount) {
          mount = document.createElement("div")
          mount.dataset.manualSubclassFor = className
          const header = section.querySelector<HTMLElement>(":scope > div")
          if (header) header.insertAdjacentElement("afterend", mount)
          else section.prepend(mount)
        }
        next.push({ className, element: mount })
      }

      setMounts(next)
    }

    frame = window.requestAnimationFrame(() => {
      syncMounts()
      const root = findCharacterCreationRoot()
      if (!root) return
      observer = new MutationObserver(syncMounts)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      findCharacterCreationRoot()
        ?.querySelectorAll('[data-manual-subclass-for]')
        .forEach((element) => element.remove())
      setMounts([])
    }
  }, [open])

  return (
    <>
      {mounts.map(({ className, element }) => {
        const selection = selections[className] ?? { name: "", source: "" }
        return createPortal(
          <div className="mt-4 grid gap-3 rounded-lg border border-border bg-bg p-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs text-text">
              Subclasse (manual)
              <Input
                value={selection.name}
                placeholder="Digite conforme sua referência"
                onChange={(event) =>
                  onChange(className, {
                    ...selection,
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs text-text">
              Fonte / livro (opcional)
              <Input
                value={selection.source}
                placeholder="Sua referência"
                onChange={(event) =>
                  onChange(className, {
                    ...selection,
                    source: event.target.value,
                  })
                }
              />
            </label>
          </div>,
          element,
          className,
        )
      })}
    </>
  )
}

function resolveClassName(text: string): ClassName | undefined {
  const normalized = text.trim()
  return ALL_CLASS_NAMES.find((className) =>
    normalized.startsWith(`${getClassProgression(className).label} `),
  )
}
