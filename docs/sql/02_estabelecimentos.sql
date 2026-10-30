-- 02 — Empresas (estabelecimentos), vínculo administrador<->empresa e dados públicos mínimos.
begin;

create or replace function public.eh_master()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis_acesso p
    where p.user_id = (select auth.uid()) and p.papel = 'master'
  );
$$;
revoke all on function public.eh_master() from public, anon;
grant execute on function public.eh_master() to authenticated;

create table public.estabelecimentos (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  nome text not null,
  ativo boolean not null default true,
  cor_primaria text,
  cor_secundaria text,
  logo_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint estabelecimentos_slug_formato
    check (slug ~ '^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$'),
  constraint estabelecimentos_slug_reservado
    check (not (slug = any (array[
      'admin','master','cardapio','api','login','logout','entrar','sair','brand','assets',
      'static','public','app','www','health','status','suporte','ajuda','termos',
      'privacidade','inov4','inov4hub','mesa','mesas'
    ]))),
  constraint estabelecimentos_nome_tamanho
    check (char_length(btrim(nome)) between 2 and 80),
  constraint estabelecimentos_cor_primaria_hex
    check (cor_primaria is null or cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  constraint estabelecimentos_cor_secundaria_hex
    check (cor_secundaria is null or cor_secundaria ~ '^#[0-9a-fA-F]{6}$')
);
create unique index estabelecimentos_slug_unico on public.estabelecimentos (slug);

create or replace function public.estabelecimentos_antes_de_atualizar()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'o endereço (slug) do estabelecimento não pode ser alterado';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger estabelecimentos_antes_de_atualizar
  before update on public.estabelecimentos
  for each row execute function public.estabelecimentos_antes_de_atualizar();

create table public.estabelecimento_membros (
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  user_id uuid not null references public.perfis_acesso(user_id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (estabelecimento_id, user_id)
);
create index estabelecimento_membros_user_id_idx on public.estabelecimento_membros (user_id);

create or replace function public.eh_membro(_estabelecimento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.estabelecimento_membros m
    join public.perfis_acesso p on p.user_id = m.user_id
    where m.estabelecimento_id = _estabelecimento
      and m.user_id = (select auth.uid())
      and p.papel = 'admin'
  );
$$;
revoke all on function public.eh_membro(uuid) from public, anon;
grant execute on function public.eh_membro(uuid) to authenticated;

alter table public.estabelecimentos enable row level security;
alter table public.estabelecimento_membros enable row level security;

revoke all on table public.estabelecimentos from anon;
revoke all on table public.estabelecimento_membros from anon;
grant select, insert, update on table public.estabelecimentos to authenticated;
grant select, insert, delete on table public.estabelecimento_membros to authenticated;
grant all on table public.estabelecimentos to service_role;
grant all on table public.estabelecimento_membros to service_role;

create policy "ver estabelecimentos permitidos" on public.estabelecimentos
  for select to authenticated using (public.eh_master() or public.eh_membro(id));
create policy "master cria estabelecimentos" on public.estabelecimentos
  for insert to authenticated with check (public.eh_master());
create policy "master altera estabelecimentos" on public.estabelecimentos
  for update to authenticated using (public.eh_master()) with check (public.eh_master());

create policy "ver vinculos permitidos" on public.estabelecimento_membros
  for select to authenticated using (public.eh_master() or user_id = (select auth.uid()));
create policy "master cria vinculos" on public.estabelecimento_membros
  for insert to authenticated with check (public.eh_master());
create policy "master remove vinculos" on public.estabelecimento_membros
  for delete to authenticated using (public.eh_master());

create policy "master le todos os perfis" on public.perfis_acesso
  for select to authenticated using (public.eh_master());

create or replace function public.obter_estabelecimento_publico(_slug text)
returns table (id uuid, slug text, nome text, cor_primaria text, cor_secundaria text, logo_url text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.slug, e.nome, e.cor_primaria, e.cor_secundaria, e.logo_url
  from public.estabelecimentos e
  where e.slug = lower(_slug) and e.ativo;
$$;
revoke all on function public.obter_estabelecimento_publico(text) from public;
grant execute on function public.obter_estabelecimento_publico(text) to anon, authenticated;

commit;
