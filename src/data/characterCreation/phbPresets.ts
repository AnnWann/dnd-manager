import type { Ability } from "../../models/abilities/Ability"
import type { CharacterBackground } from "../../models/characters/CharacterBackground"
import type { Itemmable } from "../../models/items/item"
import type {
  CharacterRace,
  CreatureSize,
} from "../../models/races/CharacterRace"
import type { Race } from "../../models/races/Race"
import type { Attribute } from "../../models/sheet/Attribute"
import type { ClassName } from "../../models/sheet/Class"
import type { Proficiency, ProficiencyCategory } from "../../models/sheet/Proficiency"
import type { Skill } from "../../models/sheet/Skills"
import type { DieSides } from "../../models/dice/Die"

export type RacePreset = {
  id: string
  name: string
  summary: string
  race: Race
  subrace: string
  size: CreatureSize
  speedBonus: number
  attributeBonus: Partial<Record<Attribute, number>>
  abilities: Ability[]
  proficiencies: Proficiency[]
}

export type BackgroundPreset = CharacterBackground & {
  summary: string
}

export type ClassPreset = {
  id: ClassName
  name: string
  summary: string
  hitDie: DieSides
  savingThrows: Attribute[]
  skillChoices: number
  availableSkills: Skill[]
  proficiencies: Proficiency[]
  recommendedAttributes: Record<Attribute, number>
}

const ability = (id: string, name: string, description: string): Ability => ({
  id: `phb-race-${id}`,
  name,
  description,
  kind: "passive",
  category: "general",
})

const proficiency = (
  id: string,
  name: string,
  category: ProficiencyCategory,
  notes?: string,
): Proficiency => ({ id: `phb-${id}`, name, category, notes })

const item = (name: string, quantity = 1): Itemmable => ({
  id: crypto.randomUUID(),
  name,
  desc: "Equipamento inicial concedido pelo antecedente.",
  notes: "",
  quantity,
  weight: 0,
  pocketable: false,
  kind: "common",
})

const commonLanguages = [
  proficiency("language-common", "Comum", "language"),
]

