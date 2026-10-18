import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { ItemKind, Itemmable } from "../../models/items/item"
import {
  findStandardItemDefinitionByName,
  instantiateStandardItem,
  normalizeStandardItem,
} from "../../features/items/standardItemCompendium"

export type StartingItemSource = {
  type: "background" | "class" | "manual"
  sourceId?: string
  sourceName?: string
}

type BackgroundItemDefinition = {
  compendiumName?: string
  kind?: ItemKind
  weight?: number
  pocketable?: boolean
  description?: string
}

const BACKGROUND_ITEM_DEFINITIONS: Record<string, BackgroundItemDefinition> = {
  "livro de oracoes": { compendiumName: "Livro" },
  incenso: {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Varetas ou pequenos blocos aromáticos usados em ritos e cerimônias.",
  },
  vestes: {
    kind: "gear",
    weight: 1.8,
    pocketable: false,
    description: "Vestes cerimoniais ligadas à fé ou ordem do personagem.",
  },
  "ferramentas de golpe": {
    kind: "tool",
    weight: 0.5,
    pocketable: true,
    description: "Objetos, documentos e pequenos acessórios usados para executar um golpe específico.",
  },
  "roupas escuras": { compendiumName: "Roupas comuns" },
  bolsa: {
    kind: "gear",
    weight: 0.45,
    pocketable: false,
    description: "Pequena bolsa de couro ou tecido para carregar objetos e moedas.",
  },
  "instrumento musical": {
    kind: "instrument",
    weight: 1.5,
    pocketable: false,
    description: "Um instrumento musical escolhido pelo personagem.",
  },
  "presente de admirador": {
    kind: "gear",
    weight: 0.1,
    pocketable: true,
    description: "Uma lembrança recebida de alguém que admirava as apresentações do personagem.",
  },
  traje: { compendiumName: "Roupas finas" },
  "ferramenta de artesao": {
    kind: "tool",
    weight: 2.5,
    pocketable: false,
    description: "Um conjunto de ferramentas de artesão escolhido pelo personagem.",
  },
  "carta de apresentacao": {
    kind: "gear",
    weight: 0.01,
    pocketable: true,
    description: "Documento que comprova vínculo profissional ou recomenda o personagem a uma guilda.",
  },
  "estojo de pergaminhos": {
    compendiumName: "Estojo para mapa ou pergaminho",
  },
  "anel de sinete": {
    kind: "gear",
    weight: 0.02,
    pocketable: true,
    description: "Anel gravado com o brasão, marca ou selo de uma linhagem.",
  },
  "pergaminho de linhagem": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Documento que registra a genealogia e as prerrogativas da família do personagem.",
  },
  cajado: { compendiumName: "Bordão" },
  "trofeu animal": {
    kind: "gear",
    weight: 0.25,
    pocketable: true,
    description: "Presa, pele, pena ou outro troféu obtido durante a vida nas terras selvagens.",
  },
  "frasco de tinta": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Pequeno frasco de tinta para escrita.",
  },
  pena: {
    kind: "gear",
    weight: 0,
    pocketable: true,
    description: "Pena preparada para escrita com tinta.",
  },
  "pequena faca": { compendiumName: "Adaga" },
  "carta de colega": {
    kind: "gear",
    weight: 0.01,
    pocketable: true,
    description: "Carta de um colega, mestre ou instituição relacionada aos estudos do personagem.",
  },
  "cavilha de amarracao": { compendiumName: "Clava" },
  "amuleto da sorte": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Pequeno amuleto associado à sorte e às viagens do personagem.",
  },
  "insignia de patente": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Insígnia que identifica a patente e a antiga unidade militar do personagem.",
  },
  "trofeu de inimigo": {
    kind: "gear",
    weight: 0.25,
    pocketable: true,
    description: "Lembrança tomada de um adversário derrotado em campanha.",
  },
  "conjunto de jogo": {
    kind: "tool",
    weight: 0.5,
    pocketable: true,
    description: "Um conjunto de dados, cartas, peças ou outro jogo escolhido pelo personagem.",
  },
  "mapa da cidade": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Mapa marcado com ruas, atalhos e pontos importantes da cidade natal do personagem.",
  },
  "mascote pequeno": {
    kind: "gear",
    weight: 0.1,
    pocketable: true,
    description: "Representação ou registro de um pequeno mascote ligado ao passado do personagem.",
  },
  "lembranca familiar": {
    kind: "gear",
    weight: 0.05,
    pocketable: true,
    description: "Objeto pessoal preservado como lembrança da família.",
  },
}

