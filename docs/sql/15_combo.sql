-- 15 — Combo: um produto que, ao ser entregue, baixa o estoque de outros produtos já cadastrados.
--
-- Exemplo: "Balde de cerveja" = 5 × "Cerveja". O combo NÃO tem estoque próprio: a quantidade que o cliente
-- consegue pedir vem dos componentes (ex.: 12 cervejas = 2 baldes). O pedido reserva os componentes e a
-- entrega baixa cada um (um movimento "baixa por entrega" por componente). O custo do combo é a soma do custo
-- dos componentes × quantidade (sem custo em algum componente = custo desconhecido, lucro parcial).
-- A composição do combo no momento do pedido fica guardada no item (mudar o combo depois não altera pedidos
-- já feitos). Combo não contém combo. Rodar depois do 14.
begin;

alter table public.produtos add column eh_combo boolean not null default false;
alter table public.produtos add constraint produtos_id_empresa_unico unique (id, estabelecimento_id);

-- O app não liga/desliga "combo" direto: só pela função definir_combo (as colunas liberadas no 07 não incluem eh_combo).

create table public.combo_itens (
  combo_id uuid not null,
  componente_id uuid not null,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  quantidade integer not null,
  primary key (combo_id, componente_id),
  constraint combo_itens_combo_fkey foreign key (combo_id, estabelecimento_id)
    references public.produtos (id, estabelecimento_id) on delete cascade,
  -- um produto que faz parte de um combo não pode ser excluído
  constraint combo_itens_componente_fkey foreign key (componente_id, estabelecimento_id)
    references public.produtos (id, estabelecimento_id) on delete restrict,
  constraint combo_itens_quantidade check (quantidade between 1 and 99),
  constraint combo_itens_diferentes check (combo_id <> componente_id)
);
create index combo_itens_componente_idx on public.combo_itens (componente_id);

