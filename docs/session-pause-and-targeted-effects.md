# Pausa da sessão, alvos e acompanhantes

Esta página descreve as opções de automação da sessão. As configurações e os efeitos são mantidos no Durable Object da sessão, não no estado local do navegador.

## Pausar a sessão

O **mestre** tem um controle **Pausar / Retomar** no cabeçalho, junto à presença dos participantes. A pausa é compartilhada entre todos os dispositivos e mantida após reconexão.

Enquanto a sessão estiver pausada:

- Os jogadores recebem a indicação **Sessão pausada**. O servidor rejeita suas operações de edição, inventário, descanso, iniciativa, habilidades, magias, dados, condições, acompanhantes e alterações de configuração.
- Os jogadores permanecem conectados. Os pacotes de heartbeat e ping continuam permitidos.
- **Todas as operações do mestre continuam funcionando**, incluindo desfazer alterações, controlar combate e retomar a sessão.
- O cliente também descarta operações feitas enquanto está pausado em vez de enfileirá-las para execução após o retorno. A validação definitiva ocorre no servidor usando o papel da conexão, independentemente do que o navegador apresentar.

## Tipos de alvos

Em **Editar habilidade → Rolagem → Aplicação automática em alvos**, selecione:

| Modo | Resultado |
| --- | --- |
| Não configurar alvos | Mantém o comportamento original, sem alterações automáticas em terceiros |
| Somente em si mesmo | Aplica os efeitos da habilidade ao personagem que a utiliza |
| Alvos selecionados | Pede a seleção de até **N** afetados antes da ativação |
| Ponto / área | Pede uma referência descritiva para o centro e a seleção de até **N** afetados |

Os alvos disponíveis incluem **personagens**, **participantes da iniciativa** e **familiares, acompanhantes ou montarias persistentes**. O limite de afetados é validado pelo servidor, que também rejeita referências inválidas ou duplicadas. Se o mesmo personagem ou criatura for escolhido por mais de uma referência (ficha e iniciativa, ou múltiplos turnos de uma criatura), o servidor rejeita a seleção para evitar efeitos duplicados.

**Não existe geometria no VTT atual:** o raio informado é descritivo. O servidor não calcula distâncias, linha de visão ou quais tokens estão dentro da área. Quem utiliza a habilidade escolhe explicitamente os afetados.

## Efeitos e rolagens

Em **Editar habilidade → Efeitos → Bônus**, use **Dano ao usar** ou **Cura ao usar** para configurar mudanças de PV. Dano tem tipo específico e opções para ignorar resistências, imunidades, vulnerabilidades e/ou PV temporários. Valores podem ser fixos, fórmulas ou rolagens automáticas/manuais.

- Rolagens digitais são calculadas pelo servidor, usadas na aplicação de PV e registradas na aba **Dados**.
- Dano considera as afinidades do **alvo**, inclusive resistências e vulnerabilidades temporárias.
- Cura não é tratada como tipo de dano e não ultrapassa os PV máximos.
- PV temporários concedidos como bônus de ativação são entregues **uma vez** ao destinatário, respeitando o maior valor, não como modificador contínuo.
- As condições de **Condição ao usar**, opções de ativação e bônus contínuos configurados em habilidades direcionadas são concedidos aos destinatários. Para personagens, utilizam a estrutura normal de condições e bônus; para criaturas e acompanhantes, ficam nas condições da iniciativa ou do estado persistente.
- Reaplicar a mesma condição direcionada do mesmo conjurador atualiza a instância em vez de acumulá-la infinitamente.

Uma rolagem independente de ataque/dano na aba **Dados** pode aplicar seus resultados aos alvos selecionados, considerando o ataque e o teste de resistência quando disponíveis. **Rolar um ataque independentemente não substitui a ativação nem consome seus recursos automaticamente.** A operação de ativação continua sendo o caminho para gastar recursos e aplicar os efeitos de uso.

## Familiares, acompanhantes e montarias

O mestre cadastra a criatura no **Compêndio de Criaturas**, escolhe um controlador e o tipo: familiar, acompanhante ou montaria. A página **Minhas criaturas** do controlador exibe grupos separados e seus estados persistentes.

Os dados são mantidos **mesmo fora da iniciativa**:

- PV atuais, máximos e temporários;
- condições e bônus com duração;
- usos de habilidades limitadas;
- espaços de magia disponíveis e usos diários de magias.

A criatura pode fazer rolagens e consumir recursos fora da iniciativa. Entrar ou sair do combate sincroniza os mesmos valores sem recriá-los do zero. O mestre e o controlador podem editar recursos pelos controles disponíveis; receber dano ou cura de uma habilidade direcionada não concede a terceiros o controle administrativo da criatura.

## Desfazer e testes

As ativações de habilidades direcionadas registram um histórico de alterações que permite ao mestre desfazer os PV e as condições dos personagens, os estados dos acompanhantes e a iniciativa afetada, desde que outras alterações conflitantes não impeçam o desfazer.

Execute as verificações do repositório:

```bash
npm run test:shared
npm run build
npm run typecheck:session-server
```

Os testes compartilhados cobrem a pausa e sua validação, o processamento de múltiplos alvos, resistência/imunidade, cura, PV temporários, condições persistentes, usos diários dos acompanhantes e restauração de snapshots de alvos.

**Limites conhecidos:** não existe resolução espacial automática. Rolagens independentes de ataque não participam do mesmo histórico de desfazer das operações `character.ability.use`; o mestre pode ajustar manualmente a ficha se precisar reverter uma rolagem isolada.
