# Extensão Owlbear — fichas (MVP nativo)

O popover é um React independente sem iframe. Consulta a API de personagens da conta do D&D Manager e oferece edição básica de nome, com controle otimista de revisão. O módulo reaproveita o componente `CharacterSheetDerivedTile` de `@dnd-manager/game-ui`.

**Escopo:** não é ainda uma ficha completa. Ainda falta extrair todos os controles, regras, domínios, ações e o CharacterWorkspace para uma biblioteca independente. O MVP não sincroniza personagens de sessão via Durable Object. Autenticação via cookies cross-origin pode ser bloqueada em browsers; não existe pareamento/OAuth específico para a extensão. O usuário não deve fornecer credenciais ou tokens à extensão.

## Testar

1. Na raiz do repositório: `npm ci` e `npm run build --workspace @dnd-manager/owlbear-extension`.
2. Rode `npm run dev --workspace @dnd-manager/owlbear-extension -- --host 0.0.0.0`.
3. Hospede em URL pública **HTTPS**, ou exponha Vite por túnel HTTPS para testes locais.
4. No Owlbear Rodeo, instale o manifesto `https://SUA-ORIGEM/manifest.json` em **Extensions**.
5. Abra uma sala, clique em **D&D Manager — Fichas**, autentique-se no website em outra aba, use **Atualizar lista**, selecione um personagem, renomeie e salve. Confirme a atualização no site. Um erro de CORS/cookies indica a necessidade de autenticação cross-origin segura antes da integração completa.

A extensão deve ser publicada em um projeto separado da aplicação principal; `VITE_DND_MANAGER_URL` permite apontar para um ambiente de QA. Não faça deploy para produção sem concluir autenticação, autorização e as políticas de CORS apropriadas.
