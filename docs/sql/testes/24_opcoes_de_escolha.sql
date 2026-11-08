-- Produto com opções de escolha (script 17): regras de cadastro, cardápio, reserva, entrega e histórico.
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002'; B uuid := '10000000-0000-4000-8000-000000000003';
  E1 uuid := '20000000-0000-4000-8000-000000000001'; E2 uuid := '20000000-0000-4000-8000-000000000002';
  CAT uuid := '41000000-0000-4000-8000-000000000001'; CAT2 uuid := '41000000-0000-4000-8000-0000000000f2';
  NG uuid := '52000000-0000-4000-8000-000000000001';  -- Narguilé
  ME uuid := '52000000-0000-4000-8000-000000000002';  -- Menta (limita, custo 400)
  UV uuid := '52000000-0000-4000-8000-000000000003';  -- Uva (limita, sem custo)
  MA uuid := '52000000-0000-4000-8000-000000000004';  -- Maçã (não limita)
  CB uuid := '52000000-0000-4000-8000-000000000005';  -- um combo
  OUT uuid := '52000000-0000-4000-8000-000000000006'; -- produto da E2
  NG2 uuid := '52000000-0000-4000-8000-000000000007'; -- outro com opções
  CP uuid := '52000000-0000-4000-8000-000000000008';  -- componente de combo
  tok text; r jsonb; x jsonb; p1 uuid; p2 uuid; it uuid; n int;
