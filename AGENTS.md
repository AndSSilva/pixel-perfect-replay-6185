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
- Admin access is a demo-only PIN flag in sessionStorage, checked client-side in `src/routes/admin.tsx`; pages outside that layout (`admin_.*`) check it themselves.
- Store data is null until hydration (`useDados()`); admin pages render only after the layout has data.
