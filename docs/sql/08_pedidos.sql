-- 08 — Sessões de mesa, comandas, pedidos, itens, pagamentos e a baixa de estoque na entrega.
--
-- Regras de negócio (decididas com o dono do produto):
--  * Pedido novo nasce "pendente" e RESERVA a quantidade (não baixa o estoque). Expira em 45 min se não for confirmado.
--  * Disponível = estoque físico − reservado (itens "aguardando" de pedidos confirmados ou pendentes não expirados).
--  * O estoque físico só baixa quando o item é ENTREGUE (por pedido inteiro ou item a item).
--  * Item que não pôde ser entregue (faltou, quebrou) é CANCELADO: devolve a reserva, não baixa estoque, sai da conta.
--  * Interruptor "inativar ao zerar" LIGADO: o cliente só pede até o disponível; ao zerar por baixa o produto inativa.
--    DESLIGADO: o cliente pode pedir mesmo sem estoque; a baixa na entrega é recusada se faltar estoque.
--  * Cliente é anônimo: age por funções, identificado por um código secreto (guardado só como hash).
--  * Nenhum cliente escreve nas tabelas diretamente: tudo passa por funções que validam as regras.
begin;

-- ------------------------------------------------------------------ tipos
create type public.status_sessao as enum ('aberta', 'fechamento', 'encerrada');
create type public.status_comanda as enum ('aberta', 'paga');
create type public.status_pedido as enum ('pendente', 'confirmado', 'rejeitado', 'cancelado');
create type public.status_item as enum ('aguardando', 'entregue', 'cancelado');
create type public.forma_pagamento as enum ('dinheiro', 'pix', 'debito', 'credito', 'outro');

-- Para garantir (pelo próprio banco) que filhos e pais são da mesma empresa.
alter table public.mesas add constraint mesas_id_empresa_unico unique (id, estabelecimento_id);

-- Validade de um pedido pendente (um só lugar para mudar).
create or replace function public.validade_pedido_pendente()
returns interval language sql immutable set search_path = ''
as $$ select interval '45 minutes' $$;

-- ------------------------------------------------------------------ tabelas
create table public.sessoes_mesa (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  mesa_id uuid not null,
  status public.status_sessao not null default 'aberta',
  aberta_em timestamptz not null default clock_timestamp(),
  encerrada_em timestamptz,
  constraint sessoes_mesa_mesa_fkey foreign key (mesa_id, estabelecimento_id)
    references public.mesas (id, estabelecimento_id) on delete restrict,
  constraint sessoes_mesa_encerrada_coerente check ((status = 'encerrada') = (encerrada_em is not null)),
  constraint sessoes_mesa_id_empresa_unico unique (id, estabelecimento_id)
);
-- No máximo uma sessão em andamento por mesa.
create unique index sessoes_mesa_uma_ativa on public.sessoes_mesa (mesa_id) where status <> 'encerrada';

