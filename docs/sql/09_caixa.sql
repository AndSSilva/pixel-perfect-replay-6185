-- 09 — Caixa (tesouraria): abertura, sangria/reforço, fechamento com conferência do dinheiro.
--
-- Regras (decididas com o dono do produto):
--  * Um caixa aberto por vez em cada empresa; qualquer administrador da empresa (ou o master) abre e fecha.
--  * Pagamento só pode ser registrado com o caixa aberto: ele entra nesse caixa.
--  * Dinheiro esperado = abertura + dinheiro recebido (sem o troco) + reforços − sangrias.
--  * No fechamento informa-se o valor contado; o sistema grava esperado, contado e a diferença.
--  * Caixa fechado não muda mais: não aceita movimento nem remoção de pagamento.
-- Depende do 08_pedidos.sql. Rode depois dele.
begin;

create type public.status_caixa as enum ('aberto', 'fechado');
create type public.tipo_movimento_caixa as enum ('sangria', 'reforco');

create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  status public.status_caixa not null default 'aberto',
  aberto_em timestamptz not null default clock_timestamp(),
  aberto_por uuid references auth.users(id) on delete set null,
  abertura_centavos integer not null,
  fechado_em timestamptz,
  fechado_por uuid references auth.users(id) on delete set null,
  esperado_centavos integer,
  contado_centavos integer,
  diferenca_centavos integer,
  observacao_fechamento text,
  constraint caixas_abertura check (abertura_centavos between 0 and 100000000),
  constraint caixas_contado check (contado_centavos is null or contado_centavos between 0 and 100000000),
  constraint caixas_observacao check (observacao_fechamento is null or char_length(observacao_fechamento) <= 200),
  constraint caixas_fechamento_coerente check (
    (status = 'fechado') = (fechado_em is not null)
    and (status = 'fechado') = (contado_centavos is not null)
    and (status = 'fechado') = (esperado_centavos is not null)
    and (status = 'fechado') = (diferenca_centavos is not null)),
  constraint caixas_id_empresa_unico unique (id, estabelecimento_id)
);
-- No máximo um caixa aberto por empresa.
create unique index caixas_um_aberto on public.caixas (estabelecimento_id) where status = 'aberto';
create index caixas_empresa_data_idx on public.caixas (estabelecimento_id, aberto_em desc);

create table public.movimentos_caixa (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  caixa_id uuid not null,
  tipo public.tipo_movimento_caixa not null,
  valor_centavos integer not null,
  motivo text not null,
  criado_em timestamptz not null default clock_timestamp(),
  criado_por uuid references auth.users(id) on delete set null,
  constraint movimentos_caixa_fkey foreign key (caixa_id, estabelecimento_id)
    references public.caixas (id, estabelecimento_id) on delete restrict,
  constraint movimentos_caixa_valor check (valor_centavos between 1 and 100000000),
  constraint movimentos_caixa_motivo check (char_length(btrim(motivo)) between 1 and 200)
);
create index movimentos_caixa_caixa_idx on public.movimentos_caixa (caixa_id);

-- Cada pagamento novo aponta para o caixa em que entrou (pagamentos antigos ficam sem caixa).
alter table public.pagamentos add column caixa_id uuid;
alter table public.pagamentos add constraint pagamentos_caixa_fkey
  foreign key (caixa_id, estabelecimento_id) references public.caixas (id, estabelecimento_id) on delete restrict;
create index pagamentos_caixa_idx on public.pagamentos (caixa_id);

-- ------------------------------------------------------------------ segurança das tabelas
alter table public.caixas enable row level security;
alter table public.movimentos_caixa enable row level security;
revoke all on table public.caixas, public.movimentos_caixa from anon, authenticated;
grant all on table public.caixas, public.movimentos_caixa to service_role;
grant select on table public.caixas, public.movimentos_caixa to authenticated;
create policy "ver caixas" on public.caixas for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver movimentos do caixa" on public.movimentos_caixa for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));

