-- Apresentação da empresa: só o master edita; função pública mostra mesas disponíveis sem vazar dados.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003';
  E1 text := '20000000-0000-4000-8000-000000000001'; E2 text := '20000000-0000-4000-8000-000000000002';
  r jsonb; n int; x jsonb;
begin
  -- ========== edição: só o master
  perform t.como(M);
  update public.estabelecimentos set descricao = 'Lounge com sinuca e narguilé 🎱', whatsapp = '5551935001383', instagram = 'nevoa.lounge',
    horarios = '[{"abre":"19:00","fecha":"03:00"},null,null,{"abre":"19:00","fecha":"02:00"},{"abre":"19:00","fecha":"02:00"},{"abre":"19:00","fecha":"03:00"},{"abre":"19:00","fecha":"03:00"}]',
    endereco = E'Rua X 56\nPorto Alegre',
    logo_url = 'https://exemplo.supabase.co/storage/v1/object/public/logos-empresas/a.png'
   where id = E1::uuid;
  get diagnostics n = row_count; perform t.igual(n, 1, 'master edita');
  perform t.como(A);
  update public.estabelecimentos set descricao = 'invadido' where id = E1::uuid; get diagnostics n = row_count;
  perform t.igual(n, 0, 'administrador da empresa não edita a apresentação');
  perform t.como(B);
  update public.estabelecimentos set descricao = 'invadido' where id = E1::uuid; get diagnostics n = row_count;
  perform t.igual(n, 0, 'nem administrador de outra empresa');
  perform t.anonimo();
  perform t.erro('select * from public.estabelecimentos', 'permission denied');

  -- ========== limites e formato
  perform t.como(M);
  perform t.erro(format('update public.estabelecimentos set descricao = %L where id = %L', repeat('x', 501), E1), 'descricao_tamanho');
  perform t.erro(format('update public.estabelecimentos set endereco = %L where id = %L', repeat('x', 201), E1), 'endereco_tamanho');
  perform t.erro(format('update public.estabelecimentos set whatsapp = %L where id = %L', '(51) 9350', E1), 'whatsapp_formato');
  perform t.erro(format('update public.estabelecimentos set instagram = %L where id = %L', '@com arroba', E1), 'instagram_formato');
  perform t.erro(format('update public.estabelecimentos set horarios = %L::jsonb where id = %L', '[null,null]', E1), 'horarios_validos');
  perform t.erro(format('update public.estabelecimentos set horarios = %L::jsonb where id = %L', '[null,null,null,null,null,null,{"abre":"25:00","fecha":"02:00"}]', E1), 'horarios_validos');
  perform t.erro(format('update public.estabelecimentos set horarios = %L::jsonb where id = %L', '[null,null,null,null,null,null,{"abre":"19:00","fecha":"19:00"}]', E1), 'horarios_validos');
  perform t.erro(format('update public.estabelecimentos set horarios = %L::jsonb where id = %L', '{"a":1}', E1), 'horarios_validos');
  perform t.erro(format('update public.estabelecimentos set logo_url = %L where id = %L', 'javascript:alert(1)', E1), 'logo_formato');
  perform t.erro(format('update public.estabelecimentos set logo_url = %L where id = %L', 'http://inseguro/a.png', E1), 'logo_formato');

  -- ========== logos no armazenamento: só o master
  perform t.como(M);
  insert into storage.objects (bucket_id, name) values ('logos-empresas', E1 || '/logo-abc.png');
  perform t.como(A);
  perform t.erro(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'logos-empresas', E1 || '/x.png'), 'row-level security');
  delete from storage.objects where name = E1 || '/logo-abc.png'; get diagnostics n = row_count;
  perform t.igual(n, 0, 'administrador não apaga o logo');
  perform t.como(M);
  delete from storage.objects where name = E1 || '/logo-abc.png'; get diagnostics n = row_count;
  perform t.igual(n, 1, 'master apaga o logo');

  -- ========== função pública
  perform t.anonimo();
  r := public.obter_apresentacao_publica('LOJA_UM');
  perform t.igual(r #>> '{empresa,slug}', 'loja_um', 'encontra o slug sem diferenciar maiúsculas');
  perform t.igual(r #>> '{empresa,endereco}', E'Rua X 56\nPorto Alegre', 'endereço com duas linhas');
  perform t.igual(r #>> '{empresa,descricao}', 'Lounge com sinuca e narguilé 🎱', 'apresentação com emoji');
  perform t.igual(r #>> '{empresa,whatsapp}', '5551935001383', 'whatsapp');
  perform t.igual(r #>> '{empresa,instagram}', 'nevoa.lounge', 'instagram');
  perform t.igual(jsonb_array_length(r #> '{empresa,horarios}'), 7, 'sete dias de horário');
  perform t.igual(r #>> '{empresa,horarios,3,fecha}', '02:00', 'quarta fecha às 02:00');
  perform t.igual(jsonb_typeof(r #> '{empresa,horarios,1}'), 'null', 'segunda fechado');
  perform t.igual(r -> 'empresa' ? 'id', false, 'não expõe o id da empresa');
  -- mesa 2 e 7 livres (atendimentos encerrados); 3 e 5 nunca usadas; 4 e 6 ocupadas por pedido aprovado
  select e into x from jsonb_array_elements(r -> 'mesas') e where (e ->> 'numero')::int = 2;
  perform t.igual((x ->> 'disponivel')::boolean, true, 'mesa 2 livre');
  select e into x from jsonb_array_elements(r -> 'mesas') e where (e ->> 'numero')::int = 3;
  perform t.igual((x ->> 'disponivel')::boolean, true, 'mesa 3 livre');
  select e into x from jsonb_array_elements(r -> 'mesas') e where (e ->> 'numero')::int = 4;
  perform t.igual((x ->> 'disponivel')::boolean, false, 'mesa 4 ocupada (pedido aprovado)');
  select e into x from jsonb_array_elements(r -> 'mesas') e where (e ->> 'numero')::int = 6;
  perform t.igual((x ->> 'disponivel')::boolean, false, 'mesa 6 ocupada (pedido aprovado)');
  perform t.igual(jsonb_path_exists(r -> 'mesas', '$[*] ? (@.numero == 1)'), false, 'mesa desativada não aparece');
  perform t.igual(jsonb_path_exists(r -> 'mesas', '$[*] ? (exists(@.id) || exists(@.consumo))'), false, 'só número e disponibilidade');
  perform t.igual(public.obter_apresentacao_publica('loja_tres'), null, 'empresa desativada não aparece');
  perform t.igual(public.obter_apresentacao_publica('nao_existe'), null, 'inexistente');
  -- quem só abriu o QR Code (sem pedido aprovado) não ocupa a mesa
  perform t.igual((public.identificar_cliente('loja_um', 5, 'Curioso') ->> 'comanda_id') is not null, true, 'curioso se identifica');
  r := public.obter_apresentacao_publica('loja_um');
  select e into x from jsonb_array_elements(r -> 'mesas') e where (e ->> 'numero')::int = 5;
  perform t.igual((x ->> 'disponivel')::boolean, true, 'mesa 5 continua disponível');
  perform t.dono();
end $$;
