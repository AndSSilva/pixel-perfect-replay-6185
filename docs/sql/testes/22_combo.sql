-- Combo: vínculo, disponibilidade vinda dos componentes, reserva, composição guardada no pedido, baixa na entrega.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003';
  E1 uuid := '20000000-0000-4000-8000-000000000001'; E2 uuid := '20000000-0000-4000-8000-000000000002';
  CAT uuid := '41000000-0000-4000-8000-000000000001'; CAT2 uuid := '41000000-0000-4000-8000-0000000000e2';
  CH uuid := '51000000-0000-4000-8000-000000000001';  -- Chope (limita estoque)
  PT uuid := '51000000-0000-4000-8000-000000000002';  -- Petisco (limita, sem custo)
  BA uuid := '51000000-0000-4000-8000-000000000003';  -- Balde = 5 × Chope
  C2 uuid := '51000000-0000-4000-8000-000000000004';  -- Combo misto (Chope + Petisco)
  RF uuid := '51000000-0000-4000-8000-000000000005';  -- Refri (não limita)
  C3 uuid := '51000000-0000-4000-8000-000000000006';  -- Combo de 3 refris
  OUT uuid := '51000000-0000-4000-8000-000000000007'; -- produto da E2
  tok text; r jsonb; x jsonb; p1 uuid; p3 uuid; p4 uuid; it uuid; n int;