-- ------------------------------------------------------------------ auxiliar interno
-- Dinheiro esperado na gaveta (inclui a abertura). Troco nunca entra: pagamentos.valor_centavos já é o valor abatido.
create or replace function public.caixa_esperado(_caixa uuid)
returns bigint language sql stable security definer set search_path = ''
as $$
  select c.abertura_centavos::bigint
       + coalesce((select sum(p.valor_centavos) from public.pagamentos p
                    where p.caixa_id = c.id and p.forma = 'dinheiro'), 0)
       + coalesce((select sum(m.valor_centavos) from public.movimentos_caixa m
                    where m.caixa_id = c.id and m.tipo = 'reforco'), 0)
       - coalesce((select sum(m.valor_centavos) from public.movimentos_caixa m
                    where m.caixa_id = c.id and m.tipo = 'sangria'), 0)
    from public.caixas c where c.id = _caixa
$$;
revoke all on function public.caixa_esperado(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ funções do PAINEL

create or replace function public.abrir_caixa(_empresa uuid, _valor integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare novo uuid;
begin
  perform public.exigir_acesso(_empresa);
  if _valor is null or _valor < 0 or _valor > 100000000 then raise exception 'valor_invalido'; end if;
  begin
    insert into public.caixas (estabelecimento_id, abertura_centavos, aberto_por)
    values (_empresa, _valor, (select auth.uid()))
    returning id into novo;
  exception when unique_violation then
    raise exception 'caixa_ja_aberto';
  end;
  return novo;
end;
$$;

-- Sangria (retirada) ou reforço (entrada) de dinheiro, sempre com motivo.
create or replace function public.movimentar_caixa(
  _caixa uuid, _tipo public.tipo_movimento_caixa, _valor integer, _motivo text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare c record; novo uuid; mot text := btrim(coalesce(_motivo, ''));
begin
  select * into c from public.caixas where id = _caixa for update;
  if not found then raise exception 'caixa_nao_encontrado'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  if c.status <> 'aberto' then raise exception 'caixa_fechado'; end if;
  if _valor is null or _valor <= 0 or _valor > 100000000 then raise exception 'valor_invalido'; end if;
  if mot = '' then raise exception 'motivo_obrigatorio'; end if;
  if char_length(mot) > 200 then raise exception 'motivo_invalido'; end if;
  if _tipo = 'sangria' and _valor > public.caixa_esperado(c.id) then
    raise exception 'valor_excede_caixa' using detail = public.caixa_esperado(c.id)::text;
  end if;
  insert into public.movimentos_caixa (estabelecimento_id, caixa_id, tipo, valor_centavos, motivo, criado_por)
  values (c.estabelecimento_id, c.id, _tipo, _valor, mot, (select auth.uid()))
  returning id into novo;
  return novo;
end;
$$;

-- Números do caixa (aberto ou fechado): fonte única para a tela e para o fechamento.
create or replace function public.resumo_caixa(_caixa uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare c record; formas jsonb;
begin
  select * into c from public.caixas where id = _caixa;
  if not found then raise exception 'caixa_nao_encontrado'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  select jsonb_object_agg(f, coalesce(s.total, 0)) into formas
    from unnest(enum_range(null::public.forma_pagamento)) f
    left join (select forma, sum(valor_centavos)::bigint as total
                 from public.pagamentos where caixa_id = c.id group by forma) s on s.forma = f;
  return jsonb_build_object(
    'caixa_id', c.id, 'status', c.status, 'abertura_centavos', c.abertura_centavos,
    'dinheiro_centavos', coalesce((select sum(valor_centavos) from public.pagamentos
                                    where caixa_id = c.id and forma = 'dinheiro'), 0),
    'reforcos_centavos', coalesce((select sum(valor_centavos) from public.movimentos_caixa
                                    where caixa_id = c.id and tipo = 'reforco'), 0),
    'sangrias_centavos', coalesce((select sum(valor_centavos) from public.movimentos_caixa
                                    where caixa_id = c.id and tipo = 'sangria'), 0),
    'esperado_centavos', public.caixa_esperado(c.id),
    'total_recebido_centavos', coalesce((select sum(valor_centavos) from public.pagamentos
                                          where caixa_id = c.id), 0),
    'qtd_pagamentos', (select count(*) from public.pagamentos where caixa_id = c.id),
    'por_forma', formas);
end;
$$;

-- Fecha o caixa: grava esperado, contado e a diferença (contado − esperado).
create or replace function public.fechar_caixa(_caixa uuid, _contado integer, _observacao text default null)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare c record; esperado bigint; obs text := nullif(btrim(coalesce(_observacao, '')), '');
begin
  select * into c from public.caixas where id = _caixa for update;
  if not found then raise exception 'caixa_nao_encontrado'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  if c.status <> 'aberto' then raise exception 'caixa_fechado'; end if;
  if _contado is null or _contado < 0 or _contado > 100000000 then raise exception 'valor_invalido'; end if;
  if obs is not null and char_length(obs) > 200 then raise exception 'observacao_invalida'; end if;
  esperado := public.caixa_esperado(c.id);
  update public.caixas
     set status = 'fechado', fechado_em = clock_timestamp(), fechado_por = (select auth.uid()),
         esperado_centavos = esperado, contado_centavos = _contado,
         diferenca_centavos = _contado - esperado, observacao_fechamento = obs
   where id = c.id;
  return _contado - esperado;
end;
$$;

-- Pagamento: agora exige caixa aberto e registra em qual caixa entrou.
create or replace function public.registrar_pagamento(
  _comanda uuid, _valor integer, _forma public.forma_pagamento,
  _observacao text default null, _recebido integer default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare c record; saldo bigint; troco integer; recebido integer; novo_id uuid; cx uuid;
        obs text := nullif(btrim(coalesce(_observacao, '')), '');
begin
  select * into c from public.comandas where id = _comanda for update;
  if not found then raise exception 'comanda_nao_encontrada'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  -- "for share": um fechamento de caixa em andamento espera este pagamento terminar
  select id into cx from public.caixas where estabelecimento_id = c.estabelecimento_id and status = 'aberto' for share;
  if cx is null then raise exception 'caixa_fechado'; end if;
  if _valor is null or _valor <= 0 then raise exception 'valor_invalido'; end if;
  if obs is not null and char_length(obs) > 200 then raise exception 'observacao_invalida'; end if;
  saldo := public.comanda_devido(c.id) - public.comanda_pago(c.id);
  if _valor > saldo then raise exception 'valor_excede_saldo' using detail = saldo::text; end if;
  if _forma = 'dinheiro' and _recebido is not null then
    if _recebido < _valor then raise exception 'recebido_menor_que_valor'; end if;
    recebido := _recebido; troco := _recebido - _valor;
  end if;
  insert into public.pagamentos (estabelecimento_id, comanda_id, caixa_id, valor_centavos, forma, observacao,
                                 recebido_centavos, troco_centavos, registrado_por)
  values (c.estabelecimento_id, c.id, cx, _valor, _forma, obs, recebido, troco, (select auth.uid()))
  returning pagamentos.id into novo_id;
  return novo_id;
end;
$$;

-- Remover pagamento: só enquanto o caixa em que ele entrou ainda está aberto.
create or replace function public.excluir_pagamento(_pagamento uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare g record; c record; cx record;
begin
  select * into g from public.pagamentos where id = _pagamento;
  if not found then raise exception 'pagamento_nao_encontrado'; end if;
  perform public.exigir_acesso(g.estabelecimento_id);
  if g.caixa_id is not null then
    select status into cx from public.caixas where id = g.caixa_id for share;
    if cx.status <> 'aberto' then raise exception 'caixa_ja_fechado'; end if;
  end if;
  select * into c from public.comandas where id = g.comanda_id for update;
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  delete from public.pagamentos where id = g.id;
end;
$$;

-- ------------------------------------------------------------------ permissões de execução
revoke all on function
  public.abrir_caixa(uuid, integer),
  public.movimentar_caixa(uuid, public.tipo_movimento_caixa, integer, text),
  public.resumo_caixa(uuid), public.fechar_caixa(uuid, integer, text),
  public.registrar_pagamento(uuid, integer, public.forma_pagamento, text, integer),
  public.excluir_pagamento(uuid)
  from public, anon;
grant execute on function
  public.abrir_caixa(uuid, integer),
  public.movimentar_caixa(uuid, public.tipo_movimento_caixa, integer, text),
  public.resumo_caixa(uuid), public.fechar_caixa(uuid, integer, text),
  public.registrar_pagamento(uuid, integer, public.forma_pagamento, text, integer),
  public.excluir_pagamento(uuid)
  to authenticated;

commit;
