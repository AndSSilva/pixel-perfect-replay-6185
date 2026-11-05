-- Página da INOV4: público lê; só o master grava; a tabela não é acessível diretamente.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  h jsonb := '[null,null,null,{"abre":"09:00","fecha":"18:00"},null,null,null]';
  r jsonb;
begin
  perform t.anonimo();
  r := public.obter_apresentacao_plataforma();
  perform t.igual(r ->> 'descricao', null, 'começa vazia');
  perform t.erro('select * from public.plataforma', 'permission denied');
  perform t.erro('update public.plataforma set descricao = ''x''', 'permission denied');
  perform t.erro('select public.atualizar_apresentacao_plataforma(''x'', null, null, null, null, null)', 'permission denied');

  perform t.como(A);
  perform t.erro('select public.atualizar_apresentacao_plataforma(''x'', null, null, null, null, null)', 'sem permissão');
  perform t.erro('select * from public.plataforma', 'permission denied');

  perform t.como(M);
  perform public.atualizar_apresentacao_plataforma('  Somos a INOV4 ', '5551999999999', 'inov4.hub', E'Rua A 1\nPorto Alegre', h, '{"inicio":"12:00","fim":"13:00"}');
  perform t.anonimo();
  r := public.obter_apresentacao_plataforma();
  perform t.igual(r ->> 'descricao', 'Somos a INOV4', 'salvo e sem espaços nas pontas');
  perform t.igual(r ->> 'whatsapp', '5551999999999', 'whatsapp');
  perform t.igual(r #>> '{horarios,3,abre}', '09:00', 'horário');
  perform t.igual(r #>> '{intervalo,fim}', '13:00', 'intervalo');

  perform t.como(M);
  perform t.erro('select public.atualizar_apresentacao_plataforma(null, ''123'', null, null, null, null)', 'whatsapp_formato');
  perform t.erro('select public.atualizar_apresentacao_plataforma(null, null, ''a b'', null, null, null)', 'instagram_formato');
  perform t.erro('select public.atualizar_apresentacao_plataforma(null, null, null, null, ''[null]''::jsonb, null)', 'horarios_validos');
  perform t.erro('select public.atualizar_apresentacao_plataforma(null, null, null, null, null, ''{"inicio":"12:00"}''::jsonb)', 'intervalo_valido');
  perform t.erro(format('select public.atualizar_apresentacao_plataforma(%L, null, null, null, null, null)', repeat('x', 501)), 'descricao_tamanho');
  perform t.erro('insert into public.plataforma (id) values (false)', 'permission denied');

  perform public.atualizar_apresentacao_plataforma(null, null, null, null, null, null);
  perform t.anonimo();
  r := public.obter_apresentacao_plataforma();
  perform t.igual(r ->> 'descricao', null, 'limpa tudo');
  perform t.igual(jsonb_typeof(r -> 'horarios'), 'null', 'sem horário');
  perform t.dono();
end $$;
