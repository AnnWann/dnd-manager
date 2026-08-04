const DESCRIPTIONS: Record<string, string> = {
  Arquearia:
    "Recebe bônus em jogadas de ataque feitas com armas à distância.",
  Defense:
    "Recebe bônus de Classe de Armadura enquanto estiver usando armadura.",
  Defesa:
    "Recebe bônus de Classe de Armadura enquanto estiver usando armadura.",
  Duelismo:
    "Ao empunhar uma arma corpo a corpo em uma mão e nenhuma outra arma, recebe bônus no dano.",
  "Combate com Armas Grandes":
    "Permite repetir resultados baixos nos dados de dano de armas corpo a corpo empunhadas com duas mãos.",
  Proteção:
    "Usa a reação e um escudo para dificultar um ataque feito contra uma criatura próxima.",
  "Combate com Duas Armas":
    "Permite adicionar o modificador de atributo ao dano do ataque adicional com a segunda arma.",
  "Combate às Cegas":
    "Concede percepção às cegas em curto alcance, inclusive contra criaturas invisíveis que não estejam ocultas.",
  Intercepção:
    "Usa a reação para reduzir o dano recebido por uma criatura próxima quando você empunha arma ou escudo.",
  "Técnica Superior":
    "Concede uma manobra de Mestre de Batalha e um dado de superioridade para utilizá-la.",
  "Combate com Armas de Arremesso":
    "Permite sacar armas como parte do ataque e concede bônus de dano com armas arremessadas.",
  "Combate Desarmado":
    "Aprimora o dano de ataques desarmados e permite causar dano adicional em criaturas agarradas.",
  "Guerreiro Abençoado":
    "Concede dois truques de Clérigo, usando Carisma como atributo de conjuração.",
  "Guerreiro Druídico":
    "Concede dois truques de Druida, usando Sabedoria como atributo de conjuração.",
  "Pacto da Corrente":
    "Concede um familiar aprimorado e amplia interações com invocações relacionadas ao familiar.",
  "Pacto da Lâmina":
    "Permite criar ou vincular uma arma de pacto e habilita invocações voltadas ao combate armado.",
  "Pacto do Tomo":
    "Concede um Livro das Sombras com truques adicionais de quaisquer listas de magia.",
  "Pacto do Talismã":
    "Concede um talismã que auxilia testes e pode ser aprimorado por invocações específicas.",
  Urso:
    "Favorece resistência e força física. A interpretação exata depende da característica totêmica que concedeu a escolha.",
  Águia:
    "Favorece mobilidade, visão e reposicionamento. A interpretação exata depende da característica totêmica que concedeu a escolha.",
  Lobo:
    "Favorece cooperação, rastreamento e apoio a aliados próximos. A interpretação exata depende da característica totêmica que concedeu a escolha.",
  Ártico:
    "Concede magias do Círculo da Terra associadas a frio, gelo e sobrevivência em regiões congeladas.",
  Costa:
    "Concede magias do Círculo da Terra associadas a água, neblina e deslocamento.",
  Deserto:
    "Concede magias do Círculo da Terra associadas a calor, miragens, silêncio e terreno árido.",
  Floresta:
    "Concede magias do Círculo da Terra associadas a plantas, árvores e deslocamento natural.",
  Pradaria:
    "Concede magias do Círculo da Terra associadas a velocidade, ocultação e campo aberto.",
  Montanha:
    "Concede magias do Círculo da Terra associadas a pedra, altitude e eletricidade.",
  Pântano:
    "Concede magias do Círculo da Terra associadas a ácido, névoa e terreno pantanoso.",
  Umbreterna:
    "Concede magias do Círculo da Terra associadas a escuridão, teias, pedra e toxinas.",
  Bem:
    "Define afinidade divina benigna e concede Cura pelas Mãos como magia adicional da origem.",
  Mal:
    "Define afinidade divina sombria e concede Infligir Ferimentos como magia adicional da origem.",
  Ordem:
    "Define afinidade divina ordeira e concede Bênção como magia adicional da origem.",
  Caos:
    "Define afinidade divina caótica e concede Perdição como magia adicional da origem.",
  Neutralidade:
    "Define afinidade divina neutra e concede Proteção contra o Bem e o Mal como magia adicional.",
  Dao:
    "Vincula o patrono Gênio à terra e adiciona magias relacionadas a pedra, proteção e terreno.",
  Djinni:
    "Vincula o patrono Gênio ao ar e adiciona magias relacionadas a vento, trovão e invisibilidade.",
  Efreeti:
    "Vincula o patrono Gênio ao fogo e adiciona magias ofensivas de chamas.",
  Marid:
    "Vincula o patrono Gênio à água e adiciona magias relacionadas a névoa, gelo e controle da água.",
  "Rajada Agonizante":
    "Adiciona o modificador de Carisma ao dano de Rajada Mística conforme as regras da invocação.",
  "Armadura das Sombras":
    "Permite conjurar Armadura Arcana em si mesmo sem gastar espaço de magia.",
  "Visão Diabólica":
    "Permite enxergar normalmente em escuridão comum e mágica dentro do alcance indicado.",
  "Mente Mística":
    "Concede vantagem em salvaguardas de Constituição para manter concentração em magia.",
  "Visão Mística":
    "Permite conjurar Detectar Magia à vontade sem gastar espaço de magia.",
  "Lança Mística":
    "Aumenta o alcance de Rajada Mística.",
  "Vigor Infernal":
    "Permite conjurar Vida Falsa em si mesmo sem gastar espaço de magia.",
  "Máscara de Muitas Faces":
    "Permite conjurar Disfarçar-se à vontade sem gastar espaço de magia.",
  "Visões Enevoadas":
    "Permite conjurar Imagem Silenciosa à vontade sem gastar espaço de magia.",
  "Repulsão Mística":
    "Permite empurrar uma criatura atingida por Rajada Mística.",
  "Sede da Lâmina":
    "Permite atacar duas vezes com a arma de pacto ao usar a ação Atacar.",
  "Golpe Místico":
    "Permite gastar um espaço de magia de pacto ao acertar com a arma de pacto para causar dano adicional e derrubar o alvo.",
  "Devorador de Vida":
    "Adiciona dano necrótico aos ataques com a arma de pacto usando o modificador de Carisma.",
  "Livro de Segredos Antigos":
    "Permite registrar e conjurar magias de ritual por meio do Livro das Sombras.",
  "Explosão Repulsiva":
    "Permite deslocar alvos atingidos por Rajada Mística para longe de você.",
  "Agarre de Hadar":
    "Permite puxar um alvo atingido por Rajada Mística em sua direção uma vez por turno.",
  "Lança de Letargia":
    "Reduz a velocidade de um alvo atingido por Rajada Mística uma vez por turno.",
  "Ataque Ameaçador":
    "Gasta um dado de superioridade para adicionar dano e tentar amedrontar o alvo.",
  "Ataque de Derrubada":
    "Gasta um dado de superioridade para adicionar dano e tentar derrubar o alvo.",
  "Ataque de Precisão":
    "Gasta um dado de superioridade para melhorar uma jogada de ataque.",
  "Ataque de Empurrão":
    "Gasta um dado de superioridade para adicionar dano e tentar empurrar o alvo.",
  "Ataque de Desarme":
    "Gasta um dado de superioridade para adicionar dano e tentar fazer o alvo largar um objeto.",
  "Ataque de Manobra":
    "Gasta um dado de superioridade para adicionar dano e permitir que um aliado se reposicione.",
  "Aparar":
    "Usa a reação e um dado de superioridade para reduzir dano de um ataque corpo a corpo.",
  "Ripostar":
    "Usa a reação e um dado de superioridade para atacar uma criatura que errou um ataque contra você.",
  "Comandar Ataque":
    "Abre mão de um ataque e usa ação bônus para permitir que um aliado ataque com a reação.",
  "Reagrupar":
    "Usa ação bônus e um dado de superioridade para conceder pontos de vida temporários a um aliado.",
  "Passo Evasivo":
    "Gasta um dado de superioridade ao se mover para aumentar temporariamente a Classe de Armadura.",
  "Emboscada":
    "Gasta um dado de superioridade para melhorar Furtividade ou iniciativa.",
  "Avaliação Tática":
    "Gasta um dado de superioridade para melhorar determinados testes de investigação, história ou intuição.",
  "Ferramentas Aprimoradas":
    "Infunde uma ferramenta para conceder bônus a testes realizados com ela.",
  "Arma Aprimorada":
    "Infunde uma arma para conceder bônus mágico em ataques e dano.",
  "Defesa Aprimorada":
    "Infunde armadura ou escudo para conceder bônus de Classe de Armadura.",
  "Foco Arcano Aprimorado":
    "Infunde um foco para melhorar ataques de magia e ignorar parte da cobertura.",
  "Disparo Repetitivo":
    "Infunde uma arma de munição para conceder bônus e produzir munição mágica automaticamente.",
  "Arma Retornante":
    "Infunde uma arma de arremesso para conceder bônus e fazê-la retornar após o ataque.",
}

export function getProgressionChoiceDescription(
  option: string,
  choiceLabel?: string,
): string {
  return (
    DESCRIPTIONS[option] ??
    `Opção de “${choiceLabel?.trim() || "característica"}”. A escolha será registrada na ficha; revise requisitos, limites e interações descritos pela característica.`
  )
}
