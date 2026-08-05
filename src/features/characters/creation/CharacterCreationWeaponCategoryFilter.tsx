import { useEffect } from "react"

import type { Itemmable } from "../../../models/items/item"
import {
  STANDARD_ITEM_DEFINITIONS,
} from "../../items/standardItemCompendium"
import {
  getPhbWeaponCategory,
  type PhbWeaponCategory,
} from "./phbWeaponCategory"

const FILTERED_ATTRIBUTE = "data-starting-weapon-category-filtered"

export function CharacterCreationWeaponCategoryFilter() {
  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(filterOpenWeaponPicker)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document
        .querySelectorAll<HTMLElement>(`[${FILTERED_ATTRIBUTE}]`)
        .forEach((entry) => {
          entry.style.display = ""
          entry.removeAttribute(FILTERED_ATTRIBUTE)
        })
    }
  }, [])

  return null
}

function filterOpenWeaponPicker() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
    (entry) => entry.textContent?.trim() === "Escolher arma inicial",
  )
  const modal = heading?.closest<HTMLElement>("section")
  if (!modal) return

  const category = resolveRequestedCategory()
  if (category === "unknown") return

  const definitionByName = new Map<string, Itemmable>(
    STANDARD_ITEM_DEFINITIONS.map((definition) => [
      normalize(definition.item.name),
      definition.item,
    ]),
  )

  modal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const name = button.querySelector(".font-semibold")?.textContent?.trim()
    if (!name) return
    const item = definitionByName.get(normalize(name))
    if (!item) return

    const visible = getPhbWeaponCategory(item) === category
    button.style.display = visible ? "" : "none"
    button.setAttribute(FILTERED_ATTRIBUTE, "true")
  })

  const description = heading.nextElementSibling
  if (description instanceof HTMLElement) {
    description.textContent =
      category === "simple"
        ? "Selecione uma arma simples completa do compêndio."
        : "Selecione uma arma marcial completa do compêndio."
  }
}

function resolveRequestedCategory(): PhbWeaponCategory {
  const warnings = Array.from(
    document.querySelectorAll<HTMLElement>("div"),
  ).filter((entry) =>
    normalize(entry.textContent ?? "").includes("escolha obrigatoria"),
  )

  const active = warnings.find((entry) => {
    const buttons = Array.from(entry.querySelectorAll("button"))
    return buttons.some((button) =>
      normalize(button.textContent ?? "").includes("escolher no compendio"),
    )
  })
  const text = normalize(active?.textContent ?? "")
  if (text.includes("arma marcial")) return "martial"
  if (text.includes("arma simples")) return "simple"
  return "unknown"
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
