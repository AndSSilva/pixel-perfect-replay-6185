-- 04 — Categorias, produtos e mesas por empresa (+ eh_membro exige empresa ativa).
begin;

create or replace function public.eh_membro(_estabelecimento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.estabelecimento_membros m
    join public.perfis_acesso p on p.user_id = m.user_id
    join public.estabelecimentos e on e.id = m.estabelecimento_id
    where m.estabelecimento_id = _estabelecimento
      and m.user_id = (select auth.uid())
      and p.papel = 'admin'
      and e.ativo
  );
$$;

create or replace function public.definir_atualizado_em()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.bloquear_troca_estabelecimento()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.estabelecimento_id is distinct from old.estabelecimento_id then
    raise exception 'não é permitido mover o registro para outra empresa';
  end if;
  return new;
end;
$$;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  nome text not null,
  descricao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categorias_nome_tamanho check (char_length(btrim(nome)) between 1 and 60),
  constraint categorias_descricao_tamanho check (descricao is null or char_length(descricao) <= 200),
  constraint categorias_id_empresa_unico unique (id, estabelecimento_id)
);
create unique index categorias_nome_unico
  on public.categorias (estabelecimento_id, lower(btrim(nome)));

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  categoria_id uuid not null,
  nome text not null,
  descricao text,
  preco_venda_centavos integer not null,
  preco_custo_centavos integer,
  estoque_qtd integer not null default 0,
  disponivel boolean not null default true,
  foto_path text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produtos_categoria_fkey foreign key (categoria_id, estabelecimento_id)
    references public.categorias (id, estabelecimento_id) on delete restrict,
  constraint produtos_nome_tamanho check (char_length(btrim(nome)) between 1 and 80),
  constraint produtos_descricao_tamanho check (descricao is null or char_length(descricao) <= 300),
  constraint produtos_preco_venda check (preco_venda_centavos between 0 and 100000000),
  constraint produtos_preco_custo check (preco_custo_centavos is null or preco_custo_centavos between 0 and 100000000),
  constraint produtos_estoque check (estoque_qtd between 0 and 1000000),
  constraint produtos_foto_pasta check (foto_path is null or foto_path like estabelecimento_id::text || '/%')
);
create index produtos_empresa_categoria_idx on public.produtos (estabelecimento_id, categoria_id);

create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  numero integer not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint mesas_numero_faixa check (numero between 1 and 9999),
  constraint mesas_numero_unico unique (estabelecimento_id, numero)
);

create trigger categorias_antes_de_atualizar before update on public.categorias
  for each row execute function public.definir_atualizado_em();
create trigger categorias_empresa_fixa before update on public.categorias
  for each row execute function public.bloquear_troca_estabelecimento();
create trigger produtos_antes_de_atualizar before update on public.produtos
  for each row execute function public.definir_atualizado_em();
create trigger produtos_empresa_fixa before update on public.produtos
  for each row execute function public.bloquear_troca_estabelecimento();
create trigger mesas_antes_de_atualizar before update on public.mesas
  for each row execute function public.definir_atualizado_em();
create trigger mesas_empresa_fixa before update on public.mesas
  for each row execute function public.bloquear_troca_estabelecimento();

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.mesas enable row level security;

revoke all on table public.categorias, public.produtos, public.mesas from anon;
grant select, insert, update, delete on table public.categorias, public.produtos, public.mesas to authenticated;
grant all on table public.categorias, public.produtos, public.mesas to service_role;

create policy "ver categorias" on public.categorias for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "criar categorias" on public.categorias for insert to authenticated
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "alterar categorias" on public.categorias for update to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id))
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "excluir categorias" on public.categorias for delete to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));

create policy "ver produtos" on public.produtos for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "criar produtos" on public.produtos for insert to authenticated
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "alterar produtos" on public.produtos for update to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id))
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "excluir produtos" on public.produtos for delete to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));

create policy "ver mesas" on public.mesas for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "criar mesas" on public.mesas for insert to authenticated
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "alterar mesas" on public.mesas for update to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id))
  with check (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "excluir mesas" on public.mesas for delete to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));

commit;
