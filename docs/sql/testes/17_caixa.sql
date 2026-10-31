-- Caixa: abertura, sangria/reforço, esperado x contado, fechamento imutável e segurança.
-- Continua do teste 16: o caixa aberto lá (abertura 50,00) já tem pagamentos em pix/crédito e nenhum em dinheiro.
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002'; B uuid := '10000000-0000-4000-8000-000000000003';
  Z uuid := '10000000-0000-4000-8000-000000000005'; I uuid := '10000000-0000-4000-8000-000000000006';
  M uuid := '10000000-0000-4000-8000-000000000001';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  PB uuid := '31000000-0000-4000-8000-000000000002';
  cx uuid; cx2 uuid; r jsonb; tok text; ped uuid; com uuid; pg uuid; pg2 uuid; n int; mv uuid;
begin
  perform t.dono();
  select id into cx from public.caixas where estabelecimento_id = E1 and status = 'aberto';
  perform t.igual(cx is not null, true, 'o caixa do teste 16 está aberto');
  perform t.igual((select abertura_centavos from public.caixas where id = cx), 5000, 'abertura registrada');
  perform t.igual((select aberto_por from public.caixas where id = cx), A, 'quem abriu');

  -- ========== um caixa aberto por vez; valores inválidos; permissão
  perform t.como(A);
  perform t.erro(format('select public.abrir_caixa(%L, 0)', E1), 'caixa_ja_aberto');
  perform t.como(B);
  perform t.erro(format('select public.abrir_caixa(%L, 0)', E1), 'sem_permissao');
  perform t.erro(format('select public.resumo_caixa(%L)', cx), 'sem_permissao');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 100, %L)', cx, 'reforco', 'x'), 'sem_permissao');
  perform t.erro(format('select public.fechar_caixa(%L, 0)', cx), 'sem_permissao');
  perform t.como(I);
  perform t.erro(format('select public.abrir_caixa(%L, 0)', E1), 'sem_permissao');
  perform t.anonimo();
  perform t.erro(format('select public.abrir_caixa(%L, 0)', E1), 'permission denied');
  perform t.erro(format('select public.resumo_caixa(%L)', cx), 'permission denied');
  perform t.erro('select * from public.caixas', 'permission denied');
  perform t.erro(format('select public.caixa_esperado(%L)', cx), 'permission denied');

  -- ========== esperado só conta dinheiro: pix/crédito do teste 16 não entram
  perform t.como(A);
  r := public.resumo_caixa(cx);
  perform t.igual((r ->> 'esperado_centavos')::int, 5000, 'esperado = só a abertura');
  perform t.igual((r ->> 'dinheiro_centavos')::int, 0, 'nenhum dinheiro ainda');
  perform t.igual((r #>> '{por_forma,pix}')::int, 9100, 'pix: 10,00 + 81,00');
  perform t.igual((r #>> '{por_forma,credito}')::int, 2000, 'crédito 20,00');
  perform t.igual((r #>> '{por_forma,dinheiro}')::int, 0, 'forma sem pagamento vem zerada');
  perform t.igual((r ->> 'total_recebido_centavos')::int, 11100, 'total recebido no caixa');
  perform t.igual((r ->> 'qtd_pagamentos')::int, 3, 'quantidade de pagamentos');

  -- ========== novo cliente paga em dinheiro com troco
  perform t.como(A);
  perform public.ajustar_estoque(PB, 'reposicao', 10, 'caixa');
  perform t.anonimo();
  tok := (public.identificar_cliente('loja_um', 4, 'Caio') ->> 'token');
  ped := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', PB, 'quantidade', 2)));
  perform t.como(A);
  perform public.confirmar_pedido(ped); perform public.entregar_pedido(ped);
  perform t.dono();
  select id into com from public.comandas where token_hash = public.hash_token(tok);
  perform t.como(A);
  pg := public.registrar_pagamento(com, 800, 'dinheiro', null, 1000);   -- troco 2,00
  pg2 := public.registrar_pagamento(com, 200, 'pix');
  perform t.dono();
  perform t.igual((select caixa_id from public.pagamentos where id = pg), cx, 'pagamento aponta para o caixa aberto');
  perform t.como(A);
  r := public.resumo_caixa(cx);
  perform t.igual((r ->> 'esperado_centavos')::int, 5800, 'esperado = 50,00 + 8,00 em dinheiro (troco não entra)');
  perform t.igual((r ->> 'dinheiro_centavos')::int, 800, 'dinheiro recebido sem troco');

  -- ========== reforço e sangria
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 0, %L)', cx, 'reforco', 'x'), 'valor_invalido');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 100, %L)', cx, 'reforco', '   '), 'motivo_obrigatorio');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 100, %L)', cx, 'reforco', repeat('x', 201)), 'motivo_invalido');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 100, %L)', gen_random_uuid(), 'reforco', 'x'), 'caixa_nao_encontrado');
  mv := public.movimentar_caixa(cx, 'reforco', 1000, 'Troco para o balcão');
  perform t.igual((public.resumo_caixa(cx) ->> 'esperado_centavos')::int, 6800, 'reforço soma');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 6801, %L)', cx, 'sangria', 'Pagar fornecedor'), 'valor_excede_caixa');
  perform public.movimentar_caixa(cx, 'sangria', 2000, 'Pagamento do gelo');
  r := public.resumo_caixa(cx);
  perform t.igual((r ->> 'esperado_centavos')::int, 4800, 'sangria subtrai');
  perform t.igual((r ->> 'reforcos_centavos')::int, 1000, 'reforços');
  perform t.igual((r ->> 'sangrias_centavos')::int, 2000, 'sangrias');
  perform t.dono();
  perform t.igual((select criado_por from public.movimentos_caixa where id = mv), A, 'quem movimentou');
  perform t.como(A);
  perform t.erro('update public.movimentos_caixa set valor_centavos = 1', 'permission denied');
  perform t.erro('delete from public.movimentos_caixa', 'permission denied');
  perform t.erro('update public.caixas set abertura_centavos = 0', 'permission denied');
  perform t.como(B);
  perform t.igual((select count(*) from public.movimentos_caixa)::int, 0, 'outra empresa não vê movimentos');
  perform t.igual((select count(*) from public.caixas)::int, 0, 'nem caixas');

  -- ========== fechamento: esperado x contado
  perform t.como(A);
  perform t.erro(format('select public.fechar_caixa(%L, -1)', cx), 'valor_invalido');
  perform t.erro(format('select public.fechar_caixa(%L, null)', cx), 'valor_invalido');
  perform t.erro(format('select public.fechar_caixa(%L, 100, %L)', cx, repeat('x', 201)), 'observacao_invalida');
  perform t.igual(public.fechar_caixa(cx, 4700, 'Faltou uma nota de 1')::int, -100, 'diferença = contado − esperado');
  perform t.dono();
  perform t.igual((select status::text from public.caixas where id = cx), 'fechado', 'fechou');
  perform t.igual((select esperado_centavos from public.caixas where id = cx), 4800, 'esperado gravado');
  perform t.igual((select contado_centavos from public.caixas where id = cx), 4700, 'contado gravado');
  perform t.igual((select diferenca_centavos from public.caixas where id = cx), -100, 'diferença gravada');
  perform t.igual((select fechado_por from public.caixas where id = cx), A, 'quem fechou');

  -- ========== caixa fechado é imutável; sem caixa não há pagamento
  perform t.como(A);
  perform t.erro(format('select public.fechar_caixa(%L, 4800)', cx), 'caixa_fechado');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 100, %L)', cx, 'reforco', 'x'), 'caixa_fechado');
  perform t.erro(format('select public.excluir_pagamento(%L)', pg), 'caixa_ja_fechado');
  perform t.igual((public.resumo_caixa(cx) ->> 'esperado_centavos')::int, 4800, 'resumo do fechado continua igual');
  perform t.erro(format('select public.registrar_pagamento(%L, 1, %L)', com, 'pix'), 'caixa_fechado');

  -- ========== novo caixa (aberto pelo master) começa do zero; fechado antigo não interfere
  perform t.como(A);
  perform t.erro(format('select public.abrir_caixa(%L, -1)', E1), 'valor_invalido');
  perform t.erro(format('select public.abrir_caixa(%L, 100000001)', E1), 'valor_invalido');
  perform t.erro('select public.abrir_caixa(null, 0)', 'sem_permissao');
  perform t.como(M);
  cx2 := public.abrir_caixa(E1, 0);
  perform t.dono();
  perform t.igual((select aberto_por from public.caixas where id = cx2), M, 'master pode abrir');
  perform t.igual((select count(*) from public.caixas where estabelecimento_id = E1 and status = 'aberto')::int, 1, 'só um aberto');
  perform t.como(A);
  perform t.erro(format('select public.abrir_caixa(%L, 0)', E1), 'caixa_ja_aberto');
  perform t.igual((public.resumo_caixa(cx2) ->> 'esperado_centavos')::int, 0, 'caixa novo zerado');
  perform t.igual((public.resumo_caixa(cx2) ->> 'qtd_pagamentos')::int, 0, 'sem pagamentos');
  perform t.erro(format('select public.movimentar_caixa(%L, %L, 1, %L)', cx2, 'sangria', 'x'), 'valor_excede_caixa');
  perform t.erro(format('select public.registrar_pagamento(%L, 1, %L)', com, 'pix'), 'valor_excede_saldo');
  perform t.igual(public.fechar_caixa(cx2, 0)::int, 0, 'fecha sem diferença');
  perform t.dono();
  perform t.igual((select diferenca_centavos from public.caixas where id = cx2), 0, 'diferença zero');
  perform t.igual((select count(*) from public.caixas where estabelecimento_id = E1)::int, 2, 'histórico de caixas');
  -- caixa de outra empresa não interfere
  perform t.igual((select count(*) from public.caixas where estabelecimento_id <> E1)::int, 0, 'nenhum caixa fora da empresa 1');
end $$;
