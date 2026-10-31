-- 03 — Um único master na plataforma e a regra única de acesso a uma empresa.
begin;

create unique index if not exists perfis_acesso_um_master
  on public.perfis_acesso (papel) where papel = 'master';

create or replace function public.tem_acesso_estabelecimento(_estabelecimento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.eh_master() or public.eh_membro(_estabelecimento);
$$;
revoke all on function public.tem_acesso_estabelecimento(uuid) from public, anon;
grant execute on function public.tem_acesso_estabelecimento(uuid) to authenticated;

drop policy if exists "ver estabelecimentos permitidos" on public.estabelecimentos;
create policy "ver estabelecimentos permitidos" on public.estabelecimentos
  for select to authenticated using (public.tem_acesso_estabelecimento(id));

commit;