create table public.comandas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  sessao_id uuid not null,
  mesa_id uuid not null,
  mesa_numero integer not null,
  cliente_nome text not null,
  token_hash bytea not null,
  status public.status_comanda not null default 'aberta',
  aberta_em timestamptz not null default clock_timestamp(),
  fechada_em timestamptz,
  constraint comandas_sessao_fkey foreign key (sessao_id, estabelecimento_id)
    references public.sessoes_mesa (id, estabelecimento_id) on delete restrict,
  constraint comandas_mesa_fkey foreign key (mesa_id, estabelecimento_id)
    references public.mesas (id, estabelecimento_id) on delete restrict,
  constraint comandas_nome_tamanho check (char_length(btrim(cliente_nome)) between 1 and 40),
  constraint comandas_fechada_coerente check ((status = 'paga') = (fechada_em is not null)),
  constraint comandas_id_empresa_unico unique (id, estabelecimento_id)
);
create unique index comandas_token_unico on public.comandas (token_hash);
create index comandas_sessao_idx on public.comandas (sessao_id);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  sessao_id uuid not null,
  comanda_id uuid not null,
  mesa_id uuid not null,
  status public.status_pedido not null default 'pendente',
  criado_em timestamptz not null default clock_timestamp(),
  expira_em timestamptz not null,
  confirmado_em timestamptz,
  confirmado_por uuid references auth.users(id) on delete set null,
  rejeitado_em timestamptz,
  rejeitado_por uuid references auth.users(id) on delete set null,
  motivo_rejeicao text,
  constraint pedidos_sessao_fkey foreign key (sessao_id, estabelecimento_id)
    references public.sessoes_mesa (id, estabelecimento_id) on delete restrict,
  constraint pedidos_comanda_fkey foreign key (comanda_id, estabelecimento_id)
    references public.comandas (id, estabelecimento_id) on delete restrict,
  constraint pedidos_motivo_tamanho check (motivo_rejeicao is null or char_length(motivo_rejeicao) <= 200),
  constraint pedidos_id_empresa_unico unique (id, estabelecimento_id)
);
create index pedidos_empresa_status_idx on public.pedidos (estabelecimento_id, status, criado_em desc);
create index pedidos_comanda_idx on public.pedidos (comanda_id);
create index pedidos_sessao_idx on public.pedidos (sessao_id);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  pedido_id uuid not null,
  produto_id uuid references public.produtos(id) on delete set null,
  nome_produto text not null,
  preco_unitario_centavos integer not null,
  custo_unitario_centavos integer,
  quantidade integer not null,
  subtotal_centavos bigint generated always as (quantidade::bigint * preco_unitario_centavos) stored,
  status public.status_item not null default 'aguardando',
  entregue_em timestamptz,
  entregue_por uuid references auth.users(id) on delete set null,
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id) on delete set null,
  motivo_cancelamento text,
  constraint itens_pedido_pedido_fkey foreign key (pedido_id, estabelecimento_id)
    references public.pedidos (id, estabelecimento_id) on delete restrict,
  constraint itens_quantidade check (quantidade between 1 and 999),
  constraint itens_preco check (preco_unitario_centavos between 0 and 100000000),
  constraint itens_custo check (custo_unitario_centavos is null or custo_unitario_centavos between 0 and 100000000),
  constraint itens_motivo_tamanho check (motivo_cancelamento is null or char_length(motivo_cancelamento) <= 200),
  constraint itens_entregue_coerente check ((status = 'entregue') = (entregue_em is not null)),
  constraint itens_cancelado_coerente check ((status = 'cancelado') = (cancelado_em is not null))
);
create index itens_pedido_pedido_idx on public.itens_pedido (pedido_id);
create index itens_pedido_produto_status_idx on public.itens_pedido (produto_id, status);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  comanda_id uuid not null,
  valor_centavos integer not null,
  forma public.forma_pagamento not null,
  observacao text,
  recebido_centavos integer,
  troco_centavos integer,
  criado_em timestamptz not null default clock_timestamp(),
  registrado_por uuid references auth.users(id) on delete set null,
  constraint pagamentos_comanda_fkey foreign key (comanda_id, estabelecimento_id)
    references public.comandas (id, estabelecimento_id) on delete restrict,
  constraint pagamentos_valor check (valor_centavos between 1 and 100000000),
  constraint pagamentos_observacao_tamanho check (observacao is null or char_length(observacao) <= 200),
  constraint pagamentos_dinheiro_coerente check (forma = 'dinheiro' or (recebido_centavos is null and troco_centavos is null))
);
create index pagamentos_comanda_idx on public.pagamentos (comanda_id);

-- A baixa por entrega aponta para o item entregue (e o histórico segue imutável).
alter table public.movimentos_estoque
  add column pedido_item_id uuid references public.itens_pedido(id) on delete set null;
create index movimentos_estoque_item_idx on public.movimentos_estoque (pedido_item_id);

create or replace function public.movimentos_estoque_imutavel()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'o histórico de estoque não pode ser apagado';
  end if;
  if new.estabelecimento_id is distinct from old.estabelecimento_id
     or new.nome_produto is distinct from old.nome_produto
     or new.tipo is distinct from old.tipo
     or new.variacao is distinct from old.variacao
     or new.saldo_apos is distinct from old.saldo_apos
     or new.observacao is distinct from old.observacao
     or new.usuario_id is distinct from old.usuario_id
     or new.criado_em is distinct from old.criado_em
     or (new.produto_id is distinct from old.produto_id and new.produto_id is not null)
     or (new.pedido_item_id is distinct from old.pedido_item_id and new.pedido_item_id is not null) then
    raise exception 'o histórico de estoque não pode ser alterado';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ segurança das tabelas
alter table public.sessoes_mesa enable row level security;
alter table public.comandas enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.pagamentos enable row level security;

