-- 18 — Opções de escolha: rendimento da opção e opção que não aparece como produto avulso.
--
-- (1) Um produto que é opção de outro (ex.: a essência do narguilé) NÃO aparece mais no cardápio como produto:
--     o cliente escolhe o narguilé e então a essência. O banco também recusa o pedido avulso dela.
-- (2) Rendimento: cada unidade da opção pode render várias escolhas (ex.: 1 essência = 3 narguilés). A unidade
--     é baixada do estoque quando é ABERTA (no 1º narguilé); os próximos usos saem dela sem baixar; o 4º abre outra.
--     O campo `usos_por_unidade` fica no cadastro da própria opção (1 = baixa 1 por escolha, como antes) e
--     `usos_restantes` guarda quantos usos ainda restam na unidade aberta. As quantidades que o cardápio
--     oferece passam a ser em usos (restantes + estoque × rendimento − reservas).
-- (3) Opção não pode ser componente de combo (e componente de combo não pode ser opção).
-- Rodar depois do 17.
begin;

alter table public.produtos add column usos_por_unidade integer not null default 1;
alter table public.produtos add column usos_restantes integer not null default 0;
alter table public.produtos add constraint produtos_usos_faixa
  check (usos_por_unidade between 1 and 99 and usos_restantes between 0 and 98);

-- O app edita o rendimento; os usos restantes só mudam pela entrega.
grant insert (usos_por_unidade) on table public.produtos to authenticated;
grant update (usos_por_unidade) on table public.produtos to authenticated;

-- Mudar o rendimento nunca deixa mais usos restantes do que a unidade comporta.
create or replace function public.ajustar_usos_restantes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.usos_restantes := least(new.usos_restantes, new.usos_por_unidade - 1);
  return new;
end;
$$;
create trigger produtos_ajusta_usos before update of usos_por_unidade on public.produtos
  for each row execute function public.ajustar_usos_restantes();

