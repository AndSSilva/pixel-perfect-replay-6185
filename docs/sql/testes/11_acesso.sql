-- Quem enxerga e altera quais empresas; slug; master único; dados públicos.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003'; AB uuid := '10000000-0000-4000-8000-000000000004';
  Z uuid := '10000000-0000-4000-8000-000000000005'; I uuid := '10000000-0000-4000-8000-000000000006';
  E1 uuid := '20000000-0000-4000-8000-000000000001'; E2 uuid := '20000000-0000-4000-8000-000000000002';
  n int;
begin
  perform t.como(M);  select count(*) into n from public.estabelecimentos; perform t.igual(n, 3, 'master vê todas as empresas');
  perform t.como(A);  select count(*) into n from public.estabelecimentos; perform t.igual(n, 1, 'A vê só a sua');
  perform t.igual((select id from public.estabelecimentos), E1, 'A vê a E1');
  perform t.como(B);  select count(*) into n from public.estabelecimentos; perform t.igual(n, 1, 'B vê só a sua');
  perform t.como(AB); select count(*) into n from public.estabelecimentos; perform t.igual(n, 2, 'AB vê as duas');
  perform t.como(Z);  select count(*) into n from public.estabelecimentos; perform t.igual(n, 0, 'Z (sem vínculo) não vê nenhuma');
  perform t.como(I);  select count(*) into n from public.estabelecimentos; perform t.igual(n, 0, 'I (empresa inativa) não vê nada');
  perform t.anonimo(); perform t.erro('select * from public.estabelecimentos', 'permission denied');

  -- escrita: só o master
  perform t.como(A);
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('nova_loja', 'Nova')$q$, 'row-level security');
  update public.estabelecimentos set nome = 'Hackeada' where id = E2; get diagnostics n = row_count;
  perform t.igual(n, 0, 'A não altera a E2 (0 linhas)');
  perform t.erro('delete from public.estabelecimentos', 'permission denied');
  perform t.erro($q$insert into public.estabelecimento_membros values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002')$q$, 'row-level security');

  -- vínculos: cada um vê os seus; master vê todos
  select count(*) into n from public.estabelecimento_membros; perform t.igual(n, 1, 'A vê só o próprio vínculo');
  perform t.como(M);  select count(*) into n from public.estabelecimento_membros; perform t.igual(n, 5, 'master vê todos os vínculos');

  -- master cria empresa; slug: formato, reservado, imutável
  perform t.como(M);
  insert into public.estabelecimentos (slug, nome) values ('adega_sao_joao', 'Adega São João');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('admin', 'X1')$q$, 'slug_reservado');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('brand', 'X2')$q$, 'slug_reservado');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('Abc_def', 'X3')$q$, 'slug_formato');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('ab', 'X4')$q$, 'slug_formato');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('_abc', 'X5')$q$, 'slug_formato');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('com espaco', 'X6')$q$, 'slug_formato');
  perform t.erro($q$insert into public.estabelecimentos (slug, nome) values ('loja_um', 'Duplicada')$q$, 'estabelecimentos_slug_unico');
  perform t.erro($q$update public.estabelecimentos set slug = 'outro_endereco' where slug = 'loja_um'$q$, 'não pode ser alterado');
  update public.estabelecimentos set nome = 'Loja Um Renomeada' where id = E1; get diagnostics n = row_count;
  perform t.igual(n, 1, 'master renomeia empresa');

  -- master único
  perform t.dono();
  perform t.erro($q$insert into public.perfis_acesso (user_id, papel) values ('10000000-0000-4000-8000-000000000005', 'master')$q$, 'duplicate key');
  perform t.erro($q$update public.perfis_acesso set papel = 'master' where user_id = '10000000-0000-4000-8000-000000000002'$q$, 'duplicate key');

  -- dados públicos mínimos (sem listar a tabela)
  perform t.anonimo();
  perform t.igual((select count(*) from public.obter_estabelecimento_publico('LOJA_DOIS'))::int, 1, 'anon acha empresa ativa por slug (sem diferenciar maiúscula)');
  perform t.igual((select count(*) from public.obter_estabelecimento_publico('loja_tres'))::int, 0, 'empresa inativa não aparece');
  perform t.igual((select count(*) from public.obter_estabelecimento_publico('nao_existe'))::int, 0, 'slug inexistente');
  perform t.dono();
end $$;
