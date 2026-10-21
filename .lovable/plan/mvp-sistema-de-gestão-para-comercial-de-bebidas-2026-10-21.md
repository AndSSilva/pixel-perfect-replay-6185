# MVP — Sistema de Gestão para Comercial de Bebidas

Everything is built exactly as the uploaded document describes. All data stays in this browser only (no server, no syncing between devices). The whole interface is in Brazilian Portuguese, using R$ and Brazilian date formats.

## Visual direction
- Dark graphite background, dark-gray cards, lime/emerald green highlight, white text with gray secondary text.
- Fonts: Space Grotesk for headings, DM Sans for body text.
- On desktop the admin area has a sidebar menu. On phones it switches to a compact menu. The customer menu is designed for phones first.

## Pages
- `/` — home page with two links: admin access and the demo table menus.
- `/admin/login` — PIN login, with the demo PIN shown discreetly (1234). This login is for demonstration only.
- `/admin` — dashboard: KPI cards (free tables, occupied tables, pending orders, open bills, today's sales), recent orders, occupied tables, and recently closed bills.
- `/admin/mesas` — table grid in 3 states (free, occupied, waiting for checkout); create, edit, enable or disable tables.
- `/admin/mesas/$mesaId` — table details: customers, individual bills, pending/confirmed/rejected orders, totals, payments, balances, QR code (copy link, download PNG, print view), and a button to free the table.
- `/admin/mesas/$mesaId/imprimir` — printable QR code.
- `/admin/produtos` — create, edit, delete products; search, category filter, availability toggle.
- `/admin/categorias` — categories. A category can only be deleted after its products have been moved to another category.
- `/admin/pedidos` — pending order queue: confirm, or reject with an optional reason; plus the order history.
- `/admin/contas` and `/admin/contas/$contaId` — bill review and payments (cash with change, Pix, debit, credit, other); partial and multiple payments.
- `/admin/historico` — closed bills, filterable by date range, customer, table and payment method.
- `/admin/configuracoes` — business name, menu text, PIN, and a restore-demo-data option (asks for confirmation first).
- `/cardapio/$mesaId` — customer flow: identify (enter a new name or pick an existing bill), browse the menu by category with search, cart, review, send, confirmation screen.

## Business rules (with automated tests)
- New orders start as pending. Only confirmed orders count toward the amount owed.
- Item prices are saved at the moment the order is sent.
- Payments must be greater than zero and cannot exceed the balance. With cash, change is calculated and not counted as revenue.
- A bill is closed only when its balance reaches zero.
- A table can be freed only when it has no open bills and no pending orders.
- A table with open orders or bills cannot be deleted.
- A customer with the same name in the same session reuses their bill or picks it explicitly. Bills are never merged automatically.

## Demo data
Loaded only the first time (or on restore): 6 categories, about 12 drinks, 6 tables. One table has two bills (one partly paid), plus some pending orders and closed bills for the history page.

## Technical details
- `src/lib/types.ts` — data types; money is stored as whole centavos.
- `src/lib/storage.ts` — the only module that reads or writes localStorage, with a versioned key.
- `src/lib/services/*` — CRUD and business rules as pure functions over the store state, so a real API can replace them later.
- `src/lib/store.tsx` — React context with `useSyncExternalStore`; the store loads on the client after hydration.
- `src/lib/seed.ts` — demo data built inside a function, never at module load.
- Admin guard: `src/routes/admin.tsx` layout checks the demo session in sessionStorage and redirects to login.
- QR codes: the `qrcode.react` package; the base URL is `window.location.origin`.
- Formatting helpers use `Intl` with pt-BR and BRL.
- Vitest tests for the rules in `src/lib/services/*.test.ts`.
- Each route gets its own `head()` metadata. AGENTS.md records the architecture.