-- Quantas escolhas ainda dá para atender com esta opção (em usos): unidade aberta + estoque × rendimento − reservas.
create or replace function public.opcao_usos_disponiveis(_produto uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select greatest(p.usos_restantes + p.estoque_qtd::bigint * p.usos_por_unidade - public.qtd_reservada(p.id), 0)::integer
    from public.produtos p where p.id = _produto
$$;
revoke all on function public.opcao_usos_disponiveis(uuid) from public, anon, authenticated;

create or replace function public.definir_combo(_produto uuid, _itens jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  p record; ids uuid[]; qtds integer[]; i integer; comp record;
begin
  if (select auth.uid()) is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select id, estabelecimento_id, estoque_qtd, tem_opcoes into p from public.produtos where id = _produto for update;
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
  if p.tem_opcoes then raise exception 'produto_com_opcoes'; end if;   -- ou é combo, ou tem opções
  if exists (select 1 from public.produto_opcoes where opcao_id = _produto) then raise exception 'produto_em_opcao'; end if;
  if exists (select 1 from public.combo_itens where componente_id = _produto) then
    raise exception 'produto_em_combo';   -- já é componente de outro combo
  end if;
  if p.estoque_qtd <> 0 then raise exception 'combo_com_estoque'; end if;   -- combo não tem estoque próprio

  -- componentes: mesma empresa, produtos comuns (não combo); trava na mesma ordem
  for comp in select id, estabelecimento_id, eh_combo, tem_opcoes from public.produtos where id = any (ids) order by id for share loop
    if comp.estabelecimento_id <> p.estabelecimento_id or comp.eh_combo or comp.tem_opcoes
       or exists (select 1 from public.produto_opcoes po where po.opcao_id = comp.id) then
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

create or replace function public.definir_opcoes(_produto uuid, _opcoes uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  p record; ids uuid[]; op record;
begin
  if (select auth.uid()) is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select id, estabelecimento_id, estoque_qtd, eh_combo into p from public.produtos where id = _produto for update;
  if not found then raise exception 'produto_nao_encontrado'; end if;
  if not public.tem_acesso_estabelecimento(p.estabelecimento_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if _opcoes is null or coalesce(array_length(_opcoes, 1), 0) = 0 then
    delete from public.produto_opcoes where produto_id = _produto;
    update public.produtos set tem_opcoes = false where id = _produto;
    return;
  end if;

  ids := array(select distinct u from unnest(_opcoes) u);
  if array_length(_opcoes, 1) > 30 or exists (select 1 from unnest(_opcoes) u where u is null)
     or array_length(ids, 1) <> array_length(_opcoes, 1) or _produto = any (ids) then
    raise exception 'opcoes_invalidas';
  end if;
  if p.eh_combo then raise exception 'produto_combo_com_opcoes'; end if;
  if exists (select 1 from public.combo_itens where componente_id = _produto) then raise exception 'produto_em_combo'; end if;
  if exists (select 1 from public.produto_opcoes where opcao_id = _produto) then raise exception 'produto_em_opcao'; end if;
  if p.estoque_qtd <> 0 then raise exception 'opcoes_com_estoque'; end if;   -- sem estoque próprio

  for op in select id, estabelecimento_id, eh_combo, tem_opcoes from public.produtos where id = any (ids) order by id for share loop
    if op.estabelecimento_id <> p.estabelecimento_id or op.eh_combo or op.tem_opcoes
       or exists (select 1 from public.combo_itens ci where ci.componente_id = op.id) then
      raise exception 'opcao_nao_permitida';
    end if;
  end loop;
  if (select count(*) from public.produtos where id = any (ids)) <> array_length(ids, 1) then
    raise exception 'opcao_nao_permitida';
  end if;

  delete from public.produto_opcoes where produto_id = _produto;
  insert into public.produto_opcoes (produto_id, opcao_id, estabelecimento_id)
  select _produto, u, p.estabelecimento_id from unnest(ids) u;
  update public.produtos set tem_opcoes = true where id = _produto;
end;
$$;

create or replace function public.opcoes_disponiveis(_produto uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'nome', q.nome,
           'qtd_disponivel', case when q.inativar_ao_zerar_estoque
                                  then public.opcao_usos_disponiveis(q.id) else null end)
         order by q.nome), '[]'::jsonb)
    from public.produto_opcoes po
    join public.produtos q on q.id = po.opcao_id
    join public.categorias cat on cat.id = q.categoria_id
   where po.produto_id = _produto and q.disponivel and cat.ativa
     and (not q.inativar_ao_zerar_estoque or public.opcao_usos_disponiveis(q.id) > 0)
$$;

create or replace function public.opcoes_qtd(_produto uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select case when count(*) = 0 then 0
              when bool_or(not q.inativar_ao_zerar_estoque) then null
              else least(sum(public.opcao_usos_disponiveis(q.id)), 99999)::integer end
    from public.produto_opcoes po
    join public.produtos q on q.id = po.opcao_id
    join public.categorias cat on cat.id = q.categoria_id
   where po.produto_id = _produto and q.disponivel and cat.ativa
     and (not q.inativar_ao_zerar_estoque or public.opcao_usos_disponiveis(q.id) > 0)
$$;

-- Cardápio: opção não aparece como produto avulso.
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
            'esgotado', case when p.tem_opcoes then jsonb_array_length(public.opcoes_disponiveis(p.id)) = 0
                             when p.eh_combo
                             then coalesce(public.combo_disponivel(p.id), 1) <= 0
                             else (p.inativar_ao_zerar_estoque and p.estoque_qtd - public.qtd_reservada(p.id) <= 0) end,
            'qtd_disponivel', case when p.tem_opcoes then public.opcoes_qtd(p.id)
                                   when p.eh_combo then public.combo_disponivel(p.id)
                                   when p.inativar_ao_zerar_estoque
                                   then greatest(p.estoque_qtd - public.qtd_reservada(p.id), 0) else null end,
            'inclui', case when p.eh_combo then coalesce((
                select jsonb_agg(jsonb_build_object('nome', q.nome, 'quantidade', ci.quantidade) order by q.nome)
                  from public.combo_itens ci join public.produtos q on q.id = ci.componente_id
                 where ci.combo_id = p.id), '[]'::jsonb) else null end,
            'opcoes', case when p.tem_opcoes then public.opcoes_disponiveis(p.id) else null end
          ) order by p.nome)
          from public.produtos p
         where p.categoria_id = c.id and p.estabelecimento_id = e.id and p.disponivel
           and not exists (select 1 from public.produto_opcoes po where po.opcao_id = p.id)), '[]'::jsonb)
      ) order by c.nome)
      from public.categorias c
     where c.estabelecimento_id = e.id and c.ativa
       and exists (select 1 from public.produtos q where q.categoria_id = c.id and q.estabelecimento_id = e.id and q.disponivel
                   and not exists (select 1 from public.produto_opcoes po where po.opcao_id = q.id))
      ), '[]'::jsonb) end
  );
