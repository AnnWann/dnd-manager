import { normalizeCurrencyItem } from "../../models/items/Currency"
import { WEAPON_PROPERTIES, type WeaponPropertyId } from "../../models/items/equipment/Weapon"
import type { ItemKind, Itemmable } from "../../models/items/item"

const ITEM_KINDS: ItemKind[] = [
  "common",
  "equipment",
  "consumable",
  "throwable",
  "supply",
  "ammunition",
  "tool",
  "focus",
  "instrument",
  "pack",
  "gear",
  "currency",
  "shield",
]

const WEAPON_PROPERTY_IDS = Object.keys(
  WEAPON_PROPERTIES,
) as WeaponPropertyId[]

export type ItemJsonAiTemplate = {
  $schema: "dnd-manager.item-ai-template"
  version: 1
  instructions: string[]
  enums: Record<string, readonly string[]>
  fieldGuide: Record<string, string>
  examples: Record<string, Record<string, unknown>>
  item: Record<string, unknown>
}

/**
 * Estrutura autoexplicativa para ser entregue a uma IA junto da descrição do
 * item desejado. O importador aceita tanto este envelope completo quanto apenas
 * o objeto contido em `item`.
 */
export function itemJsonTemplate(): ItemJsonAiTemplate {
  return {
    $schema: "dnd-manager.item-ai-template",
    version: 1,
    instructions: [
      "Preencha somente o objeto `item` com um único item válido para o dnd-manager.",
      "Mantenha JSON puro, sem comentários, markdown ou texto fora do objeto.",
      "Use quilogramas em `weight`; o peso é sempre por unidade, não o peso total da pilha.",
      "Use `quantity` como número inteiro não negativo. Para itens comuns, normalmente use 1.",
      "Remova campos opcionais que não se aplicam ao item em vez de inventar valores sem efeito.",
      "Para armas, use kind=`equipment`, equipSlot=`weapon`, dano em `damage` e propriedades em `properties`.",
      "Para armaduras, use kind=`equipment`, equipSlot=`armor` e armorType=`light`, `medium` ou `heavy`.",
      "Para escudos, use kind=`shield`; o sistema aplica automaticamente o slot de escudo e o bônus padrão de CA quando necessário.",
      "Para itens mágicos equipáveis, use magicItem=true. Use requiresAttunement=true somente quando exigirem sintonia.",
      "Habilidades, bônus e magias de equipamento só funcionam enquanto o item estiver equipado.",
      "Em `spells` e `grantedSpells`, `index` deve ser o identificador da magia existente no banco do sistema, normalmente em inglês e kebab-case.",
      "Para moedas, use kind=`currency` e informe currencyType. Nome, peso e propriedades monetárias serão normalizados pelo sistema.",
      "O campo `id` pode ser vazio; nesse caso o sistema gera um UUID ao importar.",
    ],
    enums: {
      kind: ITEM_KINDS,
      equipSlot: [
        "armor",
        "helmet",
        "gloves",
        "boots",
        "cape",
        "shield",
        "weapon",
        "ring",
        "necklace",
      ],
      armorType: ["light", "medium", "heavy"],
      attribute: ["str", "dex", "con", "int", "wis", "cha"],
      dieSides: ["d2", "d3", "d4", "d6", "d8", "d10", "d12", "d20", "d100"],
      weaponPropertyId: WEAPON_PROPERTY_IDS,
      currencyType: ["copper", "silver", "electrum", "gold", "platinum"],
      supplyCategory: ["food", "drink", "mixed", "other"],
      supplyPackage: ["ration", "barrel", "custom"],
      bonusType: ["add", "sub", "flat"],
      bonusTarget: [
        "armorClass",
        "initiative",
        "maxHp",
        "temporaryHp",
        "passivePerception",
        "attackBonus",
        "weaponAttackBonus",
        "spellAttackBonus",
        "saveDcBonus",
        "spellSaveDcBonus",
        "abilitySaveDcBonus",
        "damageBonus",
        "weaponDamageBonus",
        "spellDamageBonus",
        "speed",
        "attribute",
        "attributeModifier",
        "attack",
        "damage",
      ],
      abilityKind: ["active", "passive", "feature"],
      abilityCategory: ["general", "invocation", "feat", "channelDivinity"],
      actionKind: [
        "action",
        "bonusAction",
        "reaction",
        "legendaryAction",
        "legendaryReaction",
        "legendaryResistance",
        "free",
      ],
      effectDuration: ["instant", "lasting"],
      effectPersistence: ["untilEnd", "permanent"],
      usageReset: [
        "turn",
        "cooldown",
        "shortRest",
        "longRest",
        "limited",
        "spellSlot",
      ],
      cooldownUnit: ["turns", "minutes", "hours", "days", "tenDays"],
      spellCastingMode: ["source", "known"],
    },
    fieldGuide: {
      id: "string opcional. Deixe vazio para o sistema gerar um UUID.",
      name: "string obrigatória. Nome exibido do item.",
      desc: "string. Descrição narrativa e mecânica curta.",
      notes: "string. Observações do mestre ou detalhes que não cabem na descrição.",
      quantity: "inteiro >= 0. Quantidade de unidades na pilha.",
      weight: "número >= 0 em kg por unidade.",
      pocketable: "boolean. Indica se uma unidade pode ocupar um bolso; moedas não usam bolsos.",
      kind: "categoria principal do item; use exatamente um valor de enums.kind.",
      equippable: "boolean. Use true para equipamentos que podem ocupar um slot.",
      equipSlot: "slot usado ao equipar. Obrigatório para kind=equipment.",
      magicItem: "boolean. Marca o item como mágico.",
      requiresAttunement: "boolean. Só use true em item mágico que exige sintonia.",
      attuned: "boolean de estado. Para novos itens normalmente false.",
      insideBagOfHolding: "boolean de estado. Use true somente quando o item deve nascer dentro da Bolsa Mágica.",
      heldHands: "estado temporário 1 ou 2. Normalmente omita em importações para o chão.",
      armorType: "light, medium ou heavy; usado somente em armaduras.",
      damage: "objeto { quantity, sides } com a quantidade e o tipo de dado do dano.",
      versatileDamage: "objeto de dado alternativo para armas com a propriedade versatile empunhadas com duas mãos.",
      modifierAttribute: "atributo usado no ataque da arma.",
      proficient: "boolean. Indica se o personagem trata a arma como proficiente quando equipada.",
      properties: "lista de propriedades de arma. Pode usar apenas IDs; o importador converte para os objetos canônicos.",
      bonuses: "coleção de bônus. Alvos simples recebem listas de {type,value,formula?,label?}; alvos por atributo recebem {attribute?,bonus}.",
      abilities: "lista de habilidades concedidas pelo equipamento. Cada habilidade deve ter id, name e pode possuir usage, bonuses e grantedSpells.",
      spells: "lista de magias concedidas diretamente pelo equipamento. Cada entrada usa {index, castingMode, attribute?, usage}.",
      usage: "contador {max, maxFormula?, used, reset, cooldownAmount?, cooldownUnit?, cooldownRemaining?}.",
      grantedSpells: "lista {index, castingMode?, attribute?}. castingMode=source gasta cargas da fonte; known adiciona a magia conhecida.",
      useText: "texto exibido ao usar um consumível.",
      range: "texto livre de alcance para item arremessável, por exemplo `6/18 m`.",
      supplyCategory: "categoria de suprimento: food, drink, mixed ou other.",
      supplyPackage: "embalagem: ration, barrel ou custom.",
      supplyUnitsPerItem: "porções padrão contidas em cada unidade física.",
      remainingSupplyUnits: "porções ainda disponíveis em toda a pilha; normalmente omita em uma pilha nova e cheia.",
      supplyUnitLabel: "rótulo humano da porção ou embalagem.",
      currencyType: "denominação monetária canônica.",
    },
    examples: {
      weapon: {
        id: "",
        name: "Lâmina rúnica",
        desc: "Espada longa mágica que concede bônus de ataque e uma habilidade limitada.",
        notes: "",
        quantity: 1,
        weight: 1.35,
        pocketable: true,
        kind: "equipment",
        equippable: true,
        equipSlot: "weapon",
        magicItem: true,
        requiresAttunement: true,
        attuned: false,
        insideBagOfHolding: false,
        damage: { quantity: 1, sides: "d8" },
        versatileDamage: { quantity: 1, sides: "d10" },
        modifierAttribute: "str",
        proficient: false,
        properties: ["versatile"],
        bonuses: {
          attack: {
            type: "equipment",
            bonus: { type: "add", value: 1, label: "Arma +1" },
          },
          damage: {
            type: "equipment",
            bonus: { type: "add", value: 1, label: "Arma +1" },
          },
        },
        abilities: [
          {
            id: "ability-rune-burst",
            name: "Explosão rúnica",
            description: "Ativa a runa da lâmina para produzir um efeito especial.",
            kind: "active",
            actionKind: "bonusAction",
            effectDuration: "instant",
            usage: { max: 1, used: 0, reset: "shortRest" },
          },
        ],
      },
      armor: {
        id: "",
        name: "Couraça do vigia",
        desc: "Armadura média mágica com bônus de iniciativa.",
        notes: "",
        quantity: 1,
        weight: 9.1,
        pocketable: false,
        kind: "equipment",
        equippable: true,
        equipSlot: "armor",
        armorType: "medium",
        magicItem: true,
        requiresAttunement: false,
        attuned: false,
        insideBagOfHolding: false,
        bonuses: {
          initiative: [{ type: "add", value: 1, label: "Couraça do vigia" }],
        },
      },
      consumable: {
        id: "",
        name: "Poção restauradora",
        desc: "Consumível de uso único.",
        notes: "",
        quantity: 1,
        weight: 0.25,
        pocketable: true,
        kind: "consumable",
        magicItem: true,
        requiresAttunement: false,
        attuned: false,
        insideBagOfHolding: false,
        useText: "Beba a poção para aplicar o efeito descrito.",
      },
      throwable: {
        id: "",
        name: "Frasco congelante",
        desc: "Frasco arremessável que causa dano ao se quebrar.",
        notes: "",
        quantity: 1,
        weight: 0.45,
        pocketable: true,
        kind: "throwable",
        magicItem: true,
        requiresAttunement: false,
        attuned: false,
        insideBagOfHolding: false,
        range: "6/18 m",
        damage: { quantity: 2, sides: "d6" },
      },
      supply: {
        id: "",
        name: "Rações de viagem",
        desc: "Alimento preservado para descanso e viagem.",
        notes: "",
        quantity: 5,
        weight: 0.9,
        pocketable: false,
        kind: "supply",
        magicItem: false,
        requiresAttunement: false,
        attuned: false,
        insideBagOfHolding: false,
        supplyCategory: "food",
        supplyPackage: "ration",
        supplyUnitsPerItem: 1,
        supplyUnitLabel: "ração",
      },
      spellcastingFocus: {
        id: "",
        name: "Cajado do nevoeiro",
        desc: "Foco mágico que concede uma magia com cargas próprias.",
        notes: "",
        quantity: 1,
        weight: 1.8,
        pocketable: false,
        kind: "equipment",
        equippable: true,
        equipSlot: "weapon",
        magicItem: true,
        requiresAttunement: true,
        attuned: false,
        insideBagOfHolding: false,
        damage: { quantity: 1, sides: "d6" },
        versatileDamage: { quantity: 1, sides: "d8" },
        modifierAttribute: "str",
        proficient: false,
        properties: ["versatile"],
        spells: [
          {
            index: "fog-cloud",
            castingMode: "source",
            attribute: "wis",
            usage: { max: 3, used: 0, reset: "longRest" },
          },
        ],
      },
      currency: {
        id: "",
        name: "Peças de ouro",
        desc: "",
        notes: "",
        quantity: 100,
        weight: 0.009,
        pocketable: false,
        kind: "currency",
        currencyType: "gold",
        insideBagOfHolding: false,
      },
    },
    item: {
      id: "",
      name: "Nome do item",
      desc: "Descrição narrativa e mecânica do item.",
      notes: "Observações opcionais.",
      quantity: 1,
      weight: 0,
      pocketable: true,
      kind: "gear",
      magicItem: false,
      requiresAttunement: false,
      attuned: false,
      insideBagOfHolding: false,
    },
  }
}

