-- Fotos (armazenamento) e perfis de acesso.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003'; Z uuid := '10000000-0000-4000-8000-000000000005';
  E1 text := '20000000-0000-4000-8000-000000000001'; E2 text := '20000000-0000-4000-8000-000000000002';
  n int;
begin
  -- fotos: só na pasta da própria empresa
  perform t.como(A);
  insert into storage.objects (bucket_id, name) values ('produtos-fotos', E1 || '/p1-abc.jpg');
  perform t.erro(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'produtos-fotos', E2 || '/x.jpg'), 'row-level security');
  perform t.erro(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'produtos-fotos', 'lixo/x.jpg'), 'row-level security');
  perform t.erro(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'produtos-fotos', 'solto.jpg'), 'row-level security');
  perform t.erro(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'outro-bucket', E1 || '/x.jpg'), 'row-level security');
  perform t.como(B);
  delete from storage.objects where name = E1 || '/p1-abc.jpg'; get diagnostics n = row_count;
  perform t.igual(n, 0, 'B não apaga foto da E1');
  perform t.como(A);
  delete from storage.objects where name = E1 || '/p1-abc.jpg'; get diagnostics n = row_count;
  perform t.igual(n, 1, 'A apaga foto da própria empresa');
  perform t.como(M);
  insert into storage.objects (bucket_id, name) values ('produtos-fotos', E2 || '/mestre.jpg');  -- master em qualquer pasta

  -- perfis: ninguém edita o próprio papel nem a troca de senha; leitura só do próprio (master lê todos)
  perform t.como(A);
  perform t.erro('update public.perfis_acesso set papel = ''master''', 'permission denied');
  perform t.erro('update public.perfis_acesso set deve_trocar_senha = false', 'permission denied');
  perform t.erro('insert into public.perfis_acesso (user_id, papel) values (gen_random_uuid(), ''admin'')', 'permission denied');
  perform t.erro('delete from public.perfis_acesso', 'permission denied');
  select count(*) into n from public.perfis_acesso; perform t.igual(n, 1, 'A lê só o próprio perfil');
  perform t.como(M);  select count(*) into n from public.perfis_acesso; perform t.igual(n, 6, 'master lê todos os perfis');
  -- marcar_senha_trocada: só afeta o próprio perfil
  perform t.como(Z);
  perform t.igual((select deve_trocar_senha from public.perfis_acesso), true, 'Z ainda deve trocar a senha');
  perform public.marcar_senha_trocada();
  perform t.igual((select deve_trocar_senha from public.perfis_acesso), false, 'Z marcou a troca');
  perform t.como(A);
  perform t.igual((select deve_trocar_senha from public.perfis_acesso), false, 'A não foi afetado');
  perform t.anonimo();
  perform t.erro('select public.marcar_senha_trocada()', 'permission denied');
  perform t.dono();
end $$;
