-- A mesa só é ocupada de verdade após aprovar um pedido; comandas vazias não travam a liberação.
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002'; B uuid := '10000000-0000-4000-8000-000000000003';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  PB uuid := '31000000-0000-4000-8000-000000000002';
  m6 uuid; m7 uuid; tokD text; tokE text; tokF text; pedD uuid; pedE uuid; comD uuid; comE uuid; comF uuid;
begin
  perform t.dono();
  select id into m6 from public.mesas where estabelecimento_id = E1 and numero = 6;
  select id into m7 from public.mesas where estabelecimento_id = E1 and numero = 7;

  -- ========== mesa 6: só um "curioso" com pedido nunca aprovado
  perform t.anonimo();
  tokD := public.identificar_cliente('loja_um', 6, 'Dora') ->> 'token';
  pedD := public.enviar_pedido(tokD, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1)));
  perform t.dono();
  perform t.igual((select count(*) from public.pedidos p join public.sessoes_mesa s on s.id = p.sessao_id
                    where s.mesa_id = m6 and p.status = 'confirmado')::int, 0, 'nenhum pedido aprovado: mesa não é ocupada');
  perform t.como(A);
  perform t.erro(format('select public.liberar_mesa(%L)', m6), 'pedidos_pendentes');   -- pedido ainda válido
  perform t.dono();
  update public.pedidos set expira_em = clock_timestamp() - interval '1 minute' where id = pedD;
  perform t.como(A);
  perform public.liberar_mesa(m6);                                                     -- expirou: libera sem pendências
  perform t.dono();
  select id into comD from public.comandas where token_hash = public.hash_token(tokD);
  perform t.igual((select status::text from public.comandas where id = comD), 'paga', 'comanda vazia encerrada sem cobrança');
  perform t.igual(public.comanda_devido(comD)::int, 0, 'sem consumo');
  perform t.igual((select count(*) from public.sessoes_mesa where mesa_id = m6 and status <> 'encerrada')::int, 0, 'mesa livre');

  -- ========== mesa 7: cliente real paga e fecha; um curioso identificado depois não trava a liberação
  perform t.anonimo();
  tokE := public.identificar_cliente('loja_um', 7, 'Eva') ->> 'token';
  pedE := public.enviar_pedido(tokE, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1)));
  perform t.como(A);
  perform public.confirmar_pedido(pedE);
  perform public.entregar_pedido(pedE);
  perform public.abrir_caixa(E1, 0);
  perform t.dono();
  select id into comE from public.comandas where token_hash = public.hash_token(tokE);
  perform t.como(A);
  perform public.registrar_pagamento(comE, 500, 'pix');
  perform public.fechar_comanda(comE);
  perform t.anonimo();
  tokF := public.identificar_cliente('loja_um', 7, 'Fred') ->> 'token';   -- só olhou o cardápio
  perform t.dono();
  select id into comF from public.comandas where token_hash = public.hash_token(tokF);
  perform t.igual((select status::text from public.comandas where id = comF), 'aberta', 'comanda do curioso está aberta');
  perform t.como(A);
  perform public.liberar_mesa(m7);                                          -- antes do 10 falhava com comandas_em_aberto
  perform t.dono();
  perform t.igual((select status::text from public.comandas where id = comF), 'paga', 'comanda vazia foi encerrada');
  perform t.igual((select count(*) from public.sessoes_mesa where mesa_id = m7 and status <> 'encerrada')::int, 0, 'mesa 7 livre');

  -- ========== comanda com pedido aprovado e sem pagar continua travando
  perform t.anonimo();
  tokE := public.identificar_cliente('loja_um', 6, 'Gil') ->> 'token';
  pedE := public.enviar_pedido(tokE, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 1)));
  perform t.como(A);
  perform public.confirmar_pedido(pedE); perform public.entregar_pedido(pedE);
  perform t.erro(format('select public.liberar_mesa(%L)', m6), 'comandas_em_aberto');
  perform t.como(B);
  perform t.erro(format('select public.liberar_mesa(%L)', m6), 'sem_permissao');
end $$;
