import { useEffect, useRef, useState } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  CUSTOM_CLASS_RUNTIME_ID,
  getCustomClassConfig,
  getCustomClassIndex,
} from "../../../models/characters/customClassConfig"
import type { ClassName } from "../../../models/sheet/Class"
import { CustomClassLevelUpConfigurator } from "./CustomClassLevelUpConfigurator"
import { LevelUpProgressionConfigurator } from "./LevelUpProgressionConfigurator"

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
  const [customMode, setCustomMode] = useState(
    () => String(initialClass ?? "") === String(CUSTOM_CLASS_RUNTIME_ID),
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const customIndex = getCustomClassIndex(character)
  const customEntry =
    customIndex >= 0 ? character.get("sheet").classes?.[customIndex] : undefined
  const customConfig = getCustomClassConfig(character)
  const totalLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )

  useEffect(() => {
    if (customMode) return
    const root = containerRef.current
    if (!root) return

    let frame = 0
    let observer: MutationObserver | undefined

    const sync = () => {
      const label = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find(
        (entry) =>
          entry.textContent?.trim().startsWith("Classe que recebe o nível"),
      )
      const select = label?.querySelector<HTMLSelectElement>("select")
      if (!select) return

      for (const option of Array.from(select.options)) {
        const current = option.textContent ?? ""
        const next = current
          .replace(/\s*·\s*consulte sua refer[eê]ncia\s*$/iu, "")
          .replace(/\s*·\s*$/u, "")
          .trim()
        if (next !== current) option.textContent = next
      }

      let option = Array.from(select.options).find(
        (entry) => entry.value === String(CUSTOM_CLASS_RUNTIME_ID),
      )
      if (!option) {
        option = document.createElement("option")
        option.value = String(CUSTOM_CLASS_RUNTIME_ID)
        option.dataset.dndCustomLevelUpOption = "true"
        select.appendChild(option)
      }

      if (customEntry) {
        const name = customConfig?.name?.trim() || "Classe personalizada"
        option.textContent = `${name} ${customEntry.level} → ${customEntry.level + 1}`
        option.disabled = customEntry.level >= 20 || totalLevel >= 20
      } else {
        option.textContent = "Nova classe personalizada 1 (multiclasse)"
        option.disabled = totalLevel >= 20
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
  }, [customConfig?.name, customEntry, customMode, totalLevel])

  if (customMode) {
    return (
      <CustomClassLevelUpConfigurator
        character={character}
        onBack={() => setCustomMode(false)}
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
        if (
          target instanceof HTMLSelectElement &&
          target.value === String(CUSTOM_CLASS_RUNTIME_ID)
        ) {
          event.stopPropagation()
          setCustomMode(true)
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
