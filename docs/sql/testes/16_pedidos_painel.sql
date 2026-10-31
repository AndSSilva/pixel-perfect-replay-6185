-- Painel: confirmar, entregar (baixa de estoque), cancelar item, expiração, pagamentos, fechamento e segurança.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003'; Z uuid := '10000000-0000-4000-8000-000000000005';
  I uuid := '10000000-0000-4000-8000-000000000006';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  CAT uuid := '41000000-0000-4000-8000-000000000001';
  PA uuid := '31000000-0000-4000-8000-000000000001'; PB uuid := '31000000-0000-4000-8000-000000000002';
  PD uuid := '31000000-0000-4000-8000-000000000005'; PE uuid := '31000000-0000-4000-8000-000000000006';
  tokA text; tokB text; ped1 uuid; comA uuid; comB uuid; itA uuid; itB uuid; ids uuid[]; ped uuid; p2 uuid;
  m2 uuid; m3 uuid; r jsonb; n int; x int; toks text[];
begin
  select valor into tokA from t.ctx where chave = 'tokA';
  select valor into tokB from t.ctx where chave = 'tokB';
  select valor::uuid into ped1 from t.ctx where chave = 'ped1';
  perform t.dono();
  select id into comA from public.comandas where token_hash = public.hash_token(tokA);
  select id into comB from public.comandas where token_hash = public.hash_token(tokB);
  select id into m2 from public.mesas where estabelecimento_id = E1 and numero = 2;
  select id into m3 from public.mesas where estabelecimento_id = E1 and numero = 3;

  -- ========== confirmar
  perform t.como(A);
  perform public.confirmar_pedido(ped1);
  perform t.erro(format('select public.confirmar_pedido(%L)', ped1), 'pedido_nao_pendente');
  perform t.como(B);
  perform t.erro(format('select public.confirmar_pedido(%L)', ped1), 'sem_permissao');
  perform t.anonimo();
  perform t.erro(format('select public.confirmar_pedido(%L)', ped1), 'permission denied');
  perform t.erro(format('select public.confirmar_pedido(%L)', gen_random_uuid()), 'permission denied');
  r := public.minha_comanda(tokA);
  perform t.igual((r ->> 'devido_centavos')::int, 4000, 'só o confirmado conta: 3×10,00 + 2×5,00');
  perform t.igual((r ->> 'saldo_centavos')::int, 4000, 'saldo = devido − pago');
  perform t.como(A);
  perform t.erro(format('select public.confirmar_pedido(%L)', gen_random_uuid()), 'pedido_nao_encontrado');

  -- ========== entrega: tudo ou nada; baixa só na entrega
  perform t.dono();
  select id into itA from public.itens_pedido where pedido_id = ped1 and produto_id = PA;
  select id into itB from public.itens_pedido where pedido_id = ped1 and produto_id = PB;
  perform t.como(A);
  perform t.erro(format('select public.entregar_pedido(%L)', ped1), 'estoque_insuficiente');   -- Refri sem estoque (interruptor desligado)
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = PA), 10, 'falha total: estoque da cerveja intacto');
  perform t.igual((select count(*) from public.itens_pedido where pedido_id = ped1 and status = 'aguardando')::int, 2, 'nenhum item foi entregue');
  perform t.igual((select count(*) from public.movimentos_estoque where tipo = 'baixa_entrega')::int, 0, 'nenhuma baixa registrada');
  perform t.como(A);
  perform t.igual(public.entregar_itens(array[itA]), 1, 'entrega só a cerveja');
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = PA), 7, 'baixou 3 na entrega');
  perform t.igual((select variacao from public.movimentos_estoque where pedido_item_id = itA), -3, 'movimento de baixa por entrega');
  perform t.igual((select saldo_apos from public.movimentos_estoque where pedido_item_id = itA), 7, 'saldo após a entrega');
  perform t.igual((select tipo::text from public.movimentos_estoque where pedido_item_id = itA), 'baixa_entrega', 'tipo do movimento');
  perform t.igual((select status::text from public.itens_pedido where id = itA), 'entregue', 'item entregue');
  perform t.erro(format('update public.movimentos_estoque set variacao = -1 where pedido_item_id = %L', itA), 'não pode ser alterado');
  perform t.como(A);
  perform t.erro(format('select public.entregar_itens(array[%L]::uuid[])', itA), 'item_nao_entregavel');
  perform t.erro(format('select public.cancelar_item(%L, %L)', itA, 'tarde demais'), 'item_nao_cancelavel');
  -- cancelar o item que faltou: exige motivo, sai da conta
  perform t.erro(format('select public.cancelar_item(%L, null)', itB), 'motivo_obrigatorio');
  perform t.erro(format('select public.cancelar_item(%L, %L)', itB, '   '), 'motivo_obrigatorio');
  perform public.cancelar_item(itB, 'Faltou na geladeira');
  perform t.dono();
  perform t.igual((select status::text from public.itens_pedido where id = itB), 'cancelado', 'item cancelado');
  perform t.igual((select estoque_qtd from public.produtos where id = PB), 0, 'cancelar não mexe no estoque');
  perform t.igual(public.comanda_devido(comA)::int, 3000, 'item cancelado sai da conta');
  perform t.como(A);
  perform t.erro(format('select public.entregar_pedido(%L)', ped1), 'nada_a_entregar');

  -- ========== zerar com o interruptor ligado inativa o produto; desligado não
  perform t.anonimo();
  ped := public.enviar_pedido(tokB, jsonb_build_array(jsonb_build_object('produto_id', PA, 'quantidade', 7)));
  perform t.como(A);
  perform public.confirmar_pedido(ped);
  perform t.igual(public.entregar_pedido(ped), 1, 'entrega o pedido da Bia');
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = PA), 0, 'estoque zerou');
  perform t.igual((select disponivel from public.produtos where id = PA), false, 'ligado: ficou indisponível sozinho');
  perform t.anonimo();
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tokB, jsonb_build_array(jsonb_build_object('produto_id', PA, 'quantidade', 1))), 'produto_indisponivel');
  perform t.igual(position('Cerveja' in public.obter_cardapio_publico('loja_um', 2)::text), 0, 'some do cardápio');
  -- desligado: repõe o Refri, entrega e zera: continua disponível
  perform t.como(A);
  perform public.ajustar_estoque(PB, 'reposicao', 2, 'Chegou');
  perform t.anonimo();
  ped := public.enviar_pedido(tokB, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 2)));
  perform t.como(A);
  perform public.confirmar_pedido(ped); perform public.entregar_pedido(ped);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = PB), 0, 'refri zerou');
  perform t.igual((select disponivel from public.produtos where id = PB), true, 'desligado: continua disponível');

  -- ========== expiração: some da reserva e não pode mais ser confirmado
  perform t.como(A);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, inativar_ao_zerar_estoque)
    values (PD, E1, CAT, 'Água', 400, true);
  perform public.ajustar_estoque(PD, 'saldo_inicial', 5);
  perform t.anonimo();
  ped := public.enviar_pedido(tokB, jsonb_build_array(jsonb_build_object('produto_id', PD, 'quantidade', 5)));
  perform t.igual((select (p ->> 'esgotado')::boolean from jsonb_array_elements(public.obter_cardapio_publico('loja_um', 2) #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Água'), true, 'tudo reservado');
  perform t.dono();
  update public.pedidos set expira_em = clock_timestamp() - interval '1 minute' where id = ped;
  perform t.igual(public.qtd_reservada(PD), 0, 'pedido expirado não reserva mais');
  perform t.anonimo();
  perform t.igual((select (p ->> 'qtd_disponivel')::int from jsonb_array_elements(public.obter_cardapio_publico('loja_um', 2) #> '{categorias,0,produtos}') p where p ->> 'nome' = 'Água'), 5, 'disponível volta a 5');
  perform t.igual(public.minha_comanda(tokB) #>> '{pedidos,0,expirado}', 'true', 'o cliente vê que expirou');
  perform t.como(A);
  perform t.erro(format('select public.confirmar_pedido(%L)', ped), 'pedido_expirado');
  perform public.rejeitar_pedido(ped, 'Expirou');
  perform t.dono();
  perform t.igual((select motivo_rejeicao from public.pedidos where id = ped), 'Expirou', 'rejeitar guarda o motivo');
  perform t.como(A);
  perform t.erro(format('select public.rejeitar_pedido(%L)', ped), 'pedido_nao_pendente');
  perform t.erro(format('select public.rejeitar_pedido(%L, %L)', gen_random_uuid(), 'x'), 'pedido_nao_encontrado');

  -- ========== produto excluído antes da entrega: entrega segue, sem mexer em estoque
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos) values (PE, E1, CAT, 'Descontinuado', 100);
  perform t.anonimo();
  ped := public.enviar_pedido(tokB, jsonb_build_array(jsonb_build_object('produto_id', PE, 'quantidade', 1)));
  perform t.como(A);
  perform public.confirmar_pedido(ped);
  delete from public.produtos where id = PE;
  perform t.igual(public.entregar_pedido(ped), 1, 'entrega mesmo com o produto excluído');
  perform t.dono();
  perform t.igual((select produto_id from public.itens_pedido where pedido_id = ped), null, 'item não aponta mais para o produto');
  perform t.igual((select nome_produto from public.itens_pedido where pedido_id = ped), 'Descontinuado', 'nome continua no item');

  -- ========== pagamentos e fechamento (Ana: devido 3000)
  perform t.dono();
  select array_agg(id) into ids from public.pedidos where comanda_id = comA and status = 'pendente';
  perform t.como(A);
  perform t.erro(format('select public.fechar_comanda(%L)', comA), 'pedidos_pendentes');
  foreach ped in array ids loop perform public.rejeitar_pedido(ped, 'Limpeza'); end loop;
  perform t.erro(format('select public.fechar_comanda(%L)', comA), 'saldo_em_aberto');
  -- pagamento exige caixa aberto (script 09)
  perform t.erro(format('select public.registrar_pagamento(%L, 1000, %L)', comA, 'pix'), 'caixa_fechado');
  perform public.abrir_caixa(E1, 5000);
  perform t.erro(format('select public.registrar_pagamento(%L, 0, %L)', comA, 'pix'), 'valor_invalido');
  perform t.erro(format('select public.registrar_pagamento(%L, 3001, %L)', comA, 'pix'), 'valor_excede_saldo');
  perform t.erro(format('select public.registrar_pagamento(%L, 1000, %L, null, 500)', comA, 'dinheiro'), 'recebido_menor_que_valor');
  perform t.erro(format('select public.registrar_pagamento(%L, 1000, %L, %L)', comA, 'pix', repeat('x', 201)), 'observacao_invalida');
  perform t.como(B);
  perform t.erro(format('select public.registrar_pagamento(%L, 1000, %L)', comA, 'pix'), 'sem_permissao');
  perform t.como(A);
  perform public.registrar_pagamento(comA, 1000, 'pix');
  p2 := public.registrar_pagamento(comA, 1500, 'dinheiro', 'Troco devolvido', 2000);
  perform t.dono();
  perform t.igual((select troco_centavos from public.pagamentos where id = p2), 500, 'troco calculado');
  perform t.igual((select recebido_centavos from public.pagamentos where id = p2), 2000, 'recebido guardado');
  perform t.igual(public.comanda_pago(comA)::int, 2500, 'pago somado');
  perform t.como(A);
  perform t.erro(format('select public.registrar_pagamento(%L, 501, %L)', comA, 'pix'), 'valor_excede_saldo');
  perform public.excluir_pagamento(p2);
  perform t.erro(format('select public.excluir_pagamento(%L)', p2), 'pagamento_nao_encontrado');
  perform public.registrar_pagamento(comA, 2000, 'credito');
  perform t.anonimo();
  perform t.igual((public.minha_comanda(tokA) ->> 'saldo_centavos')::int, 0, 'saldo zerado');
  perform t.igual(jsonb_array_length(public.minha_comanda(tokA) -> 'pagamentos'), 2, 'cliente vê os pagamentos');
  perform t.como(A);
  perform public.fechar_comanda(comA);
  perform t.erro(format('select public.fechar_comanda(%L)', comA), 'comanda_fechada');
  perform t.erro(format('select public.registrar_pagamento(%L, 1, %L)', comA, 'pix'), 'comanda_fechada');
  perform t.dono();

  -- ========== mesa: fechamento, retomada e liberação
  select s.mesa_id into m2 from public.sessoes_mesa s join public.comandas c on c.sessao_id = s.id where c.id = comB;
  perform t.como(A);
  perform t.erro(format('select public.liberar_mesa(%L)', m2), 'comandas_em_aberto');
  perform public.iniciar_fechamento_mesa(m2);
  perform t.erro(format('select public.iniciar_fechamento_mesa(%L)', m2), 'mesa_sem_atendimento');
  perform t.anonimo();
  perform t.erro('select public.identificar_cliente(''loja_um'', 2, ''Carla'')', 'mesa_em_fechamento');
  perform t.como(A);
  perform public.retomar_atendimento_mesa(m2);
  perform t.erro(format('select public.retomar_atendimento_mesa(%L)', m2), 'mesa_sem_atendimento');
  perform t.dono();
  perform t.igual(public.comanda_devido(comB)::int, 8100, 'conta da Bia: 7×10 + 2×5 + 1');
  perform t.como(A);
  perform public.registrar_pagamento(comB, 8100, 'pix');
  perform public.fechar_comanda(comB);
  perform t.como(B);
  perform t.erro(format('select public.liberar_mesa(%L)', m2), 'sem_permissao');
  perform t.como(A);
  perform public.liberar_mesa(m2);
  perform t.erro(format('select public.liberar_mesa(%L)', m2), 'mesa_sem_atendimento');
  perform t.erro(format('select public.liberar_mesa(%L)', gen_random_uuid()), 'mesa_nao_encontrada');
  perform t.dono();
  perform t.igual((select count(*) from public.sessoes_mesa where mesa_id = m2 and status <> 'encerrada')::int, 0, 'mesa livre');
  perform t.anonimo();
  perform t.igual(public.minha_comanda(tokA) #>> '{comanda,status}', 'paga', 'comanda paga continua consultável como fechada');
  perform t.igual(public.minha_comanda(tokA) #>> '{comanda,sessao_status}', 'encerrada', 'sessão encerrada');

  -- ========== segurança: tabelas fechadas para clientes e helpers internos
  perform t.anonimo();
  perform t.erro('select * from public.comandas', 'permission denied');
  perform t.erro('select * from public.pedidos', 'permission denied');
  perform t.erro('insert into public.pagamentos (id) values (gen_random_uuid())', 'permission denied');
  perform t.erro(format('select public.comanda_devido(%L)', comB), 'permission denied');
  perform t.erro('select public.hash_token(''x'')', 'permission denied');
  perform t.como(A);
  perform t.erro('select token_hash from public.comandas', 'permission denied');
  perform t.erro(format('select public.qtd_reservada(%L)', PA), 'permission denied');
  perform t.erro(format('update public.itens_pedido set status = ''entregue'' where id = %L', itA), 'permission denied');
  perform t.erro('delete from public.pagamentos', 'permission denied');
  -- isolamento entre empresas
  select count(*) into n from public.pedidos;
  perform t.como(B);
  perform t.igual((select count(*) from public.pedidos)::int, 0, 'admin sem vínculo não vê pedidos');
  perform t.igual((select count(*) from public.comandas)::int, 0, 'nem comandas');
  perform t.como(I);
  perform t.igual((select count(*) from public.pedidos)::int, 0, 'empresa inativa: sem acesso');
  perform t.como(M);
  perform t.igual((select count(*) from public.pedidos)::int, n, 'master vê tudo');
  perform t.como(Z);
  perform t.igual((select count(*) from public.pedidos)::int, 0, 'outra empresa não vê');
  perform t.dono();
end $$;
