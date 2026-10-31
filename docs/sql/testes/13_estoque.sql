-- Ajuste de estoque, histórico imutável e regra de inativar ao zerar.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003'; Z uuid := '10000000-0000-4000-8000-000000000005';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  P1 uuid := '30000000-0000-4000-8000-000000000001';
  P2 uuid := '30000000-0000-4000-8000-000000000002';
  C3 uuid := '40000000-0000-4000-8000-000000000003';
  n int; v int;
begin
  perform t.como(A);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, inativar_ao_zerar_estoque)
    values (P2, E1, C3, 'Água', 400, true);

  -- saldo inicial uma vez só
  perform t.igual(public.ajustar_estoque(P1, 'saldo_inicial', 10), 10, 'saldo inicial');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 5)', P1, 'saldo_inicial'), 'saldo_inicial_ja_registrado');
  -- reposição
  perform t.igual(public.ajustar_estoque(P1, 'reposicao', 5, 'Compra do fornecedor'), 15, 'reposição soma');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 0)', P1, 'reposicao'), 'quantidade_invalida');
  -- alteração de quantidade exige motivo
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 12)', P1, 'alteracao_quantidade'), 'observacao_obrigatoria');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 12, %L)', P1, 'alteracao_quantidade', '   '), 'observacao_obrigatoria');
  perform t.igual(public.ajustar_estoque(P1, 'alteracao_quantidade', 12, 'Contagem'), 12, 'alteração define o saldo');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 12, %L)', P1, 'alteracao_quantidade', 'igual'), 'sem_alteracao');
  -- baixa por avaria
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 2)', P1, 'baixa_avaria'), 'observacao_obrigatoria');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 99, %L)', P1, 'baixa_avaria', 'x'), 'estoque_insuficiente');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 0, %L)', P1, 'baixa_avaria', 'x'), 'quantidade_invalida');
  perform t.igual(public.ajustar_estoque(P1, 'baixa_avaria', 2, 'Quebrou na câmara'), 10, 'avaria subtrai');
  -- tipos e limites
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', P1, 'baixa_entrega'), 'tipo_invalido');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1000000)', P1, 'reposicao'), 'limite_excedido');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, -1)', P1, 'reposicao'), 'quantidade_invalida');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1, %L)', P1, 'reposicao', repeat('x', 201)), 'observacao_invalida');
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', gen_random_uuid(), 'reposicao'), 'produto_nao_encontrado');
  -- estoque físico no produto bate com a soma do histórico
  perform t.igual((select estoque_qtd from public.produtos where id = P1), 10, 'estoque do produto');
  perform t.igual((select sum(variacao) from public.movimentos_estoque where produto_id = P1)::int, 10, 'soma dos movimentos = estoque');
  perform t.igual((select count(*) from public.movimentos_estoque where produto_id = P1)::int, 4, 'quatro lançamentos válidos');
  perform t.igual((select saldo_apos from public.movimentos_estoque where produto_id = P1 order by criado_em desc, id limit 1), 10, 'último saldo');

  -- quem não tem acesso à empresa não ajusta (nem vê o histórico)
  perform t.como(B);
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', P1, 'reposicao'), 'sem_permissao');
  select count(*) into n from public.movimentos_estoque; perform t.igual(n, 0, 'B não vê histórico da E1');
  perform t.como(Z);
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', P1, 'reposicao'), 'sem_permissao');
  perform t.anonimo();
  perform t.erro(format('select public.ajustar_estoque(%L, %L, 1)', P1, 'reposicao'), 'permission denied');
  perform t.erro('select * from public.movimentos_estoque', 'permission denied');
  -- clientes não escrevem no histórico diretamente
  perform t.como(A);
  perform t.erro(format('insert into public.movimentos_estoque (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos) values (%L, %L, %L, %L, 1, 1)', E1, P1, 'x', 'reposicao'), 'permission denied');
  perform t.erro('update public.movimentos_estoque set variacao = 99', 'permission denied');
  perform t.erro('delete from public.movimentos_estoque', 'permission denied');

  -- inativar ao zerar: com a regra ligada, a baixa que zera deixa o produto indisponível
  perform t.igual(public.ajustar_estoque(P2, 'saldo_inicial', 3), 3, 'saldo inicial da água');
  perform t.igual(public.ajustar_estoque(P2, 'baixa_avaria', 3, 'Vencida'), 0, 'zera');
  perform t.igual((select disponivel from public.produtos where id = P2), false, 'ligado: ficou indisponível ao zerar');
  -- reposição não reativa sozinha
  perform t.igual(public.ajustar_estoque(P2, 'reposicao', 6), 6, 'repõe');
  perform t.igual((select disponivel from public.produtos where id = P2), false, 'reposição não reativa sozinha');
  -- com a regra desligada, continua disponível ao zerar
  update public.produtos set inativar_ao_zerar_estoque = false, disponivel = true where id = P2;
  perform t.igual(public.ajustar_estoque(P2, 'alteracao_quantidade', 0, 'Contagem zerada'), 0, 'zera por alteração');
  perform t.igual((select disponivel from public.produtos where id = P2), true, 'desligado: continua disponível');

  -- master ajusta em qualquer empresa
  perform t.como(M);
  perform t.igual(public.ajustar_estoque(P1, 'reposicao', 1, 'Master'), 11, 'master ajusta');

  -- histórico imutável (até para o dono do banco); só produto_id pode virar nulo
  perform t.dono();
  perform t.erro(format('update public.movimentos_estoque set variacao = 999 where produto_id = %L', P1), 'não pode ser alterado');
  perform t.erro(format('update public.movimentos_estoque set observacao = %L where produto_id = %L', 'editado', P1), 'não pode ser alterado');
  perform t.erro('delete from public.movimentos_estoque', 'não pode ser apagado');
  -- empresa inativa: o administrador dela não ajusta
  -- (excluir produto mantém o histórico, com o nome guardado)
  select count(*) into v from public.movimentos_estoque where produto_id = P2;
  delete from public.produtos where id = P2;
  perform t.igual((select count(*) from public.movimentos_estoque where produto_id = P2)::int, 0, 'movimentos deixam de apontar para o produto excluído');
  perform t.igual((select count(*) from public.movimentos_estoque where nome_produto = 'Água')::int, v, 'histórico do produto excluído continua, com o nome');
end $$;
