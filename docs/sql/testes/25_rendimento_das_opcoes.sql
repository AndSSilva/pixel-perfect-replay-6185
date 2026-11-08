-- Rendimento da opção (script 18): 1 unidade de estoque rende N escolhas; baixa ao abrir a unidade.
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  CAT uuid := '41000000-0000-4000-8000-000000000001';
  NR uuid := '53000000-0000-4000-8000-000000000001';  -- narguilé
  ES uuid := '53000000-0000-4000-8000-000000000002';  -- essência, rende 3
  tok text; r jsonb; x jsonb; p1 uuid; p2 uuid; p3 uuid; it uuid;
begin
  perform t.dono();
  perform t.como(A);
  insert into public.mesas (estabelecimento_id, numero) values (E1, 41);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos, inativar_ao_zerar_estoque) values
    (NR, E1, CAT, 'Narguilé rende', 6000, 1000, false);
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos, inativar_ao_zerar_estoque, usos_por_unidade) values
    (ES, E1, CAT, 'Essência rende 3', 0, 900, true, 3);
  perform public.ajustar_estoque(ES, 'saldo_inicial', 2);
  perform public.definir_opcoes(NR, array[ES]);
  perform t.dono();
  perform t.igual((select usos_por_unidade from public.produtos where id = ES), 3, 'rendimento gravado');
  perform t.igual((select usos_restantes from public.produtos where id = ES), 0, 'nenhuma unidade aberta');

  -- o app não grava usos_restantes direto
  perform t.como(A);
  begin update public.produtos set usos_restantes = 2 where id = ES; raise exception 'deveria negar';
  exception when insufficient_privilege then null; end;
  begin update public.produtos set usos_por_unidade = 0 where id = ES; raise exception 'deveria negar';
  exception when check_violation then null; end;

  -- cardápio oferece em usos: 2 unidades × 3 = 6
  perform t.anonimo();
  r := public.obter_cardapio_publico('loja_um', 41);
  select e into x from jsonb_array_elements(r -> 'categorias') c, jsonb_array_elements(c -> 'produtos') e where e ->> 'nome' = 'Narguilé rende';
  perform t.igual((x ->> 'qtd_disponivel')::int, 6, 'dá para 6 narguilés');
  perform t.igual((x #>> '{opcoes,0,qtd_disponivel}')::int, 6, 'opção: 6 usos');
  tok := public.identificar_cliente('loja_um', 41, 'Cliente Rende') ->> 'token';
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NR, 'opcao_id', ES, 'quantidade', 7))), 'quantidade_indisponivel');
  p1 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', NR, 'opcao_id', ES, 'quantidade', 4)));
  perform t.dono();
  perform t.igual(public.qtd_reservada(ES), 4, 'reserva em usos');
  perform t.igual(public.opcao_usos_disponiveis(ES), 2, 'sobram 2 usos');

  -- entrega de 4: abre 2 unidades (3 + 1), sobram 2 usos na aberta
  perform t.como(A);
  perform public.confirmar_pedido(p1);
  perform public.entregar_pedido(p1);
  perform t.dono();
  perform t.igual((select estoque_qtd from public.produtos where id = ES), 0, 'abriu 2 unidades');
  perform t.igual((select usos_restantes from public.produtos where id = ES), 2, 'sobraram 2 usos');
  perform t.igual((select disponivel from public.produtos where id = ES), true, 'ainda tem usos: continua disponível');
  select i.id into it from public.itens_pedido i where i.pedido_id = p1;
  perform t.igual((select variacao from public.movimentos_estoque where pedido_item_id = it), -2, 'movimento: 2 unidades');
  perform t.igual((select observacao from public.movimentos_estoque where pedido_item_id = it), 'Escolha: Narguilé rende (Essência rende 3) (rende 3)', 'movimento diz o rendimento');
  perform t.igual(public.opcao_usos_disponiveis(ES), 2, 'cardápio: 2 usos');

  -- os 2 usos restantes saem da unidade aberta, sem novo movimento
  perform t.anonimo();
  perform t.erro(format('select public.enviar_pedido(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('produto_id', NR, 'opcao_id', ES, 'quantidade', 3))), 'quantidade_indisponivel');
  p2 := public.enviar_pedido(tok, jsonb_build_array(jsonb_build_object('produto_id', NR, 'opcao_id', ES, 'quantidade', 2)));
  perform t.como(A);
  perform public.confirmar_pedido(p2);
  perform public.entregar_pedido(p2);
  perform t.dono();
  perform t.igual((select usos_restantes from public.produtos where id = ES), 0, 'unidade aberta acabou');
  perform t.igual((select estoque_qtd from public.produtos where id = ES), 0, 'estoque não mudou');
  perform t.igual((select disponivel from public.produtos where id = ES), false, 'sem estoque e sem usos: inativada');
  select i.id into it from public.itens_pedido i where i.pedido_id = p2;
  perform t.igual((select count(*) from public.movimentos_estoque where pedido_item_id = it)::int, 0, 'sem movimento quando só usa a unidade aberta');

  -- reposição: volta a oferecer; mudar o rendimento limita os usos restantes
  perform t.como(A);
  perform public.ajustar_estoque(ES, 'reposicao', 1);
  update public.produtos set disponivel = true where id = ES;
  update public.produtos set usos_por_unidade = 1 where id = ES;
  perform t.dono();
  perform t.igual(public.opcao_usos_disponiveis(ES), 1, 'rendimento 1: 1 unidade = 1 uso');
  perform t.dono();
end $$;
