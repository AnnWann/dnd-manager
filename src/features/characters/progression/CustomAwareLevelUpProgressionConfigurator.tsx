import { useEffect, useRef, useState } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  createCustomClassRuntimeId,
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
  isCustomClassName,
} from "../../../models/characters/customClassConfig"
import type { ClassName } from "../../../models/sheet/Class"
import { CustomClassLevelUpConfigurator } from "./CustomClassLevelUpConfigurator"
import { LevelUpProgressionConfigurator } from "./LevelUpProgressionConfigurator"

const NEW_CUSTOM_LEVEL_UP_OPTION = "__dnd_new_custom_class__"

type Props = {
  character: CharacterTemplate
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

export function CustomAwareLevelUpProgressionConfigurator({
  character,
  primaryClassName,
  onCancel,
  onComplete,
}: Props) {
  const initialClass =
    primaryClassName ?? character.get("sheet").classes?.[0]?.className
  const [customClassName, setCustomClassName] = useState<ClassName | null>(() =>
    isCustomClassName(initialClass) ? (initialClass as ClassName) : null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const customEntries = (character.get("sheet").classes ?? []).filter(isCustomClassEntry)
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )
  const customSignature = customEntries
    .map((entry) => {
      const config = getCustomClassConfigFromEntry(entry)
      return `${String(entry.className)}:${entry.level}:${config?.name ?? ""}`
    })
    .join("|")

  useEffect(() => {
    if (customClassName) return
    const root = containerRef.current
    if (!root) return

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const label = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find(
        (entry) => entry.textContent?.trim().startsWith("Classe que recebe o nível"),
      )
      const select = label?.querySelector<HTMLSelectElement>("select")
      if (!select) return

      for (const candidate of Array.from(select.options)) {
        if (candidate.dataset.dndCustomLevelUpOption === "true") continue
        const current = candidate.textContent ?? ""
        const next = current
          .replace(/\s*·\s*(?:consulte sua refer[eê]ncia|requisitos manuais)\s*$/iu, "")
          .replace(/\s*·\s*$/u, "")
          .trim()
        if (next !== current) candidate.textContent = next
      }

      const desired = new Map<string, { label: string; disabled: boolean }>()
      for (const entry of customEntries) {
        const config = getCustomClassConfigFromEntry(entry)
        desired.set(String(entry.className), {
          label: `${config?.name?.trim() || "Classe personalizada"} ${entry.level} → ${entry.level + 1}`,
          disabled: entry.level >= 20 || totalLevel >= 20,
        })
      }
      desired.set(NEW_CUSTOM_LEVEL_UP_OPTION, {
        label: "Nova classe personalizada 1 (multiclasse)",
        disabled: totalLevel >= 20,
      })

      for (const option of Array.from(select.options)) {
        if (option.dataset.dndCustomLevelUpOption !== "true") continue
        if (!desired.has(option.value)) option.remove()
      }

      for (const [value, definition] of desired) {
        let option = Array.from(select.options).find(
          (candidate) =>
            candidate.dataset.dndCustomLevelUpOption === "true" &&
            candidate.value === value,
        )
        if (!option) {
          option = document.createElement("option")
          option.value = value
          option.dataset.dndCustomLevelUpOption = "true"
          select.appendChild(option)
        }
        if (option.textContent !== definition.label) option.textContent = definition.label
        if (option.disabled !== definition.disabled) option.disabled = definition.disabled
      }
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      sync()
      observer = new MutationObserver(scheduleSync)
      observer.observe(root, { childList: true, subtree: true })
    })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [customClassName, customSignature, totalLevel])

  if (customClassName) {
    return (
      <CustomClassLevelUpConfigurator
        key={String(customClassName)}
        character={character}
        className={customClassName}
        onBack={() => setCustomClassName(null)}
        onCancel={onCancel}
        onComplete={onComplete}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      onChangeCapture={(event) => {
        const target = event.target
        if (!(target instanceof HTMLSelectElement)) return

        if (target.value === NEW_CUSTOM_LEVEL_UP_OPTION) {
          event.stopPropagation()
          setCustomClassName(createCustomClassRuntimeId())
          return
        }

        if (isCustomClassName(target.value)) {
          event.stopPropagation()
          setCustomClassName(target.value as ClassName)
        }
      }}
    >
      <LevelUpProgressionConfigurator
        character={character}
        primaryClassName={primaryClassName}
        onCancel={onCancel}
        onComplete={onComplete}
      />
    </div>
  )
}
