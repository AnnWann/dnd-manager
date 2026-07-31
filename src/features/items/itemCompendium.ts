import type { ItemKind, Itemmable } from "../../models/items/item"
import {
  WEAPON_PROPERTIES,
  type WeaponPropertyId,
} from "../../models/items/equipment/Weapon"

type DamageSides = "d4" | "d6" | "d8" | "d10" | "d12"
type WeaponAttribute = "str" | "dex"

const base = {
  id: "",
  desc: "",
  notes: "",
  quantity: 1,
  weight: 0,
  pocketable: true,
  kind: "gear" as const,
}

function item(
  id: string,
  name: string,
  desc: string,
  weight: number,
  kind: ItemKind = "gear",
  quantity = 1,
  pocketable = true,
  extras: Record<string, unknown> = {},
): Itemmable {
  return {
    ...base,
    id: `compendium-${id}`,
    name,
    desc,
    weight,
    kind,
    quantity,
    pocketable,
    ...extras,
  } as Itemmable
}

function weapon(
  id: string,
  name: string,
  desc: string,
  weight: number,
  damageQuantity: number,
  damageSides: DamageSides,
  modifierAttribute: WeaponAttribute,
  propertyIds: WeaponPropertyId[],
  versatileDamageSides?: DamageSides,
): Itemmable {
  return item(id, name, desc, weight, "equipment", 1, false, {
    equippable: true,
    equipSlot: "weapon",
    properties: propertyIds.map((propertyId) => WEAPON_PROPERTIES[propertyId]),
    damage: { quantity: damageQuantity, sides: damageSides },
    versatileDamage: versatileDamageSides
      ? { quantity: 1, sides: versatileDamageSides }
      : undefined,
    modifierAttribute,
    proficient: false,
  })
}

function armor(
  id: string,
  name: string,
  desc: string,
  weight: number,
): Itemmable {
  return item(id, name, desc, weight, "equipment", 1, false, {
    equippable: true,
    equipSlot: "armor",
  })
}