export const PHB_RACE_PRESETS: RacePreset[] = [
  {
    id: "human",
    name: "Humano",
    summary: "Versátil, com +1 em todos os atributos.",
    race: "human",
    subrace: "",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    abilities: [],
    proficiencies: commonLanguages,
  },
  {
    id: "variant-human",
    name: "Humano variante",
    summary: "Dois atributos recebem +1; inclui uma perícia e um talento para configurar depois.",
    race: "human",
    subrace: "Variante",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { str: 1, dex: 1 },
    abilities: [
      ability(
        "variant-human-feat",
        "Talento inicial",
        "Escolha e adicione um talento na aba de habilidades.",
      ),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("variant-human-skill", "Uma perícia à escolha", "other"),
    ],
  },
  {
    id: "hill-dwarf",
    name: "Anão da colina",
    summary: "Resistente e sábio, com treinamento anão tradicional.",
    race: "dwarf",
    subrace: "Anão da Colina",
    size: "medium",
    speedBonus: -1.5,
    attributeBonus: { con: 2, wis: 1 },
    abilities: [
      ability("dwarf-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("dwarven-resilience", "Resiliência anã", "Resistência natural contra venenos."),
      ability("dwarven-toughness", "Tenacidade anã", "Recebe pontos de vida adicionais conforme avança de nível."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("language-dwarvish", "Anão", "language"),
      proficiency("dwarf-weapons", "Machados e martelos anões", "weapon"),
      proficiency("dwarf-tool", "Uma ferramenta de artesão anã", "tool"),
    ],
  },
  {
    id: "mountain-dwarf",
    name: "Anão da montanha",
    summary: "Forte e treinado com armaduras.",
    race: "dwarf",
    subrace: "Anão da Montanha",
    size: "medium",
    speedBonus: -1.5,
    attributeBonus: { con: 2, str: 2 },
    abilities: [
      ability("mountain-dwarf-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("mountain-dwarf-resilience", "Resiliência anã", "Resistência natural contra venenos."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("mountain-language-dwarvish", "Anão", "language"),
      proficiency("mountain-dwarf-weapons", "Machados e martelos anões", "weapon"),
      proficiency("mountain-dwarf-armor", "Armaduras leves e médias", "armor"),
    ],
  },
  {
    id: "high-elf",
    name: "Alto elfo",
    summary: "Ágil, estudioso e naturalmente mágico.",
    race: "elf",
    subrace: "Alto Elfo",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { dex: 2, int: 1 },
    abilities: [
      ability("high-elf-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("fey-ancestry", "Ancestral feérico", "Defesas naturais contra encantamento e sono mágico."),
      ability("trance", "Transe", "Descansa por meio de meditação élfica."),
      ability("high-elf-cantrip", "Truque de alto elfo", "Escolha um truque de mago na aba de magias."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("high-elf-language", "Élfico", "language"),
      proficiency("high-elf-weapons", "Armas élficas tradicionais", "weapon"),
      proficiency("high-elf-perception", "Percepção", "skill"),
    ],
  },
  {
    id: "wood-elf",
    name: "Elfo da floresta",
    summary: "Rápido, atento e adaptado a ambientes naturais.",
    race: "elf",
    subrace: "Elfo da Floresta",
    size: "medium",
    speedBonus: 1.5,
    attributeBonus: { dex: 2, wis: 1 },
    abilities: [
      ability("wood-elf-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("wood-fey-ancestry", "Ancestral feérico", "Defesas naturais contra encantamento e sono mágico."),
      ability("wood-trance", "Transe", "Descansa por meio de meditação élfica."),
      ability("mask-wild", "Máscara da natureza", "Consegue se ocultar em fenômenos naturais leves."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("wood-language", "Élfico", "language"),
      proficiency("wood-weapons", "Armas élficas tradicionais", "weapon"),
      proficiency("wood-perception", "Percepção", "skill"),
    ],
  },
  {
    id: "drow",
    name: "Drow",
    summary: "Elfo subterrâneo com magia inata e sensibilidade à luz intensa.",
    race: "elf",
    subrace: "Drow",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { dex: 2, cha: 1 },
    abilities: [
      ability("drow-superior-darkvision", "Visão no escuro superior", "Possui alcance de visão no escuro ampliado."),
      ability("drow-fey-ancestry", "Ancestral feérico", "Defesas naturais contra encantamento e sono mágico."),
      ability("drow-magic", "Magia drow", "Recebe magia inata conforme avança de nível."),
      ability("sunlight-sensitivity", "Sensibilidade à luz solar", "Luz solar direta dificulta certas ações visuais."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("drow-elvish", "Élfico", "language"),
      proficiency("drow-undercommon", "Subcomum", "language"),
      proficiency("drow-weapons", "Armas drow tradicionais", "weapon"),
      proficiency("drow-perception", "Percepção", "skill"),
    ],
  },
  {
    id: "lightfoot-halfling",
    name: "Halfling pés-leves",
    summary: "Pequeno, sortudo e sociável.",
    race: "halfling",
    subrace: "Pés-Leves",
    size: "small",
    speedBonus: -1.5,
    attributeBonus: { dex: 2, cha: 1 },
    abilities: [
      ability("halfling-lucky", "Sortudo", "Pode transformar resultados especialmente ruins em uma nova tentativa."),
      ability("halfling-brave", "Bravura", "Possui resistência natural ao medo."),
      ability("lightfoot-stealth", "Furtividade natural", "Pode se esconder usando criaturas maiores como cobertura."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("halfling-language", "Halfling", "language"),
    ],
  },
  {
    id: "stout-halfling",
    name: "Halfling robusto",
    summary: "Pequeno, sortudo e resistente.",
    race: "halfling",
    subrace: "Robusto",
    size: "small",
    speedBonus: -1.5,
    attributeBonus: { dex: 2, con: 1 },
    abilities: [
      ability("stout-lucky", "Sortudo", "Pode transformar resultados especialmente ruins em uma nova tentativa."),
      ability("stout-brave", "Bravura", "Possui resistência natural ao medo."),
      ability("stout-resilience", "Resiliência dos robustos", "Resistência natural contra venenos."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("stout-language", "Halfling", "language"),
    ],
  },
  {
    id: "dragonborn",
    name: "Draconato",
    summary: "Descendente de dragões, com sopro e resistência elemental.",
    race: "dragonborn",
    subrace: "Linhagem dracônica a definir",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { str: 2, cha: 1 },
    abilities: [
      ability("dragonborn-ancestry", "Ancestral dracônico", "Escolha um tipo de dragão e o elemento ligado à linhagem."),
      ability("dragonborn-breath", "Arma de sopro", "Expele energia elemental ligada à linhagem."),
      ability("dragonborn-resistance", "Resistência dracônica", "Resistência ao elemento ligado à linhagem."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("dragonborn-language", "Dracônico", "language"),
    ],
  },
  {
    id: "forest-gnome",
    name: "Gnomo da floresta",
    summary: "Pequeno, inteligente e ligado a ilusões e animais.",
    race: "gnome",
    subrace: "Gnomo da Floresta",
    size: "small",
    speedBonus: -1.5,
    attributeBonus: { int: 2, dex: 1 },
    abilities: [
      ability("gnome-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("gnome-cunning", "Esperteza gnômica", "Defesas mentais aprimoradas contra magia."),
      ability("forest-illusion", "Ilusionista natural", "Conhece uma pequena ilusão inata."),
      ability("small-beasts", "Falar com pequenos animais", "Consegue comunicar ideias simples a feras pequenas."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("forest-gnome-language", "Gnômico", "language"),
    ],
  },
  {
    id: "rock-gnome",
    name: "Gnomo das rochas",
    summary: "Pequeno, inteligente e habilidoso com mecanismos.",
    race: "gnome",
    subrace: "Gnomo das Rochas",
    size: "small",
    speedBonus: -1.5,
    attributeBonus: { int: 2, con: 1 },
    abilities: [
      ability("rock-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("rock-cunning", "Esperteza gnômica", "Defesas mentais aprimoradas contra magia."),
      ability("artificers-lore", "Conhecimento de artífice", "Reconhece melhor objetos mágicos, alquímicos e tecnológicos."),
      ability("tinker", "Engenhoqueiro", "Constrói pequenos dispositivos mecânicos."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("rock-gnome-language", "Gnômico", "language"),
      proficiency("tinker-tools", "Ferramentas de funileiro", "tool"),
    ],
  },
  {
    id: "half-elf",
    name: "Meio-elfo",
    summary: "Carismático e flexível; os bônus menores podem ser redistribuídos.",
    race: "half-elf",
    subrace: "",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { cha: 2, dex: 1, con: 1 },
    abilities: [
      ability("half-elf-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("half-elf-fey", "Ancestral feérico", "Defesas naturais contra encantamento e sono mágico."),
      ability("skill-versatility", "Versatilidade em perícias", "Escolha duas perícias adicionais."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("half-elf-elvish", "Élfico", "language"),
      proficiency("half-elf-extra-language", "Um idioma à escolha", "language"),
    ],
  },
  {
    id: "half-orc",
    name: "Meio-orc",
    summary: "Forte, resistente e intimidador.",
    race: "half-orc",
    subrace: "",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { str: 2, con: 1 },
    abilities: [
      ability("half-orc-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("relentless-endurance", "Resistência implacável", "Uma vez antes de descansar, pode permanecer de pé quando seria derrubado."),
      ability("savage-attacks", "Ataques selvagens", "Críticos corpo a corpo causam dano adicional."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("half-orc-orc", "Orc", "language"),
      proficiency("half-orc-intimidation", "Intimidação", "skill"),
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    summary: "Carismático, resistente ao fogo e dotado de magia infernal.",
    race: "tiefling",
    subrace: "Infernal",
    size: "medium",
    speedBonus: 0,
    attributeBonus: { cha: 2, int: 1 },
    abilities: [
      ability("tiefling-darkvision", "Visão no escuro", "Enxerga no escuro até o alcance racial habitual."),
      ability("hellish-resistance", "Resistência infernal", "Possui resistência a fogo."),
      ability("infernal-legacy", "Legado infernal", "Recebe magia inata conforme avança de nível."),
    ],
    proficiencies: [
      ...commonLanguages,
      proficiency("tiefling-infernal", "Infernal", "language"),
    ],
  },
]

const background = (
  id: string,
  name: string,
  summary: string,
  description: string,
  skills: Skill[],
  proficiencies: Proficiency[],
  equipment: string[],
  featureName: string,
  featureDescription: string,
): BackgroundPreset => ({
  id,
  name,
  summary,
  description,
  skillProficiencies: skills,
  proficiencies,
  startingEquipment: equipment.map((entry) => item(entry)),
  featureName,
  featureDescription,
})

export const PHB_BACKGROUND_PRESETS: BackgroundPreset[] = [
  background("acolyte", "Acólito", "Serviço em um templo ou ordem religiosa.", "O personagem viveu entre sacerdotes, ritos e comunidades de fé.", ["insight", "religion"], [proficiency("acolyte-language-1", "Idioma adicional 1", "language"), proficiency("acolyte-language-2", "Idioma adicional 2", "language")], ["Símbolo sagrado", "Livro de orações", "Incenso", "Vestes", "Roupas comuns"], "Abrigo dos fiéis", "Comunidades da mesma fé tendem a oferecer auxílio básico."),
  background("charlatan", "Charlatão", "Identidades falsas, golpes e falsificações.", "O personagem aprendeu a sobreviver por meio de truques, disfarces e histórias convincentes.", ["deception", "sleightOfHand"], [proficiency("charlatan-disguise", "Kit de disfarce", "tool"), proficiency("charlatan-forgery", "Kit de falsificação", "tool")], ["Roupas finas", "Kit de disfarce", "Ferramentas de golpe"], "Identidade falsa", "Mantém documentos, roupas e contatos ligados a uma identidade alternativa."),
  background("criminal", "Criminoso", "Experiência com redes criminosas e atividades clandestinas.", "O personagem trabalhou no submundo e conhece seus códigos, contatos e riscos.", ["deception", "stealth"], [proficiency("criminal-game", "Um conjunto de jogo", "game"), proficiency("criminal-thieves", "Ferramentas de ladrão", "tool")], ["Pé de cabra", "Roupas escuras", "Bolsa"], "Contato criminoso", "Conhece alguém capaz de transmitir mensagens e facilitar contato com o submundo."),
  background("entertainer", "Artista", "Apresentações, viagens e vida diante do público.", "O personagem viveu de música, atuação, dança, histórias ou outra forma de espetáculo.", ["acrobatics", "performance"], [proficiency("entertainer-disguise", "Kit de disfarce", "tool"), proficiency("entertainer-instrument", "Um instrumento musical", "instrument")], ["Instrumento musical", "Presente de admirador", "Traje"], "Pela demanda popular", "Consegue encontrar espaços para se apresentar em troca de acolhimento modesto."),
  background("folk-hero", "Herói do povo", "Origem humilde e reputação entre pessoas comuns.", "O personagem realizou algo que o tornou símbolo de esperança para sua comunidade.", ["animalHandling", "survival"], [proficiency("folk-artisan", "Uma ferramenta de artesão", "tool"), proficiency("folk-vehicle", "Veículos terrestres", "vehicle")], ["Ferramenta de artesão", "Pá", "Panela de ferro", "Roupas comuns"], "Hospitalidade rústica", "Pessoas comuns tendem a oferecer abrigo e proteção quando possível."),
  background("guild-artisan", "Artesão de guilda", "Ofício reconhecido e vínculos profissionais.", "O personagem foi treinado em um ofício e pertence ou pertenceu a uma guilda.", ["insight", "persuasion"], [proficiency("guild-tool", "Uma ferramenta de artesão", "tool"), proficiency("guild-language", "Um idioma adicional", "language")], ["Ferramenta de artesão", "Carta de apresentação", "Roupas de viajante"], "Associação à guilda", "Pode solicitar contato, hospedagem e informações à própria guilda."),
  background("hermit", "Eremita", "Anos de isolamento, contemplação ou estudo.", "O personagem afastou-se da sociedade por motivos espirituais, científicos ou pessoais.", ["medicine", "religion"], [proficiency("hermit-herbalism", "Kit de herbalismo", "tool"), proficiency("hermit-language", "Um idioma adicional", "language")], ["Estojo de pergaminhos", "Cobertor", "Kit de herbalismo", "Roupas comuns"], "Descoberta", "O isolamento revelou uma informação ou verdade significativa definida com o mestre."),
  background("noble", "Nobre", "Título, linhagem e educação privilegiada.", "O personagem cresceu entre famílias influentes, etiqueta e disputas de poder.", ["history", "persuasion"], [proficiency("noble-game", "Um conjunto de jogo", "game"), proficiency("noble-language", "Um idioma adicional", "language")], ["Roupas finas", "Anel de sinete", "Pergaminho de linhagem"], "Posição de privilégio", "É reconhecido como membro da elite e pode conseguir audiências ou tratamento diferenciado."),
  background("outlander", "Forasteiro", "Vida longe dos grandes centros urbanos.", "O personagem cresceu viajando, caçando ou sobrevivendo em regiões selvagens.", ["athletics", "survival"], [proficiency("outlander-instrument", "Um instrumento musical", "instrument"), proficiency("outlander-language", "Um idioma adicional", "language")], ["Cajado", "Armadilha de caça", "Troféu animal", "Roupas de viajante"], "Andarilho", "Recorda mapas e encontra alimento e água em ambientes adequados."),
  background("sage", "Sábio", "Pesquisa, bibliotecas e estudo acadêmico.", "O personagem dedicou anos ao conhecimento e sabe onde procurar respostas.", ["arcana", "history"], [proficiency("sage-language-1", "Idioma adicional 1", "language"), proficiency("sage-language-2", "Idioma adicional 2", "language")], ["Frasco de tinta", "Pena", "Pequena faca", "Carta de colega", "Roupas comuns"], "Pesquisador", "Mesmo sem saber uma resposta, normalmente sabe onde ou com quem começar a procurar."),
  background("sailor", "Marinheiro", "Experiência em navios, portos e rotas marítimas.", "O personagem serviu a bordo e conhece trabalho de convés, navegação e costumes portuários.", ["athletics", "perception"], [proficiency("sailor-navigation", "Ferramentas de navegador", "tool"), proficiency("sailor-vehicle", "Veículos aquáticos", "vehicle")], ["Cavilha de amarração", "Corda de seda", "Amuleto da sorte", "Roupas comuns"], "Passagem em navio", "Pode tentar conseguir transporte marítimo para si e seus companheiros por meio de contatos."),
  background("soldier", "Soldado", "Treinamento militar e experiência em campanha.", "O personagem serviu em um exército, milícia, companhia ou força semelhante.", ["athletics", "intimidation"], [proficiency("soldier-game", "Um conjunto de jogo", "game"), proficiency("soldier-vehicle", "Veículos terrestres", "vehicle")], ["Insígnia de patente", "Troféu de inimigo", "Conjunto de jogo", "Roupas comuns"], "Patente militar", "Integrantes da organização militar reconhecem sua posição e podem prestar ajuda limitada."),
  background("urchin", "Órfão", "Sobrevivência nas ruas e conhecimento urbano.", "O personagem cresceu sem proteção estável, aprendendo rotas, esconderijos e oportunidades nas cidades.", ["sleightOfHand", "stealth"], [proficiency("urchin-disguise", "Kit de disfarce", "tool"), proficiency("urchin-thieves", "Ferramentas de ladrão", "tool")], ["Pequena faca", "Mapa da cidade", "Mascote pequeno", "Lembrança familiar", "Roupas comuns"], "Segredos da cidade", "Encontra rotas rápidas por ruas, vielas e passagens urbanas."),
]

const ALL_SKILLS: Skill[] = [
  "acrobatics", "animalHandling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleightOfHand", "stealth", "survival",
]

const classPreset = (
  id: ClassName,
  name: string,
  summary: string,
  hitDie: DieSides,
  savingThrows: Attribute[],
  skillChoices: number,
  availableSkills: Skill[],
  proficiencies: Proficiency[],
  recommendedAttributes: Record<Attribute, number>,
): ClassPreset => ({
  id,
  name,
  summary,
  hitDie,
  savingThrows,
  skillChoices,
  availableSkills,
  proficiencies,
  recommendedAttributes,
})

export const PHB_CLASS_PRESETS: ClassPreset[] = [
  classPreset("barbarian", "Bárbaro", "Combatente resistente movido por fúria.", "d12", ["str", "con"], 2, ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"], [proficiency("barbarian-armor", "Armaduras leves e médias", "armor"), proficiency("barbarian-shield", "Escudos", "shield"), proficiency("barbarian-weapons", "Armas simples e marciais", "weapon")], { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }),
  classPreset("bard", "Bardo", "Especialista versátil, artista e conjurador.", "d8", ["dex", "cha"], 3, ALL_SKILLS, [proficiency("bard-armor", "Armaduras leves", "armor"), proficiency("bard-weapons", "Armas de bardo", "weapon"), proficiency("bard-instruments", "Três instrumentos musicais", "instrument")], { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 }),
  classPreset("cleric", "Clérigo", "Conjurador divino com boa defesa e suporte.", "d8", ["wis", "cha"], 2, ["history", "insight", "medicine", "persuasion", "religion"], [proficiency("cleric-armor", "Armaduras leves e médias", "armor"), proficiency("cleric-shield", "Escudos", "shield"), proficiency("cleric-weapons", "Armas simples", "weapon")], { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 }),
  classPreset("druid", "Druida", "Conjurador ligado à natureza e à transformação.", "d8", ["int", "wis"], 2, ["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"], [proficiency("druid-armor", "Armaduras leves e médias não metálicas", "armor"), proficiency("druid-shield", "Escudos não metálicos", "shield"), proficiency("druid-weapons", "Armas druídicas", "weapon"), proficiency("druid-herbalism", "Kit de herbalismo", "tool")], { str: 8, dex: 13, con: 14, int: 12, wis: 15, cha: 10 }),
  classPreset("fighter", "Guerreiro", "Combatente altamente adaptável.", "d10", ["str", "con"], 2, ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"], [proficiency("fighter-armor", "Todas as armaduras", "armor"), proficiency("fighter-shield", "Escudos", "shield"), proficiency("fighter-weapons", "Armas simples e marciais", "weapon")], { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }),
  classPreset("monk", "Monge", "Artista marcial móvel e disciplinado.", "d8", ["str", "dex"], 2, ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], [proficiency("monk-weapons", "Armas simples e espadas curtas", "weapon"), proficiency("monk-tool", "Uma ferramenta ou instrumento", "tool")], { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 }),
  classPreset("paladin", "Paladino", "Campeão juramentado com magia e defesa pesada.", "d10", ["wis", "cha"], 2, ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], [proficiency("paladin-armor", "Todas as armaduras", "armor"), proficiency("paladin-shield", "Escudos", "shield"), proficiency("paladin-weapons", "Armas simples e marciais", "weapon")], { str: 15, dex: 8, con: 14, int: 10, wis: 12, cha: 13 }),
  classPreset("ranger", "Patrulheiro", "Explorador marcial com perícias e magia natural.", "d10", ["str", "dex"], 3, ["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], [proficiency("ranger-armor", "Armaduras leves e médias", "armor"), proficiency("ranger-shield", "Escudos", "shield"), proficiency("ranger-weapons", "Armas simples e marciais", "weapon")], { str: 12, dex: 15, con: 14, int: 10, wis: 13, cha: 8 }),
  classPreset("rogue", "Ladino", "Especialista furtivo e preciso.", "d8", ["dex", "int"], 4, ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleightOfHand", "stealth"], [proficiency("rogue-armor", "Armaduras leves", "armor"), proficiency("rogue-weapons", "Armas de ladino", "weapon"), proficiency("rogue-thieves", "Ferramentas de ladrão", "tool")], { str: 8, dex: 15, con: 13, int: 14, wis: 12, cha: 10 }),
  classPreset("sorcerer", "Feiticeiro", "Conjurador inato de grande poder mágico.", "d6", ["con", "cha"], 2, ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], [proficiency("sorcerer-weapons", "Armas de feiticeiro", "weapon")], { str: 8, dex: 13, con: 14, int: 10, wis: 12, cha: 15 }),
  classPreset("warlock", "Bruxo", "Conjurador vinculado a um patrono sobrenatural.", "d8", ["wis", "cha"], 2, ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], [proficiency("warlock-armor", "Armaduras leves", "armor"), proficiency("warlock-weapons", "Armas simples", "weapon")], { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 }),
  classPreset("wizard", "Mago", "Estudioso arcano com amplo repertório de magias.", "d6", ["int", "wis"], 2, ["arcana", "history", "insight", "investigation", "medicine", "religion"], [proficiency("wizard-weapons", "Armas de mago", "weapon")], { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }),
]

export const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: "Acrobacia",
  animalHandling: "Adestrar Animais",
  arcana: "Arcanismo",
  athletics: "Atletismo",
  deception: "Enganação",
  history: "História",
  insight: "Intuição",
  intimidation: "Intimidação",
  investigation: "Investigação",
  medicine: "Medicina",
  nature: "Natureza",
  perception: "Percepção",
  performance: "Atuação",
  persuasion: "Persuasão",
  religion: "Religião",
  sleightOfHand: "Prestidigitação",
  stealth: "Furtividade",
  survival: "Sobrevivência",
}

export function racePresetToCharacterRace(preset: RacePreset): CharacterRace {
  return {
    race: preset.race,
    subrace: preset.subrace,
    naturalAbilities: preset.abilities.map((entry) => ({ ...entry })),
    attributeBonus: { ...preset.attributeBonus },
    proficiencies: preset.proficiencies.map((entry) => ({ ...entry })),
    size: preset.size,
    mobility: 9 + preset.speedBonus,
    speedBonus: undefined,
  }
}
