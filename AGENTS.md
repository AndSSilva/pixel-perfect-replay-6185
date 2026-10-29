<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Data lives only in the browser: `src/lib/storage.ts` is the sole localStorage reader/writer; swap it for API calls when a backend arrives.
- Business rules are mutating functions in `src/lib/services/regras.ts` that throw `RegraError`; UI calls them via `executar()` in `src/lib/store.ts`, which clones state and commits only on success.
- Money is integer centavos everywhere; totals are always derived from orders/payments, never stored.
- Order items and bills snapshot product/table/customer names and prices for history.
- Admin access goes through `authService` (`src/lib/auth/servico.ts`, contract in `tipos.ts`), implemented with Supabase Auth on Lovable Cloud (`servico-supabase.ts`). Access to the panel requires a row in `public.perfis_acesso` with `papel = 'admin'`; `deve_trocar_senha = true` forces `/admin/primeiro-acesso`. The table is read-only for clients (RLS); the flag is cleared only by the `marcar_senha_trocada()` RPC. Fail closed: any failure to confirm the role denies access. Pages guard themselves with `useGuardaAdmin()` (UI barrier); real data protection must come from RLS on every future table. Database structure changes go through Lovable's migration tool (not by hand in `drizzle/`);
- Brand: INOV4 HUB identity for admin/master (tokens in `src/styles.css`, logos in `public/brand/`, `BrandLogo`). Theme is automatic by device clock (light 06:00-17:59 / dark 18:00-05:59); a single button (`ThemeToggle`) offers the opposite theme, and a manual switch lasts only until the next 06:00/18:00 turn (`src/lib/tema.ts`). The `dark` class lives on `<html>`.
- First access: admins start with a provisional password and must set their own at `/admin/primeiro-acesso` (flag `deveTrocarSenha` in the session).
- Store data is null until hydration (`useDados()`); admin pages render only after the layout has data.
