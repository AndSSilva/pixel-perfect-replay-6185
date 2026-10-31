-- Isolamento entre empresas em categorias, produtos e mesas; proteção do estoque físico.
do $$
declare
  M uuid := '10000000-0000-4000-8000-000000000001'; A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003'; AB uuid := '10000000-0000-4000-8000-000000000004';
  I uuid := '10000000-0000-4000-8000-000000000006';
  E1 uuid := '20000000-0000-4000-8000-000000000001'; E2 uuid := '20000000-0000-4000-8000-000000000002';
  E3 uuid := '20000000-0000-4000-8000-000000000003';
  C1 uuid := '40000000-0000-4000-8000-000000000001'; C2 uuid := '40000000-0000-4000-8000-000000000002';
  P1 uuid := '30000000-0000-4000-8000-000000000001';
  n int;
begin
  -- A cria na própria empresa; B cria na dele
  perform t.como(A);
  insert into public.categorias (id, estabelecimento_id, nome) values (C1, E1, 'Cervejas');
  perform t.erro(format('insert into public.categorias (estabelecimento_id, nome) values (%L, %L)', E2, 'Invasão'), 'row-level security');
  perform t.erro(format('insert into public.categorias (estabelecimento_id, nome) values (%L, %L)', E1, ' cervejas '), 'categorias_nome_unico');
  perform t.como(B);
  insert into public.categorias (id, estabelecimento_id, nome) values (C2, E2, 'Cervejas');  -- mesmo nome em outra empresa: ok

  -- leitura isolada
  perform t.como(A);  select count(*) into n from public.categorias; perform t.igual(n, 1, 'A vê só as categorias da E1');
  perform t.como(B);  select count(*) into n from public.categorias; perform t.igual(n, 1, 'B vê só as da E2');
  perform t.como(AB); select count(*) into n from public.categorias; perform t.igual(n, 2, 'AB vê as duas');
  perform t.como(M);  select count(*) into n from public.categorias; perform t.igual(n, 2, 'master vê todas');

  -- A não altera nem apaga a categoria da E2 (a regra esconde a linha)
  perform t.como(A);
  update public.categorias set nome = 'Hackeada' where id = C2; get diagnostics n = row_count; perform t.igual(n, 0, 'A não altera categoria da E2');
  delete from public.categorias where id = C2; get diagnostics n = row_count; perform t.igual(n, 0, 'A não apaga categoria da E2');
  perform t.erro(format('update public.categorias set estabelecimento_id = %L where id = %L', E2, C1), 'não é permitido mover');

  -- produtos: categoria precisa ser da mesma empresa
  perform t.erro(format('insert into public.produtos (estabelecimento_id, categoria_id, nome, preco_venda_centavos) values (%L, %L, %L, 100)', E1, C2, 'Cruzado'), 'violates foreign key');
  insert into public.produtos (id, estabelecimento_id, categoria_id, nome, preco_venda_centavos, preco_custo_centavos)
    values (P1, E1, C1, 'Heineken', 1200, 700);
  perform t.igual((select estoque_qtd from public.produtos where id = P1), 0, 'produto novo começa com estoque 0');
  perform t.erro(format('insert into public.produtos (estabelecimento_id, categoria_id, nome, preco_venda_centavos, estoque_qtd) values (%L, %L, %L, 100, 50)', E1, C1, 'Com estoque'), 'permission denied');
  perform t.erro(format('update public.produtos set estoque_qtd = 99 where id = %L', P1), 'permission denied');
  perform t.erro(format('update public.produtos set estabelecimento_id = %L where id = %L', E2, P1), 'permission denied');
  update public.produtos set nome = 'Heineken LN', preco_venda_centavos = 1300, disponivel = false where id = P1; get diagnostics n = row_count;
  perform t.igual(n, 1, 'A edita dados do produto');
  perform t.erro(format('insert into public.produtos (estabelecimento_id, categoria_id, nome, preco_venda_centavos, foto_path) values (%L, %L, %L, 100, %L)', E1, C1, 'Foto alheia', E2 || '/x.jpg'), 'produtos_foto_pasta');
  perform t.erro(format('insert into public.produtos (estabelecimento_id, categoria_id, nome, preco_venda_centavos) values (%L, %L, %L, -5)', E1, C1, 'Preço negativo'), 'produtos_preco_venda');

  perform t.como(B);  select count(*) into n from public.produtos; perform t.igual(n, 0, 'B não vê produtos da E1');
  update public.produtos set nome = 'Hackeado' where id = P1; get diagnostics n = row_count; perform t.igual(n, 0, 'B não altera produto da E1');

  -- categoria com produtos não pode ser apagada; depois de mover, pode
  perform t.como(A);
  perform t.erro(format('delete from public.categorias where id = %L', C1), 'violates foreign key');
  insert into public.categorias (id, estabelecimento_id, nome) values ('40000000-0000-4000-8000-000000000003', E1, 'Outras');
  update public.produtos set categoria_id = '40000000-0000-4000-8000-000000000003' where categoria_id = C1;
  delete from public.categorias where id = C1; get diagnostics n = row_count; perform t.igual(n, 1, 'categoria vazia é apagada');

  -- mesas
  insert into public.mesas (estabelecimento_id, numero) values (E1, 1), (E1, 2);
  perform t.erro(format('insert into public.mesas (estabelecimento_id, numero) values (%L, 1)', E1), 'mesas_numero_unico');
  perform t.erro(format('insert into public.mesas (estabelecimento_id, numero) values (%L, 0)', E1), 'mesas_numero_faixa');
  perform t.erro(format('insert into public.mesas (estabelecimento_id, numero) values (%L, 10000)', E1), 'mesas_numero_faixa');
  perform t.erro(format('insert into public.mesas (estabelecimento_id, numero) values (%L, 1)', E2), 'row-level security');
  perform t.como(B);  insert into public.mesas (estabelecimento_id, numero) values (E2, 1);  -- mesmo número em outra empresa: ok
  select count(*) into n from public.mesas; perform t.igual(n, 1, 'B vê só a mesa da E2');
  perform t.como(A);  select count(*) into n from public.mesas; perform t.igual(n, 2, 'A vê só as mesas da E1');
  update public.mesas set ativa = false where numero = 1; get diagnostics n = row_count; perform t.igual(n, 1, 'A desativa a própria mesa (só a da E1)');

  -- empresa inativa: nem o administrador dela escreve (e o master continua podendo)
  perform t.como(I);
  perform t.erro(format('insert into public.categorias (estabelecimento_id, nome) values (%L, %L)', E3, 'X'), 'row-level security');
  perform t.como(M);
  insert into public.categorias (estabelecimento_id, nome) values (E3, 'Configuração do master');

  -- anônimo não toca em nada
  perform t.anonimo();
  perform t.erro('select * from public.categorias', 'permission denied');
  perform t.erro('select * from public.produtos', 'permission denied');
  perform t.erro('select * from public.mesas', 'permission denied');
  perform t.dono();
end $$;
