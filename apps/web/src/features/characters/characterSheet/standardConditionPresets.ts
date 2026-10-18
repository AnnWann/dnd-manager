export type StandardConditionPreset = {
  id: string
  name: string
  description: string
  behavior: string
  tags: string[]
}

/**
 * Resumos próprios das condições mais comuns de D&D. Os textos são atalhos de
 * mesa e permanecem editáveis porque duração, fonte e exceções dependem do
 * efeito que aplicou a condição.
 */
export const STANDARD_CONDITION_PRESETS: StandardConditionPreset[] = [
  {
    id: "grappled",
    name: "Agarrado",
    description: "O personagem está sendo segurado ou preso por outra criatura ou efeito.",
    behavior: "A velocidade se torna 0 e não pode receber aumentos. A condição termina quando a fonte deixa de conseguir manter o personagem preso ou quando um efeito o remove do alcance da fonte.",
    tags: ["física", "movimento", "controle"],
  },
  {
    id: "frightened",
    name: "Amedrontado",
    description: "O personagem está dominado pelo medo de uma criatura, objeto ou situação.",
    behavior: "Enquanto puder perceber a fonte do medo, sofre desvantagem em testes de atributo e jogadas de ataque e não pode se aproximar voluntariamente dela.",
    tags: ["mental", "medo", "debilitante"],
  },
  {
    id: "stunned",
    name: "Atordoado",
    description: "O personagem está temporariamente incapaz de reagir com clareza.",
    behavior: "Fica incapacitado, não pode se mover e fala apenas com dificuldade. Falha automaticamente em salvaguardas de Força e Destreza, e ataques contra ele possuem vantagem.",
    tags: ["debilitante", "incapacitado", "controle"],
  },
  {
    id: "prone",
    name: "Caído",
    description: "O personagem está no chão.",
    behavior: "Só pode se deslocar rastejando até se levantar. Seus ataques têm desvantagem. Ataques feitos a até 1,5 m contra ele têm vantagem; ataques feitos de mais longe têm desvantagem.",
    tags: ["física", "movimento", "posição"],
  },
  {
    id: "blinded",
    name: "Cego",
    description: "O personagem não consegue enxergar.",
    behavior: "Falha automaticamente em testes que dependam da visão. Seus ataques têm desvantagem, e ataques contra ele possuem vantagem.",
    tags: ["sentidos", "visão", "debilitante"],
  },
  {
    id: "concentrating",
    name: "Concentrando",
    description: "O personagem está mantendo um efeito que exige concentração.",
    behavior: "Ao sofrer dano, deve realizar o teste de concentração normalmente. Iniciar outra concentração ou falhar no teste encerra esta condição.",
    tags: ["dnd-manager:concentrating", "magia", "concentração"],
  },
  {
    id: "charmed",
    name: "Enfeitiçado",
    description: "O personagem está sob influência sobrenatural de outra criatura.",
    behavior: "Não pode atacar o responsável pelo encanto nem escolhê-lo como alvo de efeitos nocivos. A fonte possui vantagem em interações sociais dirigidas ao personagem.",
    tags: ["mental", "encantamento", "controle"],
  },
  {
    id: "poisoned",
    name: "Envenenado",
    description: "Uma toxina, veneno ou efeito semelhante prejudica o personagem.",
    behavior: "Sofre desvantagem em jogadas de ataque e testes de atributo enquanto a condição permanecer.",
    tags: ["veneno", "debilitante"],
  },
  {
    id: "exhaustion",
    name: "Exausto",
    description: "O personagem acumulou um ou mais níveis de exaustão.",
    behavior: "Registre o nível atual e aplique os efeitos previstos pela versão de regras adotada pela mesa. Use as notas da condição para controlar níveis, penalidades e recuperação.",
    tags: ["exaustão", "níveis", "debilitante"],
  },
  {
    id: "restrained",
    name: "Impedido",
    description: "O personagem está fortemente preso, imobilizado ou contido.",
    behavior: "A velocidade se torna 0. Seus ataques têm desvantagem, ataques contra ele possuem vantagem e suas salvaguardas de Destreza têm desvantagem.",
    tags: ["física", "movimento", "controle"],
  },
  {
    id: "incapacitated",
    name: "Incapacitado",
    description: "O personagem não consegue agir normalmente.",
    behavior: "Não pode realizar ações nem reações enquanto a condição permanecer.",
    tags: ["incapacitado", "controle"],
  },
  {
    id: "unconscious",
    name: "Inconsciente",
    description: "O personagem perdeu a consciência e não percebe o ambiente.",
    behavior: "Fica incapacitado, não pode se mover nem falar, solta o que estiver segurando e cai. Falha automaticamente em salvaguardas de Força e Destreza; ataques contra ele possuem vantagem e acertos a até 1,5 m são críticos.",
    tags: ["incapacitado", "inconsciente", "debilitante"],
  },
  {
    id: "invisible",
    name: "Invisível",
    description: "O personagem não pode ser visto normalmente.",
    behavior: "Não pode ser visto sem magia ou sentidos especiais. Seus ataques possuem vantagem e ataques contra ele têm desvantagem, desde que o atacante não consiga percebê-lo por outro meio.",
    tags: ["visão", "ocultação", "mágica"],
  },
  {
    id: "paralyzed",
    name: "Paralisado",
    description: "O personagem perdeu o controle do próprio corpo.",
    behavior: "Fica incapacitado, não pode se mover nem falar e falha automaticamente em salvaguardas de Força e Destreza. Ataques contra ele possuem vantagem e acertos a até 1,5 m são críticos.",
    tags: ["incapacitado", "controle", "debilitante"],
  },
  {
    id: "petrified",
    name: "Petrificado",
    description: "O personagem e seus pertences foram transformados em matéria sólida inanimada.",
    behavior: "Fica incapacitado, não pode se mover nem falar e não percebe o ambiente. Ataques contra ele possuem vantagem; falha em salvaguardas de Força e Destreza, recebe resistência a dano e deixa de ser afetado normalmente por venenos e doenças.",
    tags: ["transformação", "incapacitado", "debilitante"],
  },
  {
    id: "deafened",
    name: "Surdo",
    description: "O personagem não consegue ouvir.",
    behavior: "Falha automaticamente em testes de atributo que dependam da audição.",
    tags: ["sentidos", "audição"],
  },
]
