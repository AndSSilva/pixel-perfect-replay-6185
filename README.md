# Mesa Digital

SaaS de gestão de mesas, pedidos e contas para estabelecimentos. Painel administrativo com a identidade
INOV4 HUB; páginas do cliente final com a identidade do estabelecimento.

> Status: em reconstrução por etapas a partir do MVP. Etapa 1: acesso do administrador (login, recuperação
> e primeiro acesso). O restante do painel ainda usa dados locais do navegador e fica bloqueado pelo login.

## Stack
TanStack Start (SSR) · React 19 · TypeScript estrito · Tailwind 4 · shadcn/ui · Vitest.
Hospedagem e backend: Lovable (projeto conectado ao GitHub; sincroniza a branch `main`).

## Desenvolvimento
O lockfile é do Bun (`bun.lock`). Use Bun:

```sh
bun install
bun run dev      # servidor local
bun run test     # testes
bun run build    # build de produção
```

Detalhes de arquitetura e decisões: `AGENTS.md`.
