-- Fluxo do cliente (anônimo): cardápio, identificação, pedido com reserva, limites e cancelamento.
-- Também cria os dados usados pelo teste seguinte (16).
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  E2 uuid := '20000000-0000-4000-8000-000000000002';
  CAT uuid := '41000000-0000-4000-8000-000000000001';
  CAT2 uuid := '41000000-0000-4000-8000-000000000002';
  PA uuid := '31000000-0000-4000-8000-000000000001';  -- limita por estoque (interruptor ligado)
  PB uuid := '31000000-0000-4000-8000-000000000002';  -- não limita (interruptor desligado), sem estoque
  PC uuid := '31000000-0000-4000-8000-000000000003';  -- indisponível
  PX uuid := '31000000-0000-4000-8000-000000000004';  -- de outra empresa
  r jsonb; tokA text; tokB text; ped1 uuid; ped2 uuid; n int; ids uuid[];
begin
  -- dados: duas categorias e produtos (como administrador da E1) + um produto da E2 (como dono)
  perform t.como(A);
  insert into public.categorias (id, estabelecimento_id, nome) values (CAT, E1, 'Bebidas');
  insert into public.categorias (id, estabelecimento_id, nome, ativa) values (CAT2, E1, 'Inativa', false);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos, inativar_ao_zerar_estoque)
    values (PA, E1, CAT, 'Cerveja', 1000, 600, true), (PB, E1, CAT, 'Refri', 500, 200, false);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, disponivel)
    values (PC, E1, CAT, 'Fora de linha', 300, false);
  perform public.ajustar_estoque(PA, 'saldo_inicial', 10);
  perform t.dono();
  insert into public.categorias (id, estabelecimento_id, nome) values ('41000000-0000-4000-8000-000000000009', E2, 'Outra empresa');
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos)
    values (PX, E2, '41000000-0000-4000-8000-000000000009', 'Produto alheio', 100);
  insert into public.mesas (estabelecimento_id, numero) values (E1, 3), (E1, 4), (E1, 5), (E1, 6), (E1, 7);

  -- ---------- cardápio público
  perform t.anonimo();
  r := public.obter_cardapio_publico('LOJA_UM', 2);
  perform t.igual(r #>> '{empresa,nome}', 'Loja Um Renomeada', 'cardápio traz a empresa');
  perform t.igual((r #>> '{mesa,ativa}')::boolean, true, 'mesa ativa');
  perform t.igual(jsonb_array_length(r -> 'categorias'), 1, 'só categorias ativas');
  perform t.igual(jsonb_array_length(r #> '{categorias,0,produtos}'), 2, 'produto indisponível não aparece');
  perform t.igual(position('custo' in r::text), 0, 'o custo nunca é exposto');
  perform t.igual(position('estoque_qtd' in r::text), 0, 'o estoque físico não é exposto');
  perform t.igual((select (p ->> 'qtd_disponivel')::int from jsonb_array_elements(r #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Cerveja'), 10, 'disponível com interruptor ligado');
  perform t.igual((select p ->> 'qtd_disponivel' from jsonb_array_elements(r #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Refri'), null, 'sem limite com interruptor desligado');
  perform t.igual(public.obter_cardapio_publico('loja_um', 99) is null, true, 'mesa inexistente');
  perform t.igual(public.obter_cardapio_publico('loja_tres', 1) is null, true, 'empresa inativa');
  perform t.igual(public.obter_cardapio_publico('nao_existe', 1) is null, true, 'empresa inexistente');
  perform t.igual(jsonb_array_length(public.obter_cardapio_publico('loja_um', 1) -> 'categorias'), 0, 'mesa desativada: sem cardápio');

  -- ---------- identificação
  perform t.erro($q$select public.identificar_cliente('loja_um', 2, '   ')$q$, 'nome_invalido');
  perform t.erro(format('select public.identificar_cliente(%L, 2, %L)', 'loja_um', repeat('x', 41)), 'nome_invalido');
  perform t.erro($q$select public.identificar_cliente('loja_um', 1, 'Ana')$q$, 'mesa_indisponivel');
  perform t.erro($q$select public.identificar_cliente('loja_um', 99, 'Ana')$q$, 'mesa_indisponivel');
  perform t.erro($q$select public.identificar_cliente('loja_tres', 1, 'Ana')$q$, 'empresa_indisponivel');
  perform t.erro($q$select public.identificar_cliente('nao_existe', 1, 'Ana')$q$, 'empresa_indisponivel');
  r := public.identificar_cliente('loja_um', 2, ' Ana ');
  tokA := r ->> 'token';
  perform t.igual(char_length(tokA), 64, 'código secreto longo');
  r := public.identificar_cliente('loja_um', 2, 'Bia');
  tokB := r ->> 'token';
  perform t.dono();
  perform t.igual((select count(*) from public.sessoes_mesa where status = 'aberta')::int, 1, 'uma sessão para a mesa');
  perform t.igual((select count(*) from public.comandas where mesa_numero = 2)::int, 2, 'duas comandas na mesma sessão');
  perform t.igual((select cliente_nome from public.comandas where token_hash = public.hash_token(tokA)), 'Ana', 'nome limpo');
  perform t.igual((select count(*) from public.comandas where encode(token_hash, 'escape') = tokA)::int, 0, 'o código não é guardado em claro');

  -- ---------- pedido: reserva sem baixar estoque
  perform t.anonimo();
  ped1 := public.enviar_pedido(tokA, jsonb_build_array(
    jsonb_build_object('produto_id', PA, 'quantidade', 2), jsonb_build_object('produto_id', PB, 'quantidade', 2),
    jsonb_build_object('produto_id', PA, 'quantidade', 1)));  -- repetido: soma 3
  perform t.dono();
  perform t.igual((select status::text from public.pedidos where id = ped1), 'pendente', 'nasce pendente');
  perform t.igual((select count(*) from public.itens_pedido where pedido_id = ped1)::int, 2, 'itens repetidos somados');
  perform t.igual((select quantidade from public.itens_pedido where pedido_id = ped1 and produto_id = PA), 3, 'quantidade somada');
  perform t.igual((select preco_unitario_centavos from public.itens_pedido where pedido_id = ped1 and produto_id = PA), 1000, 'preço congelado');
  perform t.igual((select custo_unitario_centavos from public.itens_pedido where pedido_id = ped1 and produto_id = PA), 600, 'custo congelado');
  perform t.igual((select subtotal_centavos from public.itens_pedido where pedido_id = ped1 and produto_id = PA), 3000::bigint, 'subtotal');
  perform t.igual((select expira_em between now() + interval '44 minutes' and now() + interval '46 minutes' from public.pedidos where id = ped1), true, 'expira em 45 min');
  perform t.igual((select estoque_qtd from public.produtos where id = PA), 10, 'estoque físico NÃO baixou');
  perform t.igual(public.qtd_reservada(PA), 3, 'reservou 3');
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 2);
  perform t.igual((select (p ->> 'qtd_disponivel')::int from jsonb_array_elements(r #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Cerveja'), 7, 'disponível caiu para 7');

  -- ---------- interruptor LIGADO limita ao disponível; DESLIGADO não
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokB, jsonb_build_array(jsonb_build_object('produto_id', PA, 'quantidade', 8))), 'quantidade_indisponivel');
  ped2 := public.enviar_pedido(tokB, jsonb_build_array(jsonb_build_object('produto_id', PA, 'quantidade', 7)));
  r := public.obter_cardapio_publico('loja_um', 2);
  perform t.igual((select (p ->> 'esgotado')::boolean from jsonb_array_elements(r #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Cerveja'), true, 'esgotado quando tudo reservado');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PA, 'quantidade', 1))), 'quantidade_indisponivel');
  perform public.enviar_pedido(tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 99)));  -- sem estoque, mas desligado: pode
  perform t.igual((select (p ->> 'esgotado')::boolean from jsonb_array_elements(public.obter_cardapio_publico('loja_um', 2) #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Refri'), false, 'desligado nunca fica esgotado');

  -- ---------- cancelar libera a reserva; só o dono do pedido cancela
  perform t.erro(format('select public.cancelar_meu_pedido(%L, %L)', tokA, ped2), 'pedido_nao_encontrado');
  perform public.cancelar_meu_pedido(tokB, ped2);
  perform t.erro(format('select public.cancelar_meu_pedido(%L, %L)', tokB, ped2), 'pedido_nao_pendente');
  perform t.dono();
  perform t.igual(public.qtd_reservada(PA), 3, 'reserva do cancelado liberada');
  perform t.anonimo();

  -- ---------- validações do pedido (e nada é gravado em caso de erro)
  perform t.dono(); select count(*) into n from public.pedidos; perform t.anonimo();
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, '[]'), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, '{"a":1}'), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, null)', tokA), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 0))), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 100))), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, '[{"produto_id":"lixo","quantidade":1}]'), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, '[{"quantidade":1}]'), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, '[{"produto_id":"31000000-0000-4000-8000-000000000002","quantidade":"x"}]'), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, (select jsonb_agg(jsonb_build_object('produto_id', gen_random_uuid(), 'quantidade', 1)) from generate_series(1, 31))), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PC, 'quantidade', 1))), 'produto_indisponivel');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PX, 'quantidade', 1))), 'produto_indisponivel');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', gen_random_uuid(), 'quantidade', 1))), 'produto_indisponivel');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', 'codigo-falso', jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1))), 'comanda_invalida');
  -- uma linha boa + uma ruim: o pedido inteiro é recusado e nada fica gravado
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1), jsonb_build_object('produto_id', PC, 'quantidade', 1))), 'produto_indisponivel');
  perform t.dono(); perform t.igual((select count(*) from public.pedidos)::int, n, 'nenhum pedido parcial foi gravado'); perform t.anonimo();

  -- ---------- limite de pedidos pendentes por comanda (5)
  perform t.dono(); select count(*) into n from public.pedidos where comanda_id = (select id from public.comandas where token_hash = public.hash_token(tokA)) and status = 'pendente'; perform t.anonimo();
  for i in 1 .. 5 - n loop
    perform public.enviar_pedido(tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1)));
  end loop;
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokA, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1))), 'muitos_pedidos_pendentes');

  -- ---------- a comanda mostra só o que é do cliente
  r := public.minha_comanda(tokB);
  perform t.igual(r #>> '{comanda,cliente_nome}', 'Bia', 'Bia vê a própria comanda');
  perform t.igual(jsonb_array_length(r -> 'pedidos'), 1, 'Bia vê só o pedido dela (o cancelado)');
  perform t.igual(r #>> '{pedidos,0,status}', 'cancelado', 'status do pedido cancelado');
  perform t.igual((r ->> 'devido_centavos')::int, 0, 'nada confirmado: nada devido');
  perform t.igual(public.minha_comanda('codigo-falso') is null, true, 'código inválido não devolve nada');
  r := public.minha_comanda(tokA);
  perform t.igual(r #>> '{pedidos,0,expirado}', 'false', 'pedido recente não expirou');
  perform t.igual(position('token' in r::text), 0, 'o código nunca volta na comanda');

  -- guarda os códigos para o próximo teste
  perform t.dono();
  create table t.ctx (chave text primary key, valor text);
  insert into t.ctx values ('tokA', tokA), ('tokB', tokB), ('ped1', ped1::text);
  grant select on t.ctx to public;
end $$;