revoke all on table public.sessoes_mesa, public.comandas, public.pedidos, public.itens_pedido, public.pagamentos
  from anon, authenticated;
grant all on table public.sessoes_mesa, public.comandas, public.pedidos, public.itens_pedido, public.pagamentos
  to service_role;
-- Painel: só leitura. O hash do código secreto da comanda nunca é exposto.
grant select on table public.sessoes_mesa, public.pedidos, public.itens_pedido, public.pagamentos to authenticated;
grant select (id, estabelecimento_id, sessao_id, mesa_id, mesa_numero, cliente_nome, status, aberta_em, fechada_em)
  on table public.comandas to authenticated;

create policy "ver sessoes" on public.sessoes_mesa for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver comandas" on public.comandas for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver pedidos" on public.pedidos for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver itens" on public.itens_pedido for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver pagamentos" on public.pagamentos for select to authenticated
  using (public.tem_acesso_estabelecimento(estabelecimento_id));

-- ------------------------------------------------------------------ auxiliares internos (sem acesso direto)
create or replace function public.exigir_acesso(_empresa uuid)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.tem_acesso_estabelecimento(_empresa) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.hash_token(_token text)
returns bytea language sql immutable set search_path = ''
as $$ select sha256(convert_to(coalesce(_token, ''), 'UTF8')) $$;

-- Quantidade reservada de um produto: itens "aguardando" de pedidos confirmados ou pendentes ainda válidos.
create or replace function public.qtd_reservada(_produto uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(i.quantidade), 0)::integer
    from public.itens_pedido i
    join public.pedidos p on p.id = i.pedido_id
   where i.produto_id = _produto
     and i.status = 'aguardando'
     and (p.status = 'confirmado' or (p.status = 'pendente' and p.expira_em > clock_timestamp()));
$$;

create or replace function public.comanda_devido(_comanda uuid)
returns bigint language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(i.subtotal_centavos), 0)::bigint
    from public.itens_pedido i
    join public.pedidos p on p.id = i.pedido_id
   where p.comanda_id = _comanda and p.status = 'confirmado' and i.status in ('aguardando', 'entregue');
$$;

create or replace function public.comanda_pago(_comanda uuid)
returns bigint language sql stable security definer set search_path = ''
as $$ select coalesce(sum(valor_centavos), 0)::bigint from public.pagamentos where comanda_id = _comanda $$;

revoke all on function public.exigir_acesso(uuid), public.hash_token(text), public.qtd_reservada(uuid),
  public.comanda_devido(uuid), public.comanda_pago(uuid), public.validade_pedido_pendente()
  from public, anon, authenticated;

-- ------------------------------------------------------------------ funções do CLIENTE (sem login)

-- Cardápio da mesa: só o necessário (sem custo, sem estoque exato).
create or replace function public.obter_cardapio_publico(_slug text, _numero integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare e record; m record;
begin
  select id, slug, nome, cor_primaria, cor_secundaria, logo_url into e
    from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then return null; end if;
  select numero, ativa into m from public.mesas where estabelecimento_id = e.id and numero = _numero;
  if not found then return null; end if;

  return jsonb_build_object(
    'empresa', jsonb_build_object('nome', e.nome, 'slug', e.slug, 'cor_primaria', e.cor_primaria,
                                  'cor_secundaria', e.cor_secundaria, 'logo_url', e.logo_url),
    'mesa', jsonb_build_object('numero', m.numero, 'ativa', m.ativa),
    'categorias', case when not m.ativa then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'descricao', c.descricao,
        'produtos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id, 'nome', p.nome, 'descricao', p.descricao,
            'preco_venda_centavos', p.preco_venda_centavos, 'foto_path', p.foto_path,
            -- esgotado só vale com o interruptor ligado; desligado, sempre dá para pedir
            'esgotado', (p.inativar_ao_zerar_estoque and p.estoque_qtd - public.qtd_reservada(p.id) <= 0),
            'qtd_disponivel', case when p.inativar_ao_zerar_estoque
                                   then greatest(p.estoque_qtd - public.qtd_reservada(p.id), 0) else null end
          ) order by p.nome)
          from public.produtos p
         where p.categoria_id = c.id and p.estabelecimento_id = e.id and p.disponivel), '[]'::jsonb)
      ) order by c.nome)
      from public.categorias c
     where c.estabelecimento_id = e.id and c.ativa
       -- categoria sem nenhum produto disponível não aparece para o cliente
       and exists (select 1 from public.produtos q where q.categoria_id = c.id and q.estabelecimento_id = e.id and q.disponivel)
      ), '[]'::jsonb) end
  );