begin
  perform t.dono();
  insert into public.categorias (id, estabelecimento_id, nome) values (CAT2, E2, 'Categoria combo E2');
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos) values (OUT, E2, CAT2, 'Alheio', 100, 50);
  perform t.como(A);
  insert into public.mesas (estabelecimento_id, numero) values (E1, 20);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos, inativar_ao_zerar_estoque) values
    (CH, E1, CAT, 'Chope', 1000, 600, true), (PT, E1, CAT, 'Petisco', 800, null, true),
    (BA, E1, CAT, 'Balde de chope', 4500, null, false), (C2, E1, CAT, 'Combo misto', 2500, null, false),
    (RF, E1, CAT, 'Refri x', 500, 200, false), (C3, E1, CAT, 'Trio de refri', 1200, null, false);
  perform public.ajustar_estoque(CH, 'saldo_inicial', 12);
  perform public.ajustar_estoque(PT, 'saldo_inicial', 3);
  perform public.ajustar_estoque(RF, 'saldo_inicial', 1);

  -- ========== definir combo
  perform public.definir_combo(BA, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 5)));
  perform t.dono();
  perform t.igual((select eh_combo from public.produtos where id = BA), true, 'balde é combo');
  perform t.igual((select count(*) from public.combo_itens where combo_id = BA)::int, 1, 'um componente');
  perform t.igual(public.custo_combo(BA), 3000, 'custo = 5 × 6,00');
  perform t.como(A);
  perform public.definir_combo(C2, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 1), jsonb_build_object('produto_id', PT, 'quantidade', 2)));
  perform t.dono();
  perform t.igual(public.custo_combo(C2), null, 'componente sem custo: custo do combo desconhecido');
  perform t.como(A);
  perform public.definir_combo(C3, jsonb_build_array(jsonb_build_object('produto_id', RF, 'quantidade', 3)));

  -- validações e permissões
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', BA, 'quantidade', 1))), 'combo_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 0))), 'combo_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 1), jsonb_build_object('produto_id', CH, 'quantidade', 2))), 'combo_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, '{"a":1}'), 'combo_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', OUT, 'quantidade', 1))), 'componente_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', C3, 'quantidade', 1))), 'componente_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, jsonb_build_array(jsonb_build_object('produto_id', gen_random_uuid(), 'quantidade', 1))), 'componente_invalido');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', CH, jsonb_build_array(jsonb_build_object('produto_id', PT, 'quantidade', 1))), 'produto_em_combo');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', PT, jsonb_build_array(jsonb_build_object('produto_id', RF, 'quantidade', 1))), 'produto_em_combo');
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', gen_random_uuid(), '[]'), 'produto_nao_encontrado');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', BA, 'reposicao'), 'produto_combo');
  perform t.erro(format('update public.produtos set eh_combo = true where id = %L', RF), 'permission denied');
  perform t.erro(format('insert into public.combo_itens (combo_id, componente_id, estabelecimento_id, quantidade) values (%L, %L, %L, 1)', C3, CH, E1), 'permission denied');
  perform t.erro(format('delete from public.combo_itens where combo_id = %L', BA), 'permission denied');
  perform t.erro(format('delete from public.produtos where id = %L', CH), 'violates foreign key');   -- componente não é excluído
  perform t.como(B);
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, '[]'), 'sem_permissao');
  select count(*) into n from public.combo_itens; perform t.igual(n, 0, 'B não vê combos da E1');
  perform t.anonimo();
  perform t.erro(format('select public.definir_combo(%L, %L::jsonb)', BA, '[]'), 'permission denied');
  perform t.erro('select * from public.combo_itens', 'permission denied');

  -- ========== cardápio: disponibilidade vem do componente (12 ÷ 5 = 2)
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 20);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Balde de chope';
  perform t.igual((x ->> 'qtd_disponivel')::int, 2, 'dá para 2 baldes');
  perform t.igual((x ->> 'esgotado')::boolean, false, 'balde disponível');
  perform t.igual((x #>> '{inclui,0,nome}'), 'Chope', 'mostra o que inclui');
  perform t.igual((x #>> '{inclui,0,quantidade}')::int, 5, 'quantidade do componente');
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Chope';
  perform t.igual(x -> 'inclui', 'null'::jsonb, 'produto comum não tem "inclui"');
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Trio de refri';
  perform t.igual(x -> 'qtd_disponivel', 'null'::jsonb, 'nenhum componente limita: sem limite');

  -- ========== pedido: reserva os componentes
  tok := public.identificar_cliente('loja_um', 20, 'Cliente Combo') ->> 'token';
  p1 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', BA, 'quantidade', 2)));
  perform t.dono();
  perform t.igual(public.qtd_reservada(CH), 10, '2 baldes reservam 10 chopes');
  perform t.igual((select custo_unitario_centavos from public.itens_pedido where pedido_id = p1), 3000, 'custo do combo guardado no item');
  perform t.igual((select count(*) from public.itens_pedido_combo ic join public.itens_pedido i on i.id = ic.item_id where i.pedido_id = p1)::int, 1, 'composição guardada');
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 20);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Balde de chope';
  perform t.igual((x ->> 'esgotado')::boolean, true, 'balde esgotado');
  perform t.igual((x ->> 'qtd_disponivel')::int, 0, 'sobra para 0 baldes');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', BA, 'quantidade', 1))), 'produto_indisponivel');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 3))), 'quantidade_indisponivel');
  -- pedido misto na mesma ordem: chope avulso + combo misto disputam o mesmo saldo (2 chopes livres)
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(
    jsonb_build_object('produto_id', CH, 'quantidade', 2), jsonb_build_object('produto_id', C2, 'quantidade', 1))), 'produto_indisponivel');   -- o chope avulso já usou o saldo
  perform t.dono();
  perform t.igual((select count(*) from public.pedidos where comanda_id = (select id from public.comandas where token_hash = public.hash_token(tok)) and status = 'pendente')::int, 1, 'pedido recusado não deixa rastro');

  -- ========== composição guardada: mudar o combo depois não altera pedidos feitos
  perform t.como(A);
  perform public.confirmar_pedido(p1);
  perform public.definir_combo(BA, jsonb_build_array(jsonb_build_object('produto_id', CH, 'quantidade', 6)));
  perform t.dono();
  perform t.igual(public.qtd_reservada(CH), 10, 'pedido antigo continua reservando 10');
  perform t.igual(public.custo_combo(BA), 3600, 'combo novo: 6 × 6,00');
  perform t.como(A);
  perform public.entregar_pedido(p1);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = CH), 2, 'entrega baixou 10 chopes (composição do pedido)');
  select i.id into it from public.itens_pedido i where i.pedido_id = p1;
  perform t.igual((select variacao from public.movimentos_estoque where pedido_item_id = it), -10, 'movimento por componente');
  perform t.igual((select observacao from public.movimentos_estoque where pedido_item_id = it), 'Combo: Balde de chope', 'movimento diz de qual combo veio');
  perform t.igual(public.qtd_reservada(CH), 0, 'sem reserva depois de entregue');
  perform t.igual((select estoque_qtd from public.produtos where id = BA), 0, 'o combo nunca tem estoque próprio');

  -- ========== tudo ou nada e cancelamento
  perform t.anonimo();
  p3 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', C3, 'quantidade', 1)));   -- refri não limita: dá para pedir
  perform t.como(A);
  perform public.confirmar_pedido(p3);
  perform t.erro(format('select public.entregar_pedido(%L)', p3), 'estoque_insuficiente');
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = RF), 1, 'falha: estoque do refri intacto');
  select i.id into it from public.itens_pedido i where i.pedido_id = p3;
  perform t.igual((select status::text from public.itens_pedido where id = it), 'aguardando', 'item continua aguardando');
  perform t.igual(public.qtd_reservada(RF), 3, 'trio reserva 3 refris');
  perform t.como(A);
  perform public.cancelar_item(it, 'faltou refri');
  perform t.dono();
  perform t.igual(public.qtd_reservada(RF), 0, 'cancelar o item libera a reserva');
  perform t.anonimo();
  p4 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', C3, 'quantidade', 1)));
  perform t.como(A);
  perform public.confirmar_pedido(p4);
  perform public.ajustar_estoque(RF, 'reposicao', 5);
  perform public.entregar_pedido(p4);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = RF), 3, 'depois de repor: 1 + 5 − 3');

  -- ========== componente indisponível derruba o combo
  perform t.como(A);
  update public.produtos set disponivel = false where id = PT;
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 20);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Combo misto';
  perform t.igual((x ->> 'esgotado')::boolean, true, 'componente inativo: combo esgotado');
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', C2, 'quantidade', 1))), 'produto_indisponivel');

  -- ========== desmarcar combo e excluir componente
  perform t.como(A);
  perform public.definir_combo(C2, '[]');
  perform public.definir_combo(BA, null);
  perform t.dono();
  perform t.igual((select eh_combo from public.produtos where id = BA), false, 'combo desmarcado');
  perform t.igual((select count(*) from public.combo_itens where combo_id in (BA, C2))::int, 0, 'composição removida');
  perform t.como(A);
  delete from public.produtos where id = CH; get diagnostics n = row_count;
  perform t.igual(n, 1, 'sem vínculo, o produto pode ser excluído');
  perform t.dono();
  perform t.igual((select count(*) from public.itens_pedido_combo where nome_produto = 'Chope' and produto_id is null)::int, 1, 'histórico do pedido mantém o nome');
  perform t.dono();
end $$;