export function hydrateBackgroundStartingItem(
  item: Itemmable,
  source: StartingItemSource = { type: "background" },
): Itemmable {
  const originalName = item.name.trim() || "Item do antecedente"
  const explicit = BACKGROUND_ITEM_DEFINITIONS[normalizeName(originalName)]
  const standardDefinition = findStandardItemDefinitionByName(
    explicit?.compendiumName ?? originalName,
  )

  if (standardDefinition) {
    const canonical = instantiateStandardItem(
      standardDefinition.item.id,
      Math.max(1, item.quantity || 1),
    )

    return normalizeStandardItem({
      ...canonical,
      id: item.id || canonical.id,
      name: originalName,
      quantity: Math.max(1, item.quantity || 1),
      notes: buildSourceNote(source, standardDefinition.item.name),
      insideBagOfHolding: item.insideBagOfHolding === true,
    })
  }

  const kind = explicit?.kind ?? inferKind(originalName)
  const weight =
    explicit?.weight !== undefined
      ? explicit.weight
      : item.weight > 0
        ? item.weight
        : defaultWeightForKind(kind)

  return normalizeStandardItem({
    id: item.id || crypto.randomUUID(),
    name: originalName,
    desc:
      explicit?.description ||
      item.desc?.trim() ||
      "Equipamento inicial concedido pelo antecedente.",
    notes: buildSourceNote(source),
    quantity: Math.max(1, item.quantity || 1),
    weight: Math.max(0, weight),
    pocketable: explicit?.pocketable ?? item.pocketable ?? true,
    kind,
    equippable: false,
    magicItem: false,
    requiresAttunement: false,
    attuned: false,
    insideBagOfHolding: item.insideBagOfHolding === true,
    itemOrigin: "custom",
  })
}

export function hydrateBackgroundStartingItems(
  items: Itemmable[],
  source: StartingItemSource = { type: "background" },
): Itemmable[] {
  return items.map((item) => hydrateBackgroundStartingItem(item, source))
}

export function hydrateCharacterStartingInventory(
  character: CharacterTemplate,
): CharacterTemplate {
  const backgroundName = getBackgroundName(character)
  const source: StartingItemSource = {
    type: "background",
    sourceId: backgroundName ? normalizeName(backgroundName) : undefined,
    sourceName: backgroundName || "Antecedente",
  }
  const inventory = character.get("inventory") ?? []

  return character.with(
    "inventory",
    inventory.map((item) => {
      if (isBackgroundPlaceholder(item)) {
        return hydrateBackgroundStartingItem(item, source)
      }
      return normalizeStandardItem(item)
    }),
  )
}

function isBackgroundPlaceholder(item: Itemmable): boolean {
  const text = `${item.desc ?? ""} ${item.notes ?? ""}`
    .toLocaleLowerCase("pt-BR")
  if (text.includes("antecedente")) return true

  return (
    !item.compendiumItemId &&
    item.itemOrigin !== "standard" &&
    item.kind === "common" &&
    item.weight === 0
  )
}

function getBackgroundName(character: CharacterTemplate): string {
  const history = character.get("profile").history ?? ""
  const match = history.match(/^Antecedente:\s*(.+)$/im)
  return match?.[1]?.trim() ?? ""
}

function buildSourceNote(
  source: StartingItemSource,
  canonicalName?: string,
): string {
  const sourceLabel =
    source.sourceName?.trim() ||
    (source.type === "background"
      ? "Antecedente"
      : source.type === "class"
        ? "Classe"
        : "Criação de personagem")
  const canonical = canonicalName ? ` Item-base: ${canonicalName}.` : ""
  const sourceId = source.sourceId ? ` Identificador: ${source.sourceId}.` : ""
  return `Equipamento inicial de ${sourceLabel}.${canonical}${sourceId}`
}

function inferKind(name: string): ItemKind {
  const normalized = normalizeName(name)
  if (normalized.includes("kit") || normalized.includes("ferrament")) {
    return "tool"
  }
  if (normalized.includes("instrument")) return "instrument"
  if (normalized.includes("simbolo")) return "focus"
  if (
    normalized.includes("roup") ||
    normalized.includes("traje") ||
    normalized.includes("veste")
  ) {
    return "gear"
  }
  return "gear"
}

function defaultWeightForKind(kind: ItemKind): number {
  if (kind === "instrument") return 1.5
  if (kind === "tool") return 1
  if (kind === "focus") return 0.25
  return 0.1
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
