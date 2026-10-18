# Owlbear Rodeo — D&D Manager (fase 1)

Extensão inicial para acesso às fichas do site dentro de um popover do Owlbear.

## Desenvolvimento

- `npm ci` na raiz do monorepo.
- `npm run build --workspace @dnd-manager/owlbear-extension`.
- `npm run dev --workspace @dnd-manager/owlbear-extension`.
- Adicione `http://localhost:5173/manifest.json` em Extensions do Owlbear (ambiente local com HTTPS/túnel se necessário).
- Para outra origem, defina `VITE_DND_MANAGER_URL` na compilação. Não inclua segredos nesta variável pública.

## Limitações explícitas

Esta fase **não é uma ficha nativa autônoma**. O painel incorpora a interface autenticada existente do website, preservando o código das fichas e suas operações de persistência. Não copia dados para o Owlbear e não mantém credenciais próprias. O navegador pode bloquear autenticação em iframe por política de cookies de terceiros ou `frame-ancestors` do servidor. A abertura em nova aba é o fallback funcional. O módulo isolado reutilizando `game-ui` e `CharacterWorkspace` dentro da extensão, com autenticação segura independente de cookies de terceiros, é a próxima etapa.

Não use esta fase como evidência de integração bidirecional do estado da sessão: nenhuma conexão direta com o Worker foi adicionada aqui.
