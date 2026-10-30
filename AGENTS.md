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
- Roles: `perfis_acesso.papel` is `admin` or `master` (one role per user; the DB allows only ONE master via a unique partial index). The master reaches `/master` (company registry: create, edit, activate/deactivate, "Entrar") and can open any company's `/admin`; an admin only sees companies linked in `estabelecimento_membros`. `useGuardaAdmin()` allows admin+master, `useGuardaMaster()` only master; `destinoInicial()` decides where each role lands after login.
- Companies (`estabelecimentos`): `slug` is the public catalog address `/{slug}` (lowercase letters, digits, `-` and `_`, 3-40 chars, immutable, reserved names blocked in the DB and in `src/lib/empresa/slug.ts` - keep both lists equal). Never delete from the app; deactivate (`ativo = false`). Access rule for every future table: use `public.tem_acesso_estabelecimento(estabelecimento_id)` in RLS (master OR linked admin). The company in use in `/admin` is kept per user in localStorage (`src/lib/empresa/atual.ts`); the DB (RLS) is what actually isolates data.
- The tables `estabelecimentos` / `estabelecimento_membros` were created by SQL run directly in the Cloud SQL editor (not Lovable's migration tool), so `types.ts` has them hand-written until Lovable regenerates it from the DB.
- Admin management (`/master/administradores`): creating admins, listing them with e-mail and issuing a new provisional password run in server functions (`src/lib/administradores/administradores.functions.ts` -> `logica.server.ts`). They require a logged-in user (`requireSupabaseAuth`), re-check on the server that the caller is master (`eh_master()` with the caller's token) and only then use the service-role client (`client.server.ts`, loaded dynamically inside the server only). Never import the service-role client from route/component code. Linking/unlinking companies runs in the browser under RLS (master-only policies). A provisional password is generated client-side, shown once, and flags `deve_trocar_senha = true`. `listUsers` is capped at 1000 users; paginate if the platform outgrows that.
- Brand: INOV4 HUB identity for admin/master (tokens in `src/styles.css`, logos in `public/brand/`, `BrandLogo`). Theme is automatic by device clock (light 06:00-17:59 / dark 18:00-05:59); a single button (`ThemeToggle`) offers the opposite theme, and a manual switch lasts only until the next 06:00/18:00 turn (`src/lib/tema.ts`). The `dark` class lives on `<html>`.
- First access: admins start with a provisional password and must set their own at `/admin/primeiro-acesso` (flag `deveTrocarSenha` in the session).
- Store data is null until hydration (`useDados()`); admin pages render only after the layout has data.
