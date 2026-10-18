import { useEffect } from "react"

const SYNC_ATTRIBUTE = "data-progression-description-sync"

export function ProgressionFeatureDescriptionSync() {
  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncLevelUpDescriptions)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document
        .querySelectorAll(`[${SYNC_ATTRIBUTE}]`)
        .forEach((entry) => entry.remove())
    }
  }, [])

  return null
}

function syncLevelUpDescriptions() {
  document.querySelectorAll<HTMLElement>("article").forEach((article) => {
    if (article.closest("[data-progression-feature-modal]")) return
    if (!article.querySelector("h3")) return
    if (
      !Array.from(article.querySelectorAll("span")).some((entry) =>
        /^Nível\s+\d+/i.test(entry.textContent?.trim() ?? ""),
      )
    ) {
      return
    }
    if (article.querySelector(`[${SYNC_ATTRIBUTE}]`)) return
    if (
      Array.from(article.querySelectorAll("summary")).some((summary) =>
        normalize(summary.textContent ?? "").includes(
          "ler detalhes da caracteristica",
        ),
      )
    ) {
      return
    }

    const description = Array.from(article.querySelectorAll("p")).find(
      (paragraph) =>
        !paragraph.closest("[data-progression-feature-modal]") &&
        !normalize(paragraph.textContent ?? "").startsWith(
          "as opcoes desta caracteristica",
        ),
    )
    if (!description?.textContent?.trim()) return

    const details = document.createElement("details")
    details.setAttribute(SYNC_ATTRIBUTE, "true")
    const summary = document.createElement("summary")
    summary.textContent = "Ler detalhes da característica"
    const paragraph = document.createElement("p")
    paragraph.textContent = description.textContent.trim()
    details.append(summary, paragraph)
    article.append(details)
  })
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