export function parseItemJson(value: string): Itemmable {
  const parsed: unknown = JSON.parse(stripMarkdownCodeFence(value))
  const candidate = extractItemCandidate(parsed)

  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    throw new Error("O item precisa possuir um nome.")
  }

  const kind = normalizeKind(candidate.kind)
  const properties = normalizeWeaponProperties(candidate.properties)
  const item = {
    ...candidate,
    id:
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : crypto.randomUUID(),
    name: candidate.name.trim(),
    desc: typeof candidate.desc === "string" ? candidate.desc : "",
    notes: typeof candidate.notes === "string" ? candidate.notes : "",
    quantity: normalizeQuantity(candidate.quantity),
    weight: Math.max(0, Number(candidate.weight) || 0),
    pocketable: candidate.pocketable !== false,
    kind,
    magicItem: candidate.magicItem === true,
    requiresAttunement:
      candidate.magicItem === true && candidate.requiresAttunement === true,
    attuned:
      candidate.magicItem === true &&
      candidate.requiresAttunement === true &&
      candidate.attuned === true,
    insideBagOfHolding: candidate.insideBagOfHolding === true,
    properties,
  } as Itemmable

  if (kind === "currency") return normalizeCurrencyItem(item)

  return item
}

function extractItemCandidate(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    throw new Error("O JSON deve representar um único item.")
  }

  if ("item" in parsed) {
    if (!isRecord(parsed.item)) {
      throw new Error("O campo `item` precisa conter um objeto válido.")
    }
    return parsed.item
  }

  return parsed
}

function normalizeKind(value: unknown): ItemKind {
  if (typeof value !== "string") return "gear"
  if (ITEM_KINDS.includes(value as ItemKind)) return value as ItemKind

  throw new Error(
    `Tipo de item inválido: ${value}. Use um dos valores listados em enums.kind.`,
  )
}

function normalizeWeaponProperties(value: unknown): unknown {
  if (!Array.isArray(value)) return value

  return value.map((entry) => {
    if (typeof entry === "string") {
      if (!WEAPON_PROPERTY_IDS.includes(entry as WeaponPropertyId)) {
        throw new Error(`Propriedade de arma inválida: ${entry}.`)
      }
      return WEAPON_PROPERTIES[entry as WeaponPropertyId]
    }

    if (isRecord(entry) && typeof entry.id === "string") {
      if (!WEAPON_PROPERTY_IDS.includes(entry.id as WeaponPropertyId)) {
        throw new Error(`Propriedade de arma inválida: ${entry.id}.`)
      }
      return WEAPON_PROPERTIES[entry.id as WeaponPropertyId]
    }

    throw new Error("Cada propriedade de arma deve ser um ID válido.")
  })
}

function normalizeQuantity(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1
  return Math.max(0, Math.trunc(Number(value) || 0))
}

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1] : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