-- Foto da composição no momento do pedido.
create table public.itens_pedido_combo (
  item_id uuid not null references public.itens_pedido(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete set null,
  nome_produto text not null,
  quantidade integer not null,   -- por unidade do combo
  constraint itens_pedido_combo_quantidade check (quantidade between 1 and 99)
);
create index itens_pedido_combo_item_idx on public.itens_pedido_combo (item_id);
create index itens_pedido_combo_produto_idx on public.itens_pedido_combo (produto_id);

alter table public.combo_itens enable row level security;
alter table public.itens_pedido_combo enable row level security;
revoke all on table public.combo_itens, public.itens_pedido_combo from anon, authenticated;
grant select on table public.combo_itens, public.itens_pedido_combo to authenticated;
grant all on table public.combo_itens, public.itens_pedido_combo to service_role;
create policy "ver itens de combo" on public.combo_itens
  for select to authenticated using (public.tem_acesso_estabelecimento(estabelecimento_id));
create policy "ver composição dos pedidos" on public.itens_pedido_combo
  for select to authenticated using (public.tem_acesso_estabelecimento(estabelecimento_id));

-- Custo do combo = soma (custo do componente × quantidade); null se faltar o custo de algum componente.
create or replace function public.custo_combo(_combo uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select case when count(*) = 0 or bool_or(p.preco_custo_centavos is null) then null
              else sum(p.preco_custo_centavos::bigint * ci.quantidade)::integer end
    from public.combo_itens ci join public.produtos p on p.id = ci.componente_id
   where ci.combo_id = _combo
$$;

-- Liga/desliga "combo" e define os componentes. `_itens` = [{"produto_id": "...", "quantidade": 5}, ...];
-- lista vazia ou nula desmarca o combo. Substitui a composição anterior.
create or replace function public.definir_combo(_produto uuid, _itens jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  p record; ids uuid[]; qtds integer[]; i integer; comp record;
begin
  if (select auth.uid()) is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select id, estabelecimento_id, estoque_qtd into p from public.produtos where id = _produto for update;
  if not found then raise exception 'produto_nao_encontrado'; end if;
  if not public.tem_acesso_estabelecimento(p.estabelecimento_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if _itens is null or jsonb_typeof(_itens) = 'null' or _itens = '[]'::jsonb then
    delete from public.combo_itens where combo_id = _produto;
    update public.produtos set eh_combo = false where id = _produto;
    return;
  end if;

  if jsonb_typeof(_itens) <> 'array' or jsonb_array_length(_itens) > 20 then raise exception 'combo_invalido'; end if;
  begin
    select array_agg(x.pid order by x.pid), array_agg(x.q order by x.pid) into ids, qtds
      from (select (e ->> 'produto_id')::uuid as pid, (e ->> 'quantidade')::integer as q
              from jsonb_array_elements(_itens) e) x;
  exception when others then
    raise exception 'combo_invalido';
  end;
  if ids is null or exists (select 1 from unnest(ids) u where u is null)
     or exists (select 1 from unnest(qtds) u where u is null or u < 1 or u > 99)
     or (select count(distinct u) from unnest(ids) u) <> array_length(ids, 1) then
    raise exception 'combo_invalido';
  end if;
  if _produto = any (ids) then raise exception 'combo_invalido'; end if;
  if exists (select 1 from public.combo_itens where componente_id = _produto) then
    raise exception 'produto_em_combo';   -- já é componente de outro combo
  end if;
  if p.estoque_qtd <> 0 then raise exception 'combo_com_estoque'; end if;   -- combo não tem estoque próprio

  -- componentes: mesma empresa, produtos comuns (não combo); trava na mesma ordem
  for comp in select id, estabelecimento_id, eh_combo from public.produtos where id = any (ids) order by id for share loop
    if comp.estabelecimento_id <> p.estabelecimento_id or comp.eh_combo then
      raise exception 'componente_invalido';
    end if;
  end loop;
  if (select count(*) from public.produtos where id = any (ids)) <> array_length(ids, 1) then
    raise exception 'componente_invalido';
  end if;

  delete from public.combo_itens where combo_id = _produto;
  for i in 1 .. array_length(ids, 1) loop
    insert into public.combo_itens (combo_id, componente_id, estabelecimento_id, quantidade)
    values (_produto, ids[i], p.estabelecimento_id, qtds[i]);
  end loop;
  update public.produtos set eh_combo = true where id = _produto;
end;
$$;
revoke all on function public.definir_combo(uuid, jsonb) from public, anon;
grant execute on function public.definir_combo(uuid, jsonb) to authenticated;
revoke all on function public.custo_combo(uuid) from public, anon, authenticated;

-- Combo não tem estoque próprio: ajuste manual de estoque é recusado (o resto da função é o do script 07).
create or replace function public.ajustar_estoque(
  _produto uuid,
  _tipo public.tipo_movimento_estoque,
  _quantidade integer,
  _observacao text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  atual integer;
  novo integer;
  obs text := nullif(btrim(coalesce(_observacao, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select id, estabelecimento_id, nome, estoque_qtd, inativar_ao_zerar_estoque, eh_combo
    into p
    from public.produtos
   where id = _produto
   for update;
  if not found then
    raise exception 'produto_nao_encontrado';
  end if;
  if not public.tem_acesso_estabelecimento(p.estabelecimento_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p.eh_combo then
    raise exception 'produto_combo';
  end if;

  if _tipo = 'baixa_entrega' then
    raise exception 'tipo_invalido';
  end if;
  if _quantidade is null or _quantidade < 0 then
    raise exception 'quantidade_invalida';
  end if;
  if obs is not null and char_length(obs) > 200 then
    raise exception 'observacao_invalida';
  end if;

  atual := p.estoque_qtd;
  if _tipo = 'saldo_inicial' then
    if exists (select 1 from public.movimentos_estoque where produto_id = _produto) then
      raise exception 'saldo_inicial_ja_registrado';
    end if;
    novo := _quantidade;
  elsif _tipo = 'reposicao' then
    if _quantidade <= 0 then raise exception 'quantidade_invalida'; end if;
    novo := atual + _quantidade;
  elsif _tipo = 'alteracao_quantidade' then
    if obs is null then raise exception 'observacao_obrigatoria'; end if;
    novo := _quantidade;
  else -- baixa_avaria
    if _quantidade <= 0 then raise exception 'quantidade_invalida'; end if;
    if obs is null then raise exception 'observacao_obrigatoria'; end if;
    if _quantidade > atual then raise exception 'estoque_insuficiente'; end if;
    novo := atual - _quantidade;
  end if;

  if novo > 1000000 then raise exception 'limite_excedido'; end if;
  if novo = atual then raise exception 'sem_alteracao'; end if;

  update public.produtos
     set estoque_qtd = novo,
         disponivel = case when novo = 0 and novo < atual and p.inativar_ao_zerar_estoque then false else disponivel end
   where id = _produto;

  insert into public.movimentos_estoque
    (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, observacao, usuario_id)
  values
    (p.estabelecimento_id, p.id, p.nome, _tipo, novo - atual, novo, obs, (select auth.uid()));

  return novo;
end;
$$;
revoke all on function public.ajustar_estoque(uuid, public.tipo_movimento_estoque, integer, text) from public, anon;
grant execute on function public.ajustar_estoque(uuid, public.tipo_movimento_estoque, integer, text) to authenticated;

-- Reservado = itens aguardando de pedidos válidos, diretos + via combos (composição guardada no item).
create or replace function public.qtd_reservada(_produto uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select (
    coalesce((
      select sum(i.quantidade)
        from public.itens_pedido i join public.pedidos p on p.id = i.pedido_id
       where i.produto_id = _produto and i.status = 'aguardando'
         and (p.status = 'confirmado' or (p.status = 'pendente' and p.expira_em > clock_timestamp()))
         and not exists (select 1 from public.itens_pedido_combo x where x.item_id = i.id)), 0)
    +
    coalesce((
      select sum(i.quantidade::bigint * ic.quantidade)
        from public.itens_pedido_combo ic
        join public.itens_pedido i on i.id = ic.item_id
        join public.pedidos p on p.id = i.pedido_id
       where ic.produto_id = _produto and i.status = 'aguardando'
         and (p.status = 'confirmado' or (p.status = 'pendente' and p.expira_em > clock_timestamp()))), 0)
  )::integer;
$$;
revoke all on function public.qtd_reservada(uuid) from public, anon, authenticated;

-- Quantos combos ainda dá para fazer: menor (disponível ÷ quantidade) entre os componentes que limitam
-- (interruptor "inativar ao zerar" ligado). Null = nenhum componente limita. Componente indisponível = 0.
create or replace function public.combo_disponivel(_combo uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select min(
    case when not (p.disponivel and cat.ativa) then 0
         when p.inativar_ao_zerar_estoque then greatest(p.estoque_qtd - public.qtd_reservada(p.id), 0) / ci.quantidade
         else null end)
    from public.combo_itens ci
    join public.produtos p on p.id = ci.componente_id
    join public.categorias cat on cat.id = p.categoria_id
   where ci.combo_id = _combo
$$;
revoke all on function public.combo_disponivel(uuid) from public, anon, authenticated;

-- Cardápio da mesa: combos mostram "inclui" e a disponibilidade vem dos componentes.
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
            'esgotado', case when p.eh_combo
                             then coalesce(public.combo_disponivel(p.id), 1) <= 0
                             else (p.inativar_ao_zerar_estoque and p.estoque_qtd - public.qtd_reservada(p.id) <= 0) end,
            'qtd_disponivel', case when p.eh_combo then public.combo_disponivel(p.id)
                                   when p.inativar_ao_zerar_estoque
                                   then greatest(p.estoque_qtd - public.qtd_reservada(p.id), 0) else null end,
            'inclui', case when p.eh_combo then coalesce((
                select jsonb_agg(jsonb_build_object('nome', q.nome, 'quantidade', ci.quantidade) order by q.nome)
                  from public.combo_itens ci join public.produtos q on q.id = ci.componente_id
                 where ci.combo_id = p.id), '[]'::jsonb) else null end
          ) order by p.nome)
          from public.produtos p
         where p.categoria_id = c.id and p.estabelecimento_id = e.id and p.disponivel), '[]'::jsonb)
      ) order by c.nome)
      from public.categorias c
     where c.estabelecimento_id = e.id and c.ativa
       and exists (select 1 from public.produtos q where q.categoria_id = c.id and q.estabelecimento_id = e.id and q.disponivel)
      ), '[]'::jsonb) end
  );
end;
$$;

-- Envio do pedido: combos reservam os componentes e guardam a composição e o custo no item.
create or replace function public.enviar_pedido(_token text, _itens jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c record; s record; pr record; cp record;
  ids uuid[]; qtds integer[]; idx integer; pedido uuid; disp integer; n integer; item uuid; restam integer;
  custo integer;
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

  select count(*) into n from public.pedidos where comanda_id = c.id and status = 'pendente' and expira_em > clock_timestamp();
  if n >= 5 then raise exception 'muitos_pedidos_pendentes'; end if;
  select count(*) into n from public.pedidos where sessao_id = c.sessao_id and status = 'pendente' and expira_em > clock_timestamp();
  if n >= 20 then raise exception 'muitos_pedidos_pendentes'; end if;

  -- trava os produtos pedidos e os componentes dos combos (sempre na mesma ordem)
  perform 1 from public.produtos
    where estabelecimento_id = c.estabelecimento_id
      and (id = any (ids) or id in (select ci.componente_id from public.combo_itens ci where ci.combo_id = any (ids)))
    order by id for update;

  insert into public.pedidos (estabelecimento_id, sessao_id, comanda_id, mesa_id, expira_em)
  values (c.estabelecimento_id, c.sessao_id, c.id, c.mesa_id, clock_timestamp() + public.validade_pedido_pendente())
  returning id into pedido;

  for idx in 1 .. array_length(ids, 1) loop
    select p.id, p.nome, p.preco_venda_centavos, p.preco_custo_centavos, p.estoque_qtd, p.eh_combo,
           p.inativar_ao_zerar_estoque as limita, p.disponivel, cat.ativa as cat_ativa
      into pr
      from public.produtos p join public.categorias cat on cat.id = p.categoria_id
     where p.id = ids[idx] and p.estabelecimento_id = c.estabelecimento_id;
    if not found or not pr.disponivel or not pr.cat_ativa then
      raise exception 'produto_indisponivel' using detail = coalesce(pr.nome, ids[idx]::text);
    end if;

    if pr.eh_combo then
      -- cada componente precisa estar ativo; os que limitam precisam ter saldo para a quantidade pedida
      restam := public.combo_disponivel(pr.id);
      if not exists (select 1 from public.combo_itens where combo_id = pr.id) then
        raise exception 'produto_indisponivel' using detail = pr.nome;
      end if;
      if restam is not null and qtds[idx] > restam then
        if restam = 0 then raise exception 'produto_indisponivel' using detail = pr.nome; end if;
        raise exception 'quantidade_indisponivel' using detail = pr.nome || ': restam ' || restam;
      end if;
      custo := public.custo_combo(pr.id);
      insert into public.itens_pedido (estabelecimento_id, pedido_id, produto_id, nome_produto,
                                       preco_unitario_centavos, custo_unitario_centavos, quantidade)
      values (c.estabelecimento_id, pedido, pr.id, pr.nome, pr.preco_venda_centavos, custo, qtds[idx])
      returning id into item;
      insert into public.itens_pedido_combo (item_id, estabelecimento_id, produto_id, nome_produto, quantidade)
      select item, c.estabelecimento_id, q.id, q.nome, ci.quantidade
        from public.combo_itens ci join public.produtos q on q.id = ci.componente_id
       where ci.combo_id = pr.id;
    else
      if pr.limita then
        disp := pr.estoque_qtd - public.qtd_reservada(pr.id);
        if qtds[idx] > disp then
          raise exception 'quantidade_indisponivel' using detail = pr.nome || ': restam ' || greatest(disp, 0);
        end if;
      end if;
      insert into public.itens_pedido (estabelecimento_id, pedido_id, produto_id, nome_produto,
                                       preco_unitario_centavos, custo_unitario_centavos, quantidade)
      values (c.estabelecimento_id, pedido, pr.id, pr.nome, pr.preco_venda_centavos, pr.preco_custo_centavos, qtds[idx]);
    end if;
  end loop;
  return pedido;
end;
$$;

-- Entrega: item de combo baixa cada componente (quantidade do combo × quantidade pedida), tudo ou nada.
create or replace function public.entregar_itens(_itens uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  i record; pr record; cp record; novo integer; qtd integer := 0; empresa uuid; eh_combo boolean; baixa integer;
begin
  if _itens is null or coalesce(array_length(_itens, 1), 0) = 0 then raise exception 'item_nao_entregavel'; end if;

  -- trava de uma vez, na mesma ordem, todos os produtos que serão baixados (diretos e componentes de combos)
  perform 1 from public.produtos
   where id in (
     select it.produto_id from public.itens_pedido it
      where it.id = any (_itens)
        and not exists (select 1 from public.itens_pedido_combo x where x.item_id = it.id)
     union
     select ic.produto_id from public.itens_pedido_combo ic where ic.item_id = any (_itens))
   order by id for update;

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

    eh_combo := exists (select 1 from public.itens_pedido_combo x where x.item_id = i.id);
    if eh_combo then
      for cp in
        select ic.produto_id, ic.nome_produto, ic.quantidade from public.itens_pedido_combo ic
         where ic.item_id = i.id and ic.produto_id is not null order by ic.produto_id
      loop
        baixa := cp.quantidade * i.quantidade;
        select id, nome, estoque_qtd, inativar_ao_zerar_estoque into pr from public.produtos where id = cp.produto_id for update;
        if pr.estoque_qtd < baixa then
          raise exception 'estoque_insuficiente' using detail = pr.nome || ' (' || i.nome_produto || '): estoque ' || pr.estoque_qtd || ', precisa ' || baixa;
        end if;
        novo := pr.estoque_qtd - baixa;
        update public.produtos
           set estoque_qtd = novo,
               disponivel = case when novo = 0 and pr.inativar_ao_zerar_estoque then false else disponivel end
         where id = pr.id;
        insert into public.movimentos_estoque
          (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, observacao, usuario_id, pedido_item_id)
        values (i.estabelecimento_id, pr.id, pr.nome, 'baixa_entrega', -baixa, novo,
                left('Combo: ' || i.nome_produto, 200), (select auth.uid()), i.id);
      end loop;
    elsif i.produto_id is not null then
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

commit;
