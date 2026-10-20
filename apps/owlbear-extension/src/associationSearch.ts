export type AssociationSearchChoice = { id: string; name: string }

function normalizeQuery(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim()
}

/** Bound the native select so even very large creature compendiums stay usable. */
export function filterAssociationChoices<T extends AssociationSearchChoice>(
  choices: readonly T[],
  search: string,
  limit = 40,
): { matches: T[]; total: number } {
  const term = normalizeQuery(search)
  const words = term.split(/\s+/).filter(Boolean)
  const filtered = choices.filter(choice => {
    const name = normalizeQuery(choice.name)
    return words.every(word => name.includes(word))
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  return { total: filtered.length, matches: filtered.slice(0, Math.max(1, Math.trunc(limit))) }
}