begin
  perform t.dono();
  insert into public.categorias (id, estabelecimento_id, nome) values (CAT2, E2, 'Categoria opções E2');
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos) values (OUT, E2, CAT2, 'Alheio 2', 100, 50);
  perform t.como(A);
  insert into public.mesas (estabelecimento_id, numero) values (E1, 40);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos, inativar_ao_zerar_estoque) values
    (NG, E1, CAT, 'Narguilé', 6000, 1000, false), (ME, E1, CAT, 'Essência Menta', 0, 400, true),
    (UV, E1, CAT, 'Essência Uva', 0, null, true), (MA, E1, CAT, 'Essência Maçã', 0, 300, false),
    (CB, E1, CAT, 'Combo de teste opções', 1000, null, false), (NG2, E1, CAT, 'Narguilé 2', 5000, null, false),
    (CP, E1, CAT, 'Componente de combo', 100, null, false);
  perform public.ajustar_estoque(ME, 'saldo_inicial', 3);
  perform public.ajustar_estoque(UV, 'saldo_inicial', 1);
  perform public.ajustar_estoque(MA, 'saldo_inicial', 1);

  -- ===== cadastro
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[NG]), 'opcoes_invalidas');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[ME, ME]), 'opcoes_invalidas');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[OUT]), 'opcao_nao_permitida');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', ME, array[UV]), 'opcoes_com_estoque');
  perform public.definir_combo(CB, jsonb_build_array(jsonb_build_object('produto_id', CP, 'quantidade', 1)));
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[CB]), 'opcao_nao_permitida');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', CB, array[ME]), 'produto_combo_com_opcoes');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', CP, array[ME]), 'produto_em_combo');
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[CP]), 'opcao_nao_permitida');   -- componente de combo não vira opção
  perform public.definir_opcoes(NG, array[ME, UV, MA]);
  perform public.definir_opcoes(NG2, array[ME]);   -- uma opção pode servir a mais de um produto
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[NG2]), 'opcao_nao_permitida');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', ME, jsonb_build_array(jsonb_build_object('produto_id', MA, 'quantidade', 1))), 'produto_em_opcao');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', NG, jsonb_build_array(jsonb_build_object('produto_id', MA, 'quantidade', 1))), 'produto_com_opcoes');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', CB, jsonb_build_array(jsonb_build_object('produto_id', NG, 'quantidade', 1))), 'componente_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', CB, jsonb_build_array(jsonb_build_object('produto_id', ME, 'quantidade', 1))), 'componente_invalido');   -- opção não vira componente
  perform t.erro(format('select public.ajustar_estoque(%L, ''reposicao'', 1, null)', NG), 'produto_com_opcoes');
  begin
    delete from public.produtos where id = ME;
    raise exception 'deveria impedir apagar uma opção';
  exception when foreign_key_violation then null; end;
  perform t.como(B);
  perform t.erro(format('select public.definir_opcoes(%L, %L::uuid[])', NG, array[ME]), 'sem_permissao');
  perform t.dono();
  perform t.igual((select tem_opcoes from public.produtos where id = NG), true, 'narguilé tem opções');
  perform t.igual((select count(*) from public.produto_opcoes where produto_id = NG)::int, 3, 'três opções');

  -- ===== cardápio
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 40);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Narguilé';
  perform t.igual(jsonb_array_length(x -> 'opcoes'), 3, 'cardápio lista as 3 opções');
  perform t.igual((x ->> 'esgotado')::boolean, false, 'tem opção disponível');
  perform t.igual(x -> 'qtd_disponivel', 'null'::jsonb, 'uma opção sem limite: sem limite no total');
  perform t.igual((select count(*) from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' like 'Essência%')::int, 0, 'a opção não aparece como produto avulso');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', public.identificar_cliente('loja_um', 40, 'Avulso') ->> 'token', jsonb_build_array(jsonb_build_object('produto_id', ME, 'quantidade', 1))), 'produto_indisponivel');

  -- ===== pedido
  tok := public.identificar_cliente('loja_um', 40, 'Cliente Opções') ->> 'token';
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'quantidade', 1))), 'opcao_obrigatoria');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'opcao_id', OUT, 'quantidade', 1))), 'opcao_invalida');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG2, 'opcao_id', UV, 'quantidade', 1))), 'opcao_invalida');   -- Uva não é opção do Narguilé 2
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', ME, 'opcao_id', UV, 'quantidade', 1))), 'itens_invalidos');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'opcao_id', ME, 'quantidade', 4))), 'quantidade_indisponivel');
  -- duas linhas da mesma opção somam no limite
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(
    jsonb_build_object('produto_id', NG, 'opcao_id', ME, 'quantidade', 2), jsonb_build_object('produto_id', NG2, 'opcao_id', ME, 'quantidade', 2))), 'quantidade_indisponivel');
  perform t.dono();
  perform t.igual((select count(*) from public.pedidos where status = 'pendente' and comanda_id = (select id from public.comandas where token_hash = public.hash_token(tok)))::int, 0, 'recusado não deixa rastro');

  perform t.anonimo();
  p1 := public.enviar_pedido(tok, jsonb_build_array(
    jsonb_build_object('produto_id', NG, 'opcao_id', ME, 'quantidade', 2),
    jsonb_build_object('produto_id', NG, 'opcao_id', UV, 'quantidade', 1)));
  perform t.dono();
  perform t.igual((select count(*) from public.itens_pedido where pedido_id = p1)::int, 2, 'uma linha por opção escolhida');
  perform t.igual((select quantidade from public.itens_pedido where pedido_id = p1 and nome_produto = 'Narguilé (Essência Menta)'), 2, 'nome do item traz a opção');
  perform t.igual((select preco_unitario_centavos from public.itens_pedido where pedido_id = p1 and nome_produto = 'Narguilé (Essência Menta)'), 6000, 'preço é o do narguilé');
  perform t.igual((select custo_unitario_centavos from public.itens_pedido where pedido_id = p1 and nome_produto = 'Narguilé (Essência Menta)'), 1400, 'custo = narguilé + opção');
  perform t.igual((select custo_unitario_centavos from public.itens_pedido where pedido_id = p1 and nome_produto = 'Narguilé (Essência Uva)'), null, 'opção sem custo: custo desconhecido');
  perform t.igual(public.qtd_reservada(ME), 2, 'reserva 2 mentas');
  perform t.igual(public.qtd_reservada(UV), 1, 'reserva 1 uva');
  perform t.igual(public.qtd_reservada(NG), 0, 'o narguilé em si não reserva estoque');
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 40);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Narguilé';
  perform t.igual(jsonb_array_length(x -> 'opcoes'), 2, 'uva esgotada some das opções');
  perform t.igual((select (o ->> 'qtd_disponivel')::int from jsonb_array_elements(x -> 'opcoes') o where o ->> 'nome' = 'Essência Menta'), 1, 'menta: sobra 1');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'opcao_id', UV, 'quantidade', 1))), 'quantidade_indisponivel');

  -- ===== entrega baixa a opção, não o produto principal
  perform t.como(A);
  perform public.confirmar_pedido(p1);
  perform public.entregar_pedido(p1);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = ME), 1, 'menta: 3 − 2');
  perform t.igual((select estoque_qtd from public.produtos where id = UV), 0, 'uva zerou');
  perform t.igual((select disponivel from public.produtos where id = UV), false, 'uva inativada ao zerar');
  perform t.igual((select estoque_qtd from public.produtos where id = NG), 0, 'narguilé sem estoque próprio');
  select i.id into it from public.itens_pedido i where i.pedido_id = p1 and i.nome_produto = 'Narguilé (Essência Menta)';
  perform t.igual((select variacao from public.movimentos_estoque where pedido_item_id = it), -2, 'movimento da menta');
  perform t.igual((select observacao from public.movimentos_estoque where pedido_item_id = it), 'Escolha: Narguilé (Essência Menta)', 'movimento diz de onde veio');
  perform t.igual(public.qtd_reservada(ME), 0, 'sem reserva depois de entregue');

  -- ===== mudar as opções depois não altera pedido já feito
  perform t.anonimo();
  p2 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'opcao_id', ME, 'quantidade', 1)));
  perform t.como(A);
  perform public.confirmar_pedido(p2);
  perform public.definir_opcoes(NG, array[MA]);
  perform t.dono();
  perform t.igual(public.qtd_reservada(ME), 1, 'pedido antigo continua reservando a menta');
  perform t.como(A);
  perform public.entregar_pedido(p2);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = ME), 0, 'entrega baixou a menta do pedido');
  perform t.anonimo();
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NG, 'opcao_id', ME, 'quantidade', 1))), 'opcao_invalida');

  -- ===== desmarcar
  perform t.como(A);
  perform public.definir_opcoes(NG, null);
  perform t.dono();
  perform t.igual((select tem_opcoes from public.produtos where id = NG), false, 'desmarcado');
  perform t.igual((select count(*) from public.produto_opcoes where produto_id = NG)::int, 0, 'sem opções');
  perform t.dono();
end $$;
