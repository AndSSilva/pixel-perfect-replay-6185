-- O administrador edita a apresentação da PRÓPRIA empresa pela função; o resto da empresa continua só do master.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003';
  E1 uuid := '20000000-0000-4000-8000-000000000001'; E2 uuid := '20000000-0000-4000-8000-000000000002';
  h jsonb := '[{"abre":"19:00","fecha":"03:00"},null,null,{"abre":"19:00","fecha":"02:00"},{"abre":"19:00","fecha":"02:00"},{"abre":"19:00","fecha":"03:00"},{"abre":"19:00","fecha":"03:00"}]';
  r jsonb; nome_antes text; n int;
begin
  perform t.como(A);
  select nome into nome_antes from public.estabelecimentos where id = E1;
  perform public.atualizar_apresentacao(E1, '  Lounge 🎱  ', '5551935001383', 'nevoa.lounge', E'Rua X 56\nPorto Alegre', h,
    '{"inicio":"12:00","fim":"14:00"}');
  perform t.anonimo();
  r := public.obter_apresentacao_publica('loja_um');
  perform t.igual(r #>> '{empresa,descricao}', 'Lounge 🎱', 'texto salvo sem espaços nas pontas');
  perform t.igual(r #>> '{empresa,intervalo,inicio}', '12:00', 'intervalo aparece na página pública');
  perform t.igual(r #>> '{empresa,intervalo,fim}', '14:00', 'fim do intervalo');
  perform t.igual(r #>> '{empresa,horarios,3,abre}', '19:00', 'horário salvo');
  perform t.igual(r #>> '{empresa,nome}', nome_antes, 'nome não muda');

  -- só os campos da apresentação mudam
  perform t.como(A);
  perform t.igual((select nome from public.estabelecimentos where id = E1), nome_antes, 'nome intacto');

  -- limpar: vazio vira "sem valor"; sem intervalo
  perform public.atualizar_apresentacao(E1, '   ', '', '', '', null, null);
  perform t.anonimo();
  r := public.obter_apresentacao_publica('loja_um');
  perform t.igual(r #>> '{empresa,descricao}', null, 'descrição limpa');
  perform t.igual(r #>> '{empresa,whatsapp}', null, 'whatsapp limpo');
  perform t.igual(r #>> '{empresa,endereco}', null, 'endereço limpo');
  perform t.igual(jsonb_typeof(r #> '{empresa,horarios}'), 'null', 'horários limpos');
  perform t.igual(jsonb_typeof(r #> '{empresa,intervalo}'), 'null', 'sem intervalo');

  -- permissões
  perform t.como(A);
  perform t.erro(format('select public.atualizar_apresentacao(%L, %L, null, null, null, null, null)', E2, 'invasão'), 'sem permissão');
  perform t.como(B);
  perform t.erro(format('select public.atualizar_apresentacao(%L, %L, null, null, null, null, null)', E1, 'invasão'), 'sem permissão');
  perform t.anonimo();
  perform t.erro(format('select public.atualizar_apresentacao(%L, %L, null, null, null, null, null)', E1, 'invasão'), 'permission denied');
  perform t.como(M);
  perform public.atualizar_apresentacao(E1, 'do master', null, null, null, null, null);
  perform t.igual((select descricao from public.estabelecimentos where id = E1), 'do master', 'master também pode');
  perform t.como(A);
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, null, null)', '99999999-9999-4999-8999-999999999999'), 'sem permissão');

  -- formato e limites continuam valendo
  perform t.como(A);
  perform t.erro(format('select public.atualizar_apresentacao(%L, %L, null, null, null, null, null)', E1, repeat('x', 501)), 'descricao_tamanho');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, %L, null, null, null, null)', E1, '123'), 'whatsapp_formato');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, %L, null, null, null)', E1, 'com espaço'), 'instagram_formato');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, %L::jsonb, null)', E1, '[null]'), 'horarios_validos');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, null, %L::jsonb)', E1, '{"inicio":"12:00","fim":"12:00"}'), 'intervalo_valido');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, null, %L::jsonb)', E1, '{"inicio":"25:00","fim":"13:00"}'), 'intervalo_valido');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, null, %L::jsonb)', E1, '{"inicio":"12:00"}'), 'intervalo_valido');
  perform t.erro(format('select public.atualizar_apresentacao(%L, null, null, null, null, %L::jsonb, null)', E1, '[null,null,null,null,null,null,{"abre":"19:00"}]'), 'horarios_validos');
  -- o administrador segue sem alterar a tabela diretamente
  update public.estabelecimentos set nome = 'invadido' where id = E1; get diagnostics n = row_count;
  perform t.igual(n, 0, 'administrador não altera a tabela diretamente');
  perform t.dono();
end $$;