end;
$$;

create or replace function public.enviar_pedido(_token text, _itens jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  c record; s record; pr record; cp record;
  ids uuid[]; oids uuid[]; qtds integer[]; op record; idx integer; pedido uuid; disp integer; n integer; item uuid; restam integer;
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
    select array_agg(x.pid order by x.pid, x.oid), array_agg(x.oid order by x.pid, x.oid), array_agg(x.q order by x.pid, x.oid)
      into ids, oids, qtds
      from (select (e ->> 'produto_id')::uuid as pid, nullif(e ->> 'opcao_id', '')::uuid as oid,
                   sum((e ->> 'quantidade')::integer)::integer as q
              from jsonb_array_elements(_itens) e group by 1, 2) x;
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
      and (id = any (ids)
           or id in (select ci.componente_id from public.combo_itens ci where ci.combo_id = any (ids))
           or id in (select po.opcao_id from public.produto_opcoes po where po.produto_id = any (ids)))
    order by id for update;

  insert into public.pedidos (estabelecimento_id, sessao_id, comanda_id, mesa_id, expira_em)
  values (c.estabelecimento_id, c.sessao_id, c.id, c.mesa_id, clock_timestamp() + public.validade_pedido_pendente())
  returning id into pedido;

  for idx in 1 .. array_length(ids, 1) loop
    select p.id, p.nome, p.preco_venda_centavos, p.preco_custo_centavos, p.estoque_qtd, p.eh_combo, p.tem_opcoes,
           p.inativar_ao_zerar_estoque as limita, p.disponivel, cat.ativa as cat_ativa
      into pr
      from public.produtos p join public.categorias cat on cat.id = p.categoria_id
     where p.id = ids[idx] and p.estabelecimento_id = c.estabelecimento_id;
    if not found or not pr.disponivel or not pr.cat_ativa then
      raise exception 'produto_indisponivel' using detail = coalesce(pr.nome, ids[idx]::text);
    end if;

    if oids[idx] is not null and not pr.tem_opcoes then raise exception 'itens_invalidos'; end if;
    -- um produto que é opção de outro só é pedido pela escolha dentro desse produto
    if exists (select 1 from public.produto_opcoes po where po.opcao_id = pr.id) then
      raise exception 'produto_indisponivel' using detail = pr.nome;
    end if;

    if pr.tem_opcoes then
      -- produto com opções: cada linha leva exatamente 1 opção; a opção é reservada e baixada na entrega
      if oids[idx] is null then raise exception 'opcao_obrigatoria' using detail = pr.nome; end if;
      select q.id, q.nome, q.estoque_qtd, q.preco_custo_centavos, q.inativar_ao_zerar_estoque as limita,
             q.disponivel, cat2.ativa as cat_ativa
        into op
        from public.produto_opcoes po
        join public.produtos q on q.id = po.opcao_id
        join public.categorias cat2 on cat2.id = q.categoria_id
       where po.produto_id = pr.id and po.opcao_id = oids[idx];
      if not found then raise exception 'opcao_invalida' using detail = pr.nome; end if;
      if not op.disponivel or not op.cat_ativa then
        raise exception 'opcao_indisponivel' using detail = pr.nome || ' (' || op.nome || ')';
      end if;
      if op.limita then
        disp := public.opcao_usos_disponiveis(op.id);
        if qtds[idx] > disp then
          raise exception 'quantidade_indisponivel' using detail = pr.nome || ' (' || op.nome || '): restam ' || greatest(disp, 0);
        end if;
      end if;
      custo := case when pr.preco_custo_centavos is null or op.preco_custo_centavos is null then null
                    else pr.preco_custo_centavos + op.preco_custo_centavos end;
      insert into public.itens_pedido (estabelecimento_id, pedido_id, produto_id, nome_produto,
                                       preco_unitario_centavos, custo_unitario_centavos, quantidade)
      values (c.estabelecimento_id, pedido, pr.id, pr.nome || ' (' || op.nome || ')', pr.preco_venda_centavos, custo, qtds[idx])
      returning id into item;
      insert into public.itens_pedido_combo (item_id, estabelecimento_id, produto_id, nome_produto, quantidade, escolha)
      values (item, c.estabelecimento_id, op.id, op.nome, 1, true);
    elsif pr.eh_combo then
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

-- Entrega: a opção escolhida baixa conforme o rendimento.
create or replace function public.entregar_itens(_itens uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  i record; pr record; cp record; novo integer; qtd integer := 0; empresa uuid; eh_combo boolean; baixa integer; pacotes integer; resto integer;
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
        select ic.produto_id, ic.nome_produto, ic.quantidade, ic.escolha from public.itens_pedido_combo ic
         where ic.item_id = i.id and ic.produto_id is not null order by ic.produto_id
      loop
        baixa := cp.quantidade * i.quantidade;
        select id, nome, estoque_qtd, inativar_ao_zerar_estoque, usos_por_unidade, usos_restantes
          into pr from public.produtos where id = cp.produto_id for update;
        if cp.escolha then
          -- opção de um produto: cada unidade de estoque rende `usos_por_unidade` escolhas. A unidade é baixada
          -- quando é aberta (no 1º uso); os usos seguintes saem da unidade já aberta (`usos_restantes`).
          if pr.usos_restantes >= baixa then
            update public.produtos
               set usos_restantes = pr.usos_restantes - baixa,
                   disponivel = case when pr.estoque_qtd = 0 and pr.usos_restantes - baixa = 0 and pr.inativar_ao_zerar_estoque
                                     then false else disponivel end
             where id = pr.id;
            continue;
          end if;
          pacotes := ceil((baixa - pr.usos_restantes)::numeric / pr.usos_por_unidade)::integer;
          resto := pr.usos_restantes + pacotes * pr.usos_por_unidade - baixa;
          if pr.estoque_qtd < pacotes then
            raise exception 'estoque_insuficiente' using detail = pr.nome || ' (' || i.nome_produto || '): estoque ' || pr.estoque_qtd || ', precisa ' || pacotes;
          end if;
          novo := pr.estoque_qtd - pacotes;
          update public.produtos
             set estoque_qtd = novo, usos_restantes = resto,
                 disponivel = case when novo = 0 and resto = 0 and pr.inativar_ao_zerar_estoque then false else disponivel end
           where id = pr.id;
          insert into public.movimentos_estoque
            (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, observacao, usuario_id, pedido_item_id)
          values (i.estabelecimento_id, pr.id, pr.nome, 'baixa_entrega', -pacotes, novo,
                  left('Escolha: ' || i.nome_produto
                       || case when pr.usos_por_unidade > 1 then ' (rende ' || pr.usos_por_unidade || ')' else '' end, 200),
                  (select auth.uid()), i.id);
          continue;
        end if;
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
                left(case when cp.escolha then 'Escolha: ' else 'Combo: ' end || i.nome_produto, 200), (select auth.uid()), i.id);
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