export const BASIC_ITEM_COMPENDIUM: Itemmable[] = [
  // Armas simples e marciais
  weapon("club", "Clava", "Arma simples corpo a corpo.", 0.9, 1, "d4", "str", ["light"]),
  weapon("dagger", "Adaga", "Arma simples leve, de acuidade e arremesso.", 0.45, 1, "d4", "dex", ["finesse", "light", "thrown"]),
  weapon("greatclub", "Clava grande", "Arma simples de duas mãos.", 4.5, 1, "d8", "str", ["two-handed"]),
  weapon("handaxe", "Machadinha", "Arma simples leve e de arremesso.", 0.9, 1, "d6", "str", ["light", "thrown"]),
  weapon("javelin", "Azagaia", "Arma simples de arremesso.", 0.9, 1, "d6", "str", ["thrown"]),
  weapon("light-hammer", "Martelo leve", "Arma simples leve e de arremesso.", 0.9, 1, "d4", "str", ["light", "thrown"]),
  weapon("mace", "Maça", "Arma simples corpo a corpo.", 1.8, 1, "d6", "str", []),
  weapon("quarterstaff", "Bordão", "Arma simples versátil.", 1.8, 1, "d6", "str", ["versatile"], "d8"),
  weapon("sickle", "Foice curta", "Arma simples leve.", 0.9, 1, "d4", "str", ["light"]),
  weapon("spear", "Lança", "Arma simples versátil e de arremesso.", 1.35, 1, "d6", "str", ["thrown", "versatile"], "d8"),
  weapon("light-crossbow", "Besta leve", "Arma simples à distância com munição e recarga.", 2.25, 1, "d8", "dex", ["ammunition", "loading", "range", "two-handed"]),
  weapon("dart", "Dardo", "Arma simples de acuidade e arremesso.", 0.1, 1, "d4", "dex", ["finesse", "thrown"]),
  weapon("shortbow", "Arco curto", "Arma simples à distância que utiliza flechas.", 0.9, 1, "d6", "dex", ["ammunition", "range", "two-handed"]),
  weapon("sling", "Funda", "Arma simples à distância que utiliza projéteis.", 0, 1, "d4", "dex", ["ammunition", "range"]),
  weapon("battleaxe", "Machado de batalha", "Arma marcial versátil.", 1.8, 1, "d8", "str", ["versatile"], "d10"),
  weapon("flail", "Mangual", "Arma marcial corpo a corpo.", 0.9, 1, "d8", "str", []),
  weapon("glaive", "Glaive", "Arma marcial pesada, de alcance e duas mãos.", 2.7, 1, "d10", "str", ["heavy", "reach", "two-handed"]),
  weapon("greataxe", "Machado grande", "Arma marcial pesada de duas mãos.", 3.2, 1, "d12", "str", ["heavy", "two-handed"]),
  weapon("greatsword", "Espada grande", "Arma marcial pesada de duas mãos.", 2.7, 2, "d6", "str", ["heavy", "two-handed"]),
  weapon("halberd", "Alabarda", "Arma marcial pesada, de alcance e duas mãos.", 2.7, 1, "d10", "str", ["heavy", "reach", "two-handed"]),
  weapon("lance", "Lança de cavalaria", "Arma marcial de alcance com regras especiais.", 2.7, 1, "d12", "str", ["reach", "special", "lance"]),
  weapon("longsword", "Espada longa", "Arma marcial versátil.", 1.35, 1, "d8", "str", ["versatile"], "d10"),
  weapon("maul", "Malho", "Arma marcial pesada de duas mãos.", 4.5, 2, "d6", "str", ["heavy", "two-handed"]),
  weapon("morningstar", "Maça-estrela", "Arma marcial perfurante.", 1.8, 1, "d8", "str", []),
  weapon("pike", "Pique", "Arma marcial pesada, de alcance e duas mãos.", 8.2, 1, "d10", "str", ["heavy", "reach", "two-handed"]),
  weapon("rapier", "Rapieira", "Arma marcial de acuidade.", 0.9, 1, "d8", "dex", ["finesse"]),
  weapon("scimitar", "Cimitarra", "Arma marcial leve e de acuidade.", 1.35, 1, "d6", "dex", ["finesse", "light"]),
  weapon("shortsword", "Espada curta", "Arma marcial leve e de acuidade.", 0.9, 1, "d6", "dex", ["finesse", "light"]),
  weapon("trident", "Tridente", "Arma marcial versátil e de arremesso.", 1.8, 1, "d6", "str", ["thrown", "versatile"], "d8"),
  weapon("war-pick", "Picareta de guerra", "Arma marcial perfurante.", 0.9, 1, "d8", "str", []),
  weapon("warhammer", "Martelo de guerra", "Arma marcial versátil.", 0.9, 1, "d8", "str", ["versatile"], "d10"),
  weapon("whip", "Chicote", "Arma marcial de acuidade e alcance.", 1.35, 1, "d4", "dex", ["finesse", "reach"]),
  weapon("hand-crossbow", "Besta de mão", "Arma marcial leve à distância com recarga.", 1.35, 1, "d6", "dex", ["ammunition", "light", "loading", "range"]),
  weapon("heavy-crossbow", "Besta pesada", "Arma marcial pesada à distância com recarga.", 8.2, 1, "d10", "dex", ["ammunition", "heavy", "loading", "range", "two-handed"]),
  weapon("longbow", "Arco longo", "Arma marcial pesada à distância.", 0.9, 1, "d8", "dex", ["ammunition", "heavy", "range", "two-handed"]),

  // Armaduras e escudo
  armor("padded-armor", "Armadura acolchoada", "Armadura leve. CA base 11 + Destreza; costuma atrapalhar furtividade.", 3.6),
  armor("leather-armor", "Armadura de couro", "Armadura leve. CA base 11 + Destreza.", 4.5),
  armor("studded-leather", "Couro batido", "Armadura leve. CA base 12 + Destreza.", 5.9),
  armor("hide-armor", "Armadura de peles", "Armadura média. CA base 12 + Destreza limitada.", 5.4),
  armor("chain-shirt", "Camisão de malha", "Armadura média. CA base 13 + Destreza limitada.", 9.1),
  armor("scale-mail", "Brunea", "Armadura média. CA base 14 + Destreza limitada; costuma atrapalhar furtividade.", 20.4),
  armor("breastplate", "Peitoral", "Armadura média. CA base 14 + Destreza limitada.", 9.1),
  armor("half-plate", "Meia armadura", "Armadura média. CA base 15 + Destreza limitada; costuma atrapalhar furtividade.", 18.1),
  armor("ring-mail", "Cota de anéis", "Armadura pesada. CA base 14; costuma atrapalhar furtividade.", 18.1),
  armor("chain-mail", "Cota de malha", "Armadura pesada. CA base 16; exige força e costuma atrapalhar furtividade.", 25),
  armor("splint-armor", "Armadura segmentada", "Armadura pesada. CA base 17; exige força e costuma atrapalhar furtividade.", 27.2),
  armor("plate-armor", "Armadura de placas", "Armadura pesada. CA base 18; exige força e costuma atrapalhar furtividade.", 29.5),
  item("shield", "Escudo", "Escudo comum de madeira ou metal.", 2.7, "shield", 1, false, { equippable: true, equipSlot: "shield" }),

  // Munições
  item("arrows", "Flechas", "Munição para arcos.", 0.025, "ammunition", 20),
  item("crossbow-bolts", "Virotes de besta", "Munição para bestas.", 0.034, "ammunition", 20),
  item("sling-bullets", "Balas de funda", "Projéteis para fundas.", 0.034, "ammunition", 20),
  item("blowgun-needles", "Agulhas de zarabatana", "Munição leve para zarabatanas.", 0.005, "ammunition", 50),

  // Equipamento de aventura, consumíveis e suprimentos
  item("abacus", "Ábaco", "Instrumento simples para cálculos.", 0.9, "tool", 1, true, {}),
  item("acid-vial", "Ácido (frasco)", "Frasco corrosivo que pode ser arremessado.", 0.45, "throwable", 1, true, {"range":"6/18 m","damage":{"quantity":2,"sides":"d6"}}),
  item("alchemists-fire", "Fogo alquímico", "Substância pegajosa inflamável para arremesso.", 0.45, "throwable", 1, true, {"range":"6/18 m"}),
  item("antitoxin", "Antitoxina", "Dose preparada para ajudar contra venenos.", 0, "consumable", 1, true, {"useText":"Consumir uma dose."}),
  item("backpack", "Mochila", "Recipiente comum para transportar equipamento.", 2.25, "pack", 1, false, {}),
  item("ball-bearings", "Esferas de metal (saco)", "Pequenas esferas usadas para dificultar passagem.", 0.9, "gear", 1, true, {}),
  item("barrel", "Barril", "Recipiente grande de madeira.", 31.8, "gear", 1, false, {}),
  item("basket", "Cesto", "Recipiente leve de fibras trançadas.", 0.9, "gear", 1, false, {}),
  item("bedroll", "Saco de dormir", "Cobertura para repouso em viagem.", 3.2, "gear", 1, false, {}),
  item("bell", "Sino pequeno", "Sino portátil para sinais ou alarmes.", 0, "gear", 1, true, {}),
  item("blanket", "Cobertor", "Cobertura simples contra frio.", 1.35, "gear", 1, false, {}),
  item("block-and-tackle", "Roldana e polia", "Conjunto de cordas e polias para mover peso.", 2.25, "gear", 1, false, {}),
  item("book", "Livro", "Volume escrito de assunto variado.", 2.25, "gear", 1, false, {}),
  item("glass-bottle", "Garrafa de vidro", "Recipiente pequeno de vidro.", 0.9, "gear", 1, true, {}),
  item("bucket", "Balde", "Recipiente com alça.", 0.9, "gear", 1, false, {}),
  item("caltrops", "Estrepes (saco)", "Pontas metálicas espalhadas pelo chão.", 0.9, "gear", 1, true, {}),
  item("candle", "Vela", "Fonte pequena de iluminação.", 0, "gear", 10, true, {}),
  item("crossbow-bolt-case", "Estojo para virotes", "Estojo para transportar munição de besta.", 0.45, "gear", 1, false, {}),
  item("map-case", "Estojo para mapa ou pergaminho", "Tubo rígido para proteger documentos.", 0.45, "gear", 1, true, {}),
  item("chain", "Corrente (3 m)", "Corrente metálica resistente com 3 metros.", 4.5, "gear", 1, false, {}),
  item("chalk", "Giz", "Pequeno bastão para marcações.", 0, "gear", 10, true, {}),
  item("chest", "Baú", "Caixa de madeira reforçada.", 11.3, "gear", 1, false, {}),
  item("climbers-kit", "Kit de escalada", "Equipamento de segurança para escaladas.", 5.4, "tool", 1, false, {}),
  item("common-clothes", "Roupas comuns", "Conjunto simples para uso diário.", 1.35, "gear", 1, false, {}),
  item("costume-clothes", "Fantasia", "Roupa preparada para apresentação ou disfarce.", 1.8, "gear", 1, false, {}),
  item("fine-clothes", "Roupas finas", "Traje de boa qualidade para ocasiões formais.", 2.7, "gear", 1, false, {}),
  item("travelers-clothes", "Roupas de viajante", "Traje resistente para estrada.", 1.8, "gear", 1, false, {}),
  item("component-pouch", "Bolsa de componentes", "Bolsa organizada para componentes materiais de magia.", 0.9, "focus", 1, true, {}),
  item("crowbar", "Pé de cabra", "Barra metálica para aplicar alavanca.", 2.25, "tool", 1, false, {}),
  item("fishing-tackle", "Equipamento de pesca", "Linha, anzóis, pesos e acessórios de pesca.", 1.8, "tool", 1, false, {}),
  item("flask", "Frasco ou caneca", "Recipiente pequeno para líquidos.", 0.45, "gear", 1, true, {}),
  item("grappling-hook", "Arpéu", "Gancho metálico para prender cordas.", 1.8, "gear", 1, false, {}),
  item("hammer", "Martelo", "Ferramenta comum para cravar ou reparar.", 1.35, "tool", 1, false, {}),
  item("sledgehammer", "Marreta", "Martelo pesado para demolição.", 4.5, "tool", 1, false, {}),
  item("healers-kit", "Kit de curandeiro", "Suprimentos para estabilizar e tratar ferimentos.", 1.35, "consumable", 10, false, {"useText":"Gastar um uso do kit."}),
  item("holy-water", "Água benta (frasco)", "Água consagrada usada contra certas criaturas.", 0.45, "throwable", 1, true, {"range":"6/18 m","damage":{"quantity":2,"sides":"d6"}}),
  item("hourglass", "Ampulheta", "Instrumento para medir intervalos de tempo.", 0.45, "gear", 1, true, {}),
  item("hunting-trap", "Armadilha de caça", "Armadilha metálica acionada por pressão.", 11.3, "gear", 1, false, {}),
  item("ink", "Tinta (frasco)", "Tinta para escrita.", 0, "gear", 1, true, {}),
  item("ink-pen", "Pena de escrita", "Instrumento simples para escrever com tinta.", 0, "gear", 1, true, {}),
  item("jug", "Jarro", "Recipiente de cerâmica ou metal.", 1.8, "gear", 1, false, {}),
  item("ladder", "Escada (3 m)", "Escada portátil de madeira.", 11.3, "gear", 1, false, {}),
  item("lamp", "Lâmpada", "Fonte de luz alimentada por óleo.", 0.45, "gear", 1, true, {}),
  item("bullseye-lantern", "Lanterna furta-fogo", "Lanterna que concentra luz em uma direção.", 0.9, "gear", 1, false, {}),
  item("hooded-lantern", "Lanterna coberta", "Lanterna cuja luz pode ser abafada.", 0.9, "gear", 1, false, {}),
  item("lock", "Cadeado", "Fechadura portátil com chave.", 0.45, "gear", 1, true, {}),
  item("magnifying-glass", "Lente de aumento", "Lente para examinar detalhes pequenos.", 0, "tool", 1, true, {}),
  item("manacles", "Algemas", "Par de restrições metálicas com fechadura.", 2.7, "gear", 1, false, {}),
  item("mess-kit", "Kit de refeição", "Utensílios compactos para cozinhar e comer.", 0.45, "gear", 1, true, {}),
  item("steel-mirror", "Espelho de aço", "Pequena superfície metálica polida.", 0.25, "gear", 1, true, {}),
  item("oil-flask", "Óleo (frasco)", "Combustível para lâmpadas que também pode ser derramado.", 0.45, "throwable", 1, true, {"range":"6/18 m"}),
  item("paper", "Papel", "Folha para escrita ou desenho.", 0, "gear", 10, true, {}),
  item("parchment", "Pergaminho", "Folha resistente preparada para escrita.", 0, "gear", 10, true, {}),
  item("perfume", "Perfume (frasco)", "Fragrância concentrada em pequeno frasco.", 0, "gear", 1, true, {}),
  item("miners-pick", "Picareta de minerador", "Ferramenta para quebrar pedra e solo duro.", 4.5, "tool", 1, false, {}),
  item("piton", "Pítons", "Pinos metálicos para fixação em rocha.", 0.11, "gear", 10, true, {}),
  item("basic-poison", "Veneno básico (frasco)", "Toxina simples para aplicação em arma ou munição.", 0, "consumable", 1, true, {"useText":"Aplicar o conteúdo em uma arma ou munição."}),
  item("pole", "Vara (3 m)", "Vara longa de madeira.", 3.2, "gear", 1, false, {}),
  item("iron-pot", "Panela de ferro", "Recipiente resistente para cozinhar.", 4.5, "gear", 1, false, {}),
  item("healing-potion", "Poção de cura", "Consumível mágico que restaura pontos de vida.", 0.25, "consumable", 1, true, {"magicItem":true,"useText":"Beber ou administrar a poção."}),
  item("pouch", "Bolsa", "Pequena bolsa para moedas ou objetos.", 0.45, "gear", 1, true, {}),
  item("quiver", "Aljava", "Estojo para carregar flechas.", 0.45, "gear", 1, false, {}),
  item("portable-ram", "Aríete portátil", "Tronco reforçado para arrombar estruturas.", 15.9, "gear", 1, false, {}),
  item("rations", "Rações de viagem", "Uma porção diária de alimento seco.", 0.9, "supply", 10, true, {}),
  item("robes", "Vestes", "Traje longo comum entre estudiosos e conjuradores.", 1.8, "gear", 1, false, {}),
  item("hemp-rope", "Corda de cânhamo (15 m)", "Corda resistente com 15 metros.", 4.5, "gear", 1, false, {}),
  item("silk-rope", "Corda de seda (15 m)", "Corda leve e resistente com 15 metros.", 2.25, "gear", 1, false, {}),
  item("sack", "Saco", "Recipiente simples de tecido.", 0.25, "gear", 1, true, {}),
  item("merchants-scale", "Balança de mercador", "Balança portátil com pesos.", 1.35, "tool", 1, false, {}),
  item("sealing-wax", "Cera de lacre", "Cera para selar documentos.", 0, "gear", 1, true, {}),
  item("shovel", "Pá", "Ferramenta para cavar.", 2.25, "tool", 1, false, {}),
  item("signal-whistle", "Apito de sinalização", "Apito pequeno e audível à distância.", 0, "gear", 1, true, {}),
  item("signet-ring", "Anel de sinete", "Anel gravado para autenticar documentos.", 0, "gear", 1, true, {}),
  item("soap", "Sabão", "Barra simples para limpeza.", 0, "gear", 1, true, {}),
  item("spellbook", "Livro de magias", "Livro preparado para registrar fórmulas arcanas.", 1.35, "focus", 1, false, {}),
  item("iron-spikes", "Cravos de ferro", "Cravos robustos para fixação ou bloqueio.", 0.23, "gear", 10, true, {}),
  item("spyglass", "Luneta", "Instrumento óptico para observar à distância.", 0.45, "tool", 1, true, {}),
  item("tent", "Tenda para duas pessoas", "Abrigo portátil para acampamento.", 9.1, "gear", 1, false, {}),
  item("tinderbox", "Caixa de fogo", "Pederneira, aço e material inflamável.", 0.45, "gear", 1, true, {}),
  item("torch", "Tochas", "Fonte portátil de iluminação.", 0.45, "gear", 10, true, {}),
  item("vial", "Frasco pequeno", "Pequeno recipiente de vidro.", 0, "gear", 1, true, {}),
  item("waterskin", "Odre", "Recipiente de couro para água.", 2.25, "supply", 1, false, {}),
  item("whetstone", "Pedra de amolar", "Pedra pequena para manutenção de lâminas.", 0.45, "tool", 1, true, {}),

  // Ferramentas, kits e jogos
  item("alchemists-supplies", "Suprimentos de alquimista", "Instrumentos e reagentes para trabalho alquímico.", 3.6, "tool"),
  item("brewers-supplies", "Suprimentos de cervejeiro", "Equipamento para preparar bebidas fermentadas.", 4.1, "tool"),
  item("calligraphers-supplies", "Suprimentos de calígrafo", "Tintas, penas e materiais para escrita refinada.", 2.25, "tool"),
  item("carpenters-tools", "Ferramentas de carpinteiro", "Ferramentas para trabalhar madeira estrutural.", 2.7, "tool"),
  item("cartographers-tools", "Ferramentas de cartógrafo", "Instrumentos para criar e revisar mapas.", 2.7, "tool"),
  item("cobblers-tools", "Ferramentas de sapateiro", "Ferramentas para fabricar e reparar calçados.", 2.25, "tool"),
  item("cooks-utensils", "Utensílios de cozinheiro", "Panelas, facas e utensílios culinários.", 3.6, "tool"),
  item("glassblowers-tools", "Ferramentas de vidreiro", "Ferramentas para moldar vidro aquecido.", 2.25, "tool"),
  item("jewelers-tools", "Ferramentas de joalheiro", "Instrumentos finos para metais e gemas.", 0.9, "tool"),
  item("leatherworkers-tools", "Ferramentas de coureiro", "Ferramentas para trabalhar couro.", 2.25, "tool"),
  item("masons-tools", "Ferramentas de pedreiro", "Ferramentas para cortar e assentar pedra.", 3.6, "tool"),
  item("painters-supplies", "Suprimentos de pintor", "Pigmentos, pincéis e superfícies de mistura.", 2.25, "tool"),
  item("potters-tools", "Ferramentas de oleiro", "Ferramentas para modelar e queimar cerâmica.", 1.35, "tool"),
  item("smiths-tools", "Ferramentas de ferreiro", "Martelos, tenazes e instrumentos de forja.", 3.6, "tool"),
  item("tinkers-tools", "Ferramentas de funileiro", "Ferramentas para pequenos reparos e mecanismos.", 4.5, "tool"),
  item("weavers-tools", "Ferramentas de tecelão", "Instrumentos para produzir e reparar tecidos.", 2.25, "tool"),
  item("woodcarvers-tools", "Ferramentas de entalhador", "Ferramentas de precisão para entalhar madeira.", 2.25, "tool"),
  item("thieves-tools", "Ferramentas de ladrão", "Ferramentas para fechaduras e mecanismos delicados.", 0.45, "tool"),
  item("disguise-kit", "Kit de disfarce", "Cosméticos, tinturas e pequenos acessórios.", 1.35, "tool"),
  item("forgery-kit", "Kit de falsificação", "Materiais para imitar documentos e selos.", 2.25, "tool"),
  item("herbalism-kit", "Kit de herbalismo", "Instrumentos para identificar e preparar plantas.", 1.35, "tool"),
  item("navigators-tools", "Ferramentas de navegador", "Instrumentos para orientação e navegação.", 0.9, "tool"),
  item("poisoners-kit", "Kit de envenenador", "Instrumentos para manipular e preparar toxinas.", 0.9, "tool"),
  item("dice-set", "Conjunto de dados", "Dados usados em jogos de azar.", 0, "tool"),
  item("dragonchess-set", "Conjunto de xadrez dracônico", "Tabuleiro e peças de estratégia.", 0.25, "tool"),
  item("playing-card-set", "Baralho", "Cartas para jogos e apostas.", 0, "tool"),
  item("three-dragon-ante-set", "Baralho Três Dragões", "Cartas de um jogo popular em tavernas.", 0, "tool"),

  // Instrumentos musicais
  item("bagpipes", "Gaita de foles", "Instrumento de sopro com bolsa de ar.", 2.7, "instrument"),
  item("drum", "Tambor", "Instrumento de percussão portátil.", 1.35, "instrument"),
  item("dulcimer", "Dulcimer", "Instrumento de cordas percutidas.", 4.5, "instrument"),
  item("flute", "Flauta", "Instrumento de sopro leve.", 0.45, "instrument"),
  item("lute", "Alaúde", "Instrumento de cordas dedilhadas.", 0.9, "instrument"),
  item("lyre", "Lira", "Instrumento de cordas com armação aberta.", 0.9, "instrument"),
  item("horn", "Trompa", "Instrumento de sopro curvo.", 0.9, "instrument"),
  item("pan-flute", "Flauta de pã", "Conjunto de tubos de comprimentos diferentes.", 0.9, "instrument"),
  item("shawm", "Charamela", "Instrumento de sopro de som forte.", 0.45, "instrument"),
  item("viol", "Viola", "Instrumento de cordas tocado com arco.", 0.45, "instrument"),

  // Focos de conjuração
  item("arcane-crystal", "Cristal arcano", "Cristal preparado como foco arcano.", 0.45, "focus"),
  item("arcane-orb", "Orbe arcano", "Esfera usada como foco arcano.", 1.35, "focus"),
  item("arcane-rod", "Bastão arcano", "Bastão curto usado como foco arcano.", 0.9, "focus"),
  item("arcane-staff", "Cajado arcano", "Cajado usado como foco arcano.", 1.8, "focus"),
  item("arcane-wand", "Varinha arcana", "Varinha usada como foco arcano.", 0.45, "focus"),
  item("druidic-sprig", "Ramo de visco", "Ramo preparado como foco druídico.", 0, "focus"),
  item("druidic-totem", "Totem druídico", "Pequeno objeto natural usado como foco.", 0, "focus"),
  item("druidic-staff", "Cajado druídico", "Cajado de madeira usado como foco druídico.", 1.8, "focus"),
  item("druidic-yew-wand", "Varinha de teixo", "Varinha de madeira usada como foco druídico.", 0.45, "focus"),
  item("holy-amulet", "Amuleto sagrado", "Símbolo religioso usado como foco divino.", 0, "focus"),
  item("holy-emblem", "Emblema sagrado", "Símbolo aplicado a escudo, roupa ou objeto.", 0, "focus"),
  item("holy-reliquary", "Relicário", "Pequeno recipiente religioso usado como foco.", 0.9, "focus"),

  // Pacotes de equipamento
  item("burglars-pack", "Pacote de assaltante", "Mochila com ferramentas e suprimentos para infiltração.", 21.3, "pack", 1, false),
  item("diplomats-pack", "Pacote de diplomata", "Baú com roupas, escrita e itens de apresentação.", 17.7, "pack", 1, false),
  item("dungeoneers-pack", "Pacote de explorador de masmorras", "Mochila com luz, comida, corda e ferramentas de exploração.", 27.7, "pack", 1, false),
  item("entertainers-pack", "Pacote de artista", "Mochila com figurinos, comida e itens de apresentação.", 19, "pack", 1, false),
  item("explorers-pack", "Pacote de explorador", "Mochila com equipamento básico de viagem e acampamento.", 26.8, "pack", 1, false),
  item("priests-pack", "Pacote de sacerdote", "Mochila com vestes, oferendas e suprimentos religiosos.", 10.9, "pack", 1, false),
  item("scholars-pack", "Pacote de estudioso", "Mochila com livros, escrita e pesquisa.", 4.9, "pack", 1, false),

  // Equipamento para montarias
  item("animal-feed", "Ração para animais", "Uma porção diária de alimento para montaria.", 4.5, "supply", 1, false),
  item("bit-and-bridle", "Freio e rédeas", "Equipamento para conduzir uma montaria.", 0.45, "gear", 1, false),
  item("saddlebags", "Alforjes", "Bolsas para transportar carga em montaria.", 3.6, "pack", 1, false),
  item("pack-saddle", "Sela de carga", "Sela destinada ao transporte de mercadorias.", 6.8, "gear", 1, false),
  item("riding-saddle", "Sela de montaria", "Sela comum para cavalgada.", 11.3, "gear", 1, false),
]

export function cloneCompendiumItem(item: Itemmable): Itemmable {
  return {
    ...structuredClone(item),
    id: crypto.randomUUID(),
  }
}

export function itemJsonTemplate(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "Novo item",
    desc: "Descrição do item.",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: true,
    kind: "gear",
  }
}

export function parseItemJson(value: string): Itemmable {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("O JSON deve representar um único item.")
  }

  const item = parsed as Partial<Itemmable>
  if (typeof item.name !== "string" || !item.name.trim()) {
    throw new Error("O item precisa possuir um nome.")
  }

  return {
    ...itemJsonTemplate(),
    ...item,
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : crypto.randomUUID(),
    name: item.name.trim(),
    desc: typeof item.desc === "string" ? item.desc : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    weight: Math.max(0, Number(item.weight) || 0),
    pocketable: item.pocketable !== false,
    kind: item.kind ?? "gear",
  } as Itemmable
}
