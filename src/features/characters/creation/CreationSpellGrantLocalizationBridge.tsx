import { useEffect, useMemo } from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"

const GRANT_SUMMARY = "ler detalhes das magias concedidas pela subclasse"

export function CreationSpellGrantLocalizationBridge() {
  const { spells } = useMagicContext()
  const spellMap = useMemo(() => buildSpellMap(spells), [spells])

  useEffect(() => {
    if (typeof document === "undefined") return

    const apply = () => localizeGrantedSpellCards(spellMap)

    apply()
    const interval = window.setInterval(apply, 500)
    return () => window.clearInterval(interval)
  }, [spellMap])

  return null
}

function localizeGrantedSpellCards(spellMap: Map<string, Spell>) {
  document.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    const summary = normalize(
      details.querySelector(":scope > summary")?.textContent ?? "",
    )
    if (summary !== GRANT_SUMMARY) return

    details.querySelectorAll<HTMLElement>("article").forEach((article) => {
      const title = article.querySelector<HTMLElement>("strong")
      const description = article.querySelector<HTMLElement>("p")
      if (!title || !description) return

      const rawName = title.dataset.originalSpellName || title.textContent || ""
      title.dataset.originalSpellName = rawName
      const spell = resolveSpell(spellMap, rawName)
      if (!spell) {
        article.classList.add("border-danger")
        return
      }

      const localizedName = spell.displayName?.trim() || spell.name
      if (title.textContent !== localizedName) title.textContent = localizedName
      if (description.textContent !== spell.description) {
        description.textContent = spell.description || "Sem descrição cadastrada."
      }
      article.classList.remove("border-danger")
      article.dataset.localizedSpellIndex = spell.index
    })
  })
}

function buildSpellMap(spells: Spell[]): Map<string, Spell> {
  const map = new Map<string, Spell>()
  for (const spell of spells) {
    map.set(normalize(spell.index), spell)
    map.set(normalize(spell.name), spell)
    if (spell.displayName?.trim()) map.set(normalize(spell.displayName), spell)
  }
  return map
}

function resolveSpell(map: Map<string, Spell>, rawName: string): Spell | undefined {
  return map.get(normalize(rawName)) ?? map.get(normalize(toSpellIndex(rawName)))
}

function toSpellIndex(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en-US")
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
