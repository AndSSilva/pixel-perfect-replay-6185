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
  update public.estabelecimentos set descricao = 'Lounge com sinuca e narguilé', destaques = array['🎱 Sinuca', '💨 Narguile', '🍻 Bebidas'],
    horario_funcionamento = E'qua a qui 19:00 às 02:00\nsex a dom 19:00 às 03:00', endereco = 'Rua X 56, Porto Alegre',
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
  perform t.erro(format('update public.estabelecimentos set horario_funcionamento = %L where id = %L', repeat('x', 301), E1), 'horario_tamanho');
  perform t.erro(format('update public.estabelecimentos set endereco = %L where id = %L', repeat('x', 201), E1), 'endereco_tamanho');
  perform t.erro(format('update public.estabelecimentos set destaques = array_fill(%L::text, array[9]) where id = %L', 'a', E1), 'destaques_validos');
  perform t.erro(format('update public.estabelecimentos set destaques = array[%L] where id = %L', '   ', E1), 'destaques_validos');
  perform t.erro(format('update public.estabelecimentos set destaques = array[%L] where id = %L', repeat('x', 61), E1), 'destaques_validos');
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
  perform t.igual(r #>> '{empresa,endereco}', 'Rua X 56, Porto Alegre', 'endereço');
  perform t.igual(jsonb_array_length(r #> '{empresa,destaques}'), 3, 'destaques');
  perform t.igual(r #>> '{empresa,destaques,0}', '🎱 Sinuca', 'emoji preservado');
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