end;
$$;

-- Abre (se preciso) a sessão da mesa e cria a comanda do cliente. Devolve o código secreto UMA vez.
create or replace function public.identificar_cliente(_slug text, _numero integer, _nome text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  e record; m record; s record;
  nome text := btrim(coalesce(_nome, ''));
  tok text; cid uuid; n integer;
begin
  if char_length(nome) not between 1 and 40 then raise exception 'nome_invalido'; end if;
  select id into e from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then raise exception 'empresa_indisponivel'; end if;
  -- trava a mesa: duas pessoas chegando juntas não criam duas sessões
  select id, numero into m from public.mesas
   where estabelecimento_id = e.id and numero = _numero and ativa for update;
  if not found then raise exception 'mesa_indisponivel'; end if;

  -- limpeza preguiçosa: comanda aberta sem nenhum pedido há mais de 45 min é encerrada,
  -- e a sessão sem comandas abertas e sem pedidos também (evita "ocupar" mesa à toa)
  update public.comandas c set status = 'paga', fechada_em = clock_timestamp()
   where c.mesa_id = m.id and c.status = 'aberta'
     and c.aberta_em < clock_timestamp() - public.validade_pedido_pendente()
     and not exists (select 1 from public.pedidos p where p.comanda_id = c.id);
  update public.sessoes_mesa x set status = 'encerrada', encerrada_em = clock_timestamp()
   where x.mesa_id = m.id and x.status <> 'encerrada'
     and not exists (select 1 from public.comandas c where c.sessao_id = x.id and c.status = 'aberta')
     and not exists (select 1 from public.pedidos p where p.sessao_id = x.id);

  select * into s from public.sessoes_mesa where mesa_id = m.id and status <> 'encerrada';
  if not found then
    insert into public.sessoes_mesa (estabelecimento_id, mesa_id) values (e.id, m.id) returning * into s;
  end if;
  if s.status = 'fechamento' then raise exception 'mesa_em_fechamento'; end if;

  select count(*) into n from public.comandas where sessao_id = s.id and status = 'aberta';
  if n >= 10 then raise exception 'muitos_clientes'; end if;

  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.comandas (estabelecimento_id, sessao_id, mesa_id, mesa_numero, cliente_nome, token_hash)
  values (e.id, s.id, m.id, m.numero, nome, public.hash_token(tok))
  returning id into cid;
  return jsonb_build_object('comanda_id', cid, 'token', tok);
end;
$$;

-- Envia um pedido: valida tudo e RESERVA (não baixa estoque).
-- _itens: [{"produto_id": "<uuid>", "quantidade": 2}, ...]
create or replace function public.enviar_pedido(_token text, _itens jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c record; s record; pr record;
  ids uuid[]; qtds integer[]; idx integer; pedido uuid; disp integer; n integer;
begin
  select * into c from public.comandas where token_hash = public.hash_token(_token);
  if not found then raise exception 'comanda_invalida'; end if;
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  select * into s from public.sessoes_mesa where id = c.sessao_id;
  if s.status = 'fechamento' then raise exception 'mesa_em_fechamento'; end if;
  if s.status = 'encerrada' then raise exception 'comanda_fechada'; end if;
  if not exists (select 1 from public.estabelecimentos where id = c.estabelecimento_id and ativo) then
    raise exception 'empresa_indisponivel';
  end if;
  if not exists (select 1 from public.mesas where id = c.mesa_id and ativa) then
    raise exception 'mesa_indisponivel';
  end if;

  if _itens is null or jsonb_typeof(_itens) <> 'array' or jsonb_array_length(_itens) not between 1 and 30 then
    raise exception 'itens_invalidos';
  end if;
  -- agrega repetidos e valida o formato (qualquer erro de conversão vira itens_invalidos)
  begin
    select array_agg(x.pid order by x.pid), array_agg(x.q order by x.pid) into ids, qtds
      from (select (e ->> 'produto_id')::uuid as pid, sum((e ->> 'quantidade')::integer)::integer as q
              from jsonb_array_elements(_itens) e group by 1) x;
  exception when others then
    raise exception 'itens_invalidos';
  end;
  if ids is null or exists (select 1 from unnest(ids) u where u is null)
     or exists (select 1 from unnest(qtds) u where u is null or u < 1 or u > 99) then
    raise exception 'itens_invalidos';
  end if;

  -- limites contra abuso
  select count(*) into n from public.pedidos where comanda_id = c.id and status = 'pendente' and expira_em > clock_timestamp();
  if n >= 5 then raise exception 'muitos_pedidos_pendentes'; end if;
  select count(*) into n from public.pedidos where sessao_id = c.sessao_id and status = 'pendente' and expira_em > clock_timestamp();
  if n >= 20 then raise exception 'muitos_pedidos_pendentes'; end if;

  -- trava os produtos (sempre na mesma ordem, para não travar um ao outro)
  perform 1 from public.produtos where id = any (ids) and estabelecimento_id = c.estabelecimento_id order by id for update;

  insert into public.pedidos (estabelecimento_id, sessao_id, comanda_id, mesa_id, expira_em)
  values (c.estabelecimento_id, c.sessao_id, c.id, c.mesa_id, clock_timestamp() + public.validade_pedido_pendente())
  returning id into pedido;

  for idx in 1 .. array_length(ids, 1) loop
    select p.id, p.nome, p.preco_venda_centavos, p.preco_custo_centavos, p.estoque_qtd,
           p.inativar_ao_zerar_estoque as limita, p.disponivel, cat.ativa as cat_ativa
      into pr
      from public.produtos p join public.categorias cat on cat.id = p.categoria_id
     where p.id = ids[idx] and p.estabelecimento_id = c.estabelecimento_id;
    if not found or not pr.disponivel or not pr.cat_ativa then
      raise exception 'produto_indisponivel' using detail = coalesce(pr.nome, ids[idx]::text);
    end if;
    if pr.limita then
      -- a reserva deste pedido ainda não conta (itens entram só depois da checagem)
      disp := pr.estoque_qtd - public.qtd_reservada(pr.id);
      if qtds[idx] > disp then
        raise exception 'quantidade_indisponivel' using detail = pr.nome || ': restam ' || greatest(disp, 0);
      end if;
    end if;
    insert into public.itens_pedido (estabelecimento_id, pedido_id, produto_id, nome_produto,
                                     preco_unitario_centavos, custo_unitario_centavos, quantidade)
    values (c.estabelecimento_id, pedido, pr.id, pr.nome, pr.preco_venda_centavos, pr.preco_custo_centavos, qtds[idx]);
  end loop;
  return pedido;
end;
$$;

-- O cliente cancela um pedido que ainda está pendente (libera a reserva).
create or replace function public.cancelar_meu_pedido(_token text, _pedido uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c record; p record;
begin
  select * into c from public.comandas where token_hash = public.hash_token(_token);
  if not found then raise exception 'comanda_invalida'; end if;
  select * into p from public.pedidos where id = _pedido and comanda_id = c.id for update;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  if p.status <> 'pendente' then raise exception 'pedido_nao_pendente'; end if;
  update public.pedidos set status = 'cancelado' where id = p.id;
end;
$$;

-- Tudo da comanda do cliente: pedidos, itens, totais e pagamentos.
create or replace function public.minha_comanda(_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare c record; s record; e record; devido bigint; pago bigint;
begin
  select * into c from public.comandas where token_hash = public.hash_token(_token);
  if not found then return null; end if;
  select status into s from public.sessoes_mesa where id = c.sessao_id;
  select nome, slug into e from public.estabelecimentos where id = c.estabelecimento_id;
  devido := public.comanda_devido(c.id);
  pago := public.comanda_pago(c.id);
  return jsonb_build_object(
    'comanda', jsonb_build_object('id', c.id, 'cliente_nome', c.cliente_nome, 'status', c.status,
                                  'mesa_numero', c.mesa_numero, 'sessao_status', s.status),
    'empresa', jsonb_build_object('nome', e.nome, 'slug', e.slug),
    'devido_centavos', devido, 'pago_centavos', pago, 'saldo_centavos', devido - pago,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'status', p.status, 'criado_em', p.criado_em, 'expira_em', p.expira_em,
        'expirado', (p.status = 'pendente' and p.expira_em <= clock_timestamp()),
        'motivo_rejeicao', p.motivo_rejeicao,
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'nome_produto', i.nome_produto, 'quantidade', i.quantidade,
            'preco_unitario_centavos', i.preco_unitario_centavos, 'subtotal_centavos', i.subtotal_centavos,
            'status', i.status, 'motivo_cancelamento', i.motivo_cancelamento) order by i.nome_produto)
          from public.itens_pedido i where i.pedido_id = p.id), '[]'::jsonb)
      ) order by p.criado_em desc)
      from public.pedidos p where p.comanda_id = c.id), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object('valor_centavos', g.valor_centavos, 'forma', g.forma, 'criado_em', g.criado_em)
                       order by g.criado_em)
      from public.pagamentos g where g.comanda_id = c.id), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------------ funções do PAINEL (login)

create or replace function public.confirmar_pedido(_pedido uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare p record; c record;
begin
  select * into p from public.pedidos where id = _pedido for update;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  perform public.exigir_acesso(p.estabelecimento_id);
  if p.status <> 'pendente' then raise exception 'pedido_nao_pendente'; end if;
  if p.expira_em <= clock_timestamp() then raise exception 'pedido_expirado'; end if;
  select status into c from public.comandas where id = p.comanda_id;
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  update public.pedidos set status = 'confirmado', confirmado_em = clock_timestamp(), confirmado_por = (select auth.uid())
   where id = p.id;
end;
$$;

create or replace function public.rejeitar_pedido(_pedido uuid, _motivo text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare p record; motivo text := nullif(btrim(coalesce(_motivo, '')), '');
begin
  select * into p from public.pedidos where id = _pedido for update;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  perform public.exigir_acesso(p.estabelecimento_id);
  if p.status <> 'pendente' then raise exception 'pedido_nao_pendente'; end if;
  if motivo is not null and char_length(motivo) > 200 then raise exception 'motivo_invalido'; end if;
  update public.pedidos
     set status = 'rejeitado', rejeitado_em = clock_timestamp(), rejeitado_por = (select auth.uid()), motivo_rejeicao = motivo
   where id = p.id;
end;
$$;

-- Entrega itens (pedido inteiro ou item a item): baixa o estoque físico, tudo ou nada.
-- Se faltar estoque de algum item, nada é entregue e o erro diz qual (o atendente repõe o estoque ou cancela o item).
create or replace function public.entregar_itens(_itens uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  i record; pr record; novo integer; qtd integer := 0; empresa uuid;
begin
  if _itens is null or coalesce(array_length(_itens, 1), 0) = 0 then raise exception 'item_nao_entregavel'; end if;
  for i in
    select it.id, it.estabelecimento_id, it.produto_id, it.nome_produto, it.quantidade, it.status as status_item, p.status as status_pedido
      from public.itens_pedido it join public.pedidos p on p.id = it.pedido_id
     where it.id = any (_itens)
     order by it.produto_id nulls last, it.id
       for update of it
  loop
    qtd := qtd + 1;
    if empresa is null then empresa := i.estabelecimento_id; perform public.exigir_acesso(empresa); end if;
    if i.estabelecimento_id <> empresa then raise exception 'sem_permissao' using errcode = '42501'; end if;
    if i.status_item <> 'aguardando' or i.status_pedido <> 'confirmado' then
      raise exception 'item_nao_entregavel' using detail = i.nome_produto;
    end if;
    if i.produto_id is not null then
      select id, nome, estoque_qtd, inativar_ao_zerar_estoque into pr from public.produtos where id = i.produto_id for update;
      if pr.estoque_qtd < i.quantidade then
        raise exception 'estoque_insuficiente' using detail = pr.nome || ': estoque ' || pr.estoque_qtd || ', pedido ' || i.quantidade;
      end if;
      novo := pr.estoque_qtd - i.quantidade;
      update public.produtos
         set estoque_qtd = novo,
             disponivel = case when novo = 0 and pr.inativar_ao_zerar_estoque then false else disponivel end
       where id = pr.id;
      if i.quantidade > 0 then
        insert into public.movimentos_estoque
          (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, usuario_id, pedido_item_id)
        values (i.estabelecimento_id, pr.id, pr.nome, 'baixa_entrega', -i.quantidade, novo, (select auth.uid()), i.id);
      end if;
    end if;
    update public.itens_pedido
       set status = 'entregue', entregue_em = clock_timestamp(), entregue_por = (select auth.uid())
     where id = i.id;
  end loop;
  if qtd <> (select count(distinct x) from unnest(_itens) x) then raise exception 'item_nao_entregavel'; end if;
  return qtd;
end;
$$;

create or replace function public.entregar_pedido(_pedido uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare p record; ids uuid[];
begin
  select * into p from public.pedidos where id = _pedido;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  perform public.exigir_acesso(p.estabelecimento_id);
  if p.status <> 'confirmado' then raise exception 'item_nao_entregavel'; end if;
  select array_agg(id) into ids from public.itens_pedido where pedido_id = p.id and status = 'aguardando';
  if ids is null then raise exception 'nada_a_entregar'; end if;
  return public.entregar_itens(ids);
end;
$$;

-- Cancela um item ainda não entregue (faltou, quebrou…): devolve a reserva, não baixa estoque, sai da conta.
create or replace function public.cancelar_item(_item uuid, _motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare i record; motivo text := nullif(btrim(coalesce(_motivo, '')), '');
begin
  select it.id, it.estabelecimento_id, it.status as status_item, p.status as status_pedido, p.comanda_id
    into i from public.itens_pedido it join public.pedidos p on p.id = it.pedido_id
   where it.id = _item for update of it;
  if not found then raise exception 'item_nao_encontrado'; end if;
  perform public.exigir_acesso(i.estabelecimento_id);
  if motivo is null then raise exception 'motivo_obrigatorio'; end if;
  if char_length(motivo) > 200 then raise exception 'motivo_invalido'; end if;
  if i.status_item <> 'aguardando' or i.status_pedido <> 'confirmado' then raise exception 'item_nao_cancelavel'; end if;
  update public.itens_pedido
     set status = 'cancelado', cancelado_em = clock_timestamp(), cancelado_por = (select auth.uid()), motivo_cancelamento = motivo
   where id = i.id;
end;
$$;

create or replace function public.registrar_pagamento(
  _comanda uuid, _valor integer, _forma public.forma_pagamento,
  _observacao text default null, _recebido integer default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare c record; saldo bigint; troco integer; recebido integer; novo_id uuid;
        obs text := nullif(btrim(coalesce(_observacao, '')), '');
begin
  select * into c from public.comandas where id = _comanda for update;
  if not found then raise exception 'comanda_nao_encontrada'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  if _valor is null or _valor <= 0 then raise exception 'valor_invalido'; end if;
  if obs is not null and char_length(obs) > 200 then raise exception 'observacao_invalida'; end if;
  saldo := public.comanda_devido(c.id) - public.comanda_pago(c.id);
  if _valor > saldo then raise exception 'valor_excede_saldo' using detail = saldo::text; end if;
  if _forma = 'dinheiro' and _recebido is not null then
    if _recebido < _valor then raise exception 'recebido_menor_que_valor'; end if;
    recebido := _recebido; troco := _recebido - _valor;
  end if;
  insert into public.pagamentos (estabelecimento_id, comanda_id, valor_centavos, forma, observacao,
                                 recebido_centavos, troco_centavos, registrado_por)
  values (c.estabelecimento_id, c.id, _valor, _forma, obs, recebido, troco, (select auth.uid()))
  returning pagamentos.id into novo_id;
  return novo_id;
end;
$$;

create or replace function public.excluir_pagamento(_pagamento uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare g record; c record;
begin
  select * into g from public.pagamentos where id = _pagamento;
  if not found then raise exception 'pagamento_nao_encontrado'; end if;
  perform public.exigir_acesso(g.estabelecimento_id);
  select * into c from public.comandas where id = g.comanda_id for update;
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  delete from public.pagamentos where id = g.id;
end;
$$;

create or replace function public.fechar_comanda(_comanda uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c record; saldo bigint;
begin
  select * into c from public.comandas where id = _comanda for update;
  if not found then raise exception 'comanda_nao_encontrada'; end if;
  perform public.exigir_acesso(c.estabelecimento_id);
  if c.status <> 'aberta' then raise exception 'comanda_fechada'; end if;
  if exists (select 1 from public.pedidos where comanda_id = c.id and status = 'pendente' and expira_em > clock_timestamp()) then
    raise exception 'pedidos_pendentes';
  end if;
  if exists (select 1 from public.itens_pedido i join public.pedidos p on p.id = i.pedido_id
              where p.comanda_id = c.id and p.status = 'confirmado' and i.status = 'aguardando') then
    raise exception 'itens_nao_entregues';
  end if;
  saldo := public.comanda_devido(c.id) - public.comanda_pago(c.id);
  if saldo <> 0 then raise exception 'saldo_em_aberto' using detail = saldo::text; end if;
  update public.comandas set status = 'paga', fechada_em = clock_timestamp() where id = c.id;
end;
$$;

create or replace function public.iniciar_fechamento_mesa(_mesa uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from public.mesas where id = _mesa;
  if not found then raise exception 'mesa_nao_encontrada'; end if;
  perform public.exigir_acesso(m.estabelecimento_id);
  update public.sessoes_mesa set status = 'fechamento' where mesa_id = _mesa and status = 'aberta';
  if not found then raise exception 'mesa_sem_atendimento'; end if;
end;
$$;

create or replace function public.retomar_atendimento_mesa(_mesa uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from public.mesas where id = _mesa;
  if not found then raise exception 'mesa_nao_encontrada'; end if;
  perform public.exigir_acesso(m.estabelecimento_id);
  update public.sessoes_mesa set status = 'aberta' where mesa_id = _mesa and status = 'fechamento';
  if not found then raise exception 'mesa_sem_atendimento'; end if;
end;
$$;

-- Libera a mesa: sem pedidos pendentes, sem itens a entregar e com todas as comandas pagas.
create or replace function public.liberar_mesa(_mesa uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m record; s record;
begin
  select * into m from public.mesas where id = _mesa for update;
  if not found then raise exception 'mesa_nao_encontrada'; end if;
  perform public.exigir_acesso(m.estabelecimento_id);
  select * into s from public.sessoes_mesa where mesa_id = _mesa and status <> 'encerrada' for update;
  if not found then raise exception 'mesa_sem_atendimento'; end if;
  if exists (select 1 from public.pedidos where sessao_id = s.id and status = 'pendente' and expira_em > clock_timestamp()) then
    raise exception 'pedidos_pendentes';
  end if;
  if exists (select 1 from public.itens_pedido i join public.pedidos p on p.id = i.pedido_id
              where p.sessao_id = s.id and p.status = 'confirmado' and i.status = 'aguardando') then
    raise exception 'itens_nao_entregues';
  end if;
  if exists (select 1 from public.comandas where sessao_id = s.id and status = 'aberta') then
    raise exception 'comandas_em_aberto';
  end if;
  update public.sessoes_mesa set status = 'encerrada', encerrada_em = clock_timestamp() where id = s.id;
end;
$$;

-- ------------------------------------------------------------------ permissões de execução
-- Cliente sem login (anon) e painel (authenticated).
revoke all on function
  public.obter_cardapio_publico(text, integer), public.identificar_cliente(text, integer, text),
  public.enviar_pedido(text, jsonb), public.cancelar_meu_pedido(text, uuid), public.minha_comanda(text)
  from public;
grant execute on function
  public.obter_cardapio_publico(text, integer), public.identificar_cliente(text, integer, text),
  public.enviar_pedido(text, jsonb), public.cancelar_meu_pedido(text, uuid), public.minha_comanda(text)
  to anon, authenticated;

revoke all on function
  public.confirmar_pedido(uuid), public.rejeitar_pedido(uuid, text), public.entregar_itens(uuid[]),
  public.entregar_pedido(uuid), public.cancelar_item(uuid, text),
  public.registrar_pagamento(uuid, integer, public.forma_pagamento, text, integer),
  public.excluir_pagamento(uuid), public.fechar_comanda(uuid), public.iniciar_fechamento_mesa(uuid),
  public.retomar_atendimento_mesa(uuid), public.liberar_mesa(uuid)
  from public, anon;
grant execute on function
  public.confirmar_pedido(uuid), public.rejeitar_pedido(uuid, text), public.entregar_itens(uuid[]),
  public.entregar_pedido(uuid), public.cancelar_item(uuid, text),
  public.registrar_pagamento(uuid, integer, public.forma_pagamento, text, integer),
  public.excluir_pagamento(uuid), public.fechar_comanda(uuid), public.iniciar_fechamento_mesa(uuid),
  public.retomar_atendimento_mesa(uuid), public.liberar_mesa(uuid)
  to authenticated;

commit;
