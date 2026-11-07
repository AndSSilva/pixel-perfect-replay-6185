-- Limite de comandas abertas definido em cada mesa (script 16).
do $$
declare
  A uuid := '10000000-0000-4000-8000-000000000002';
  B uuid := '10000000-0000-4000-8000-000000000003';
  E1 uuid := '20000000-0000-4000-8000-000000000001';
  MID uuid; n int;
begin
  perform t.dono();
  perform t.igual((select max_comandas from public.mesas where numero = 20 and estabelecimento_id = E1), 10, 'padrão é 10');

  -- o administrador da empresa cria mesa com limite 2
  perform t.como(A);
  insert into public.mesas (estabelecimento_id, numero, max_comandas) values (E1, 31, 2) returning id into MID;
  perform t.anonimo();
  perform public.identificar_cliente('loja_um', 31, 'Um');
  perform public.identificar_cliente('loja_um', 31, 'Dois');
  perform t.erro($q$select public.identificar_cliente('loja_um', 31, 'Três')$q$, 'muitos_clientes');

  -- aumentar o limite libera mais uma comanda
  perform t.como(A);
  update public.mesas set max_comandas = 3 where id = MID;
  perform t.anonimo();
  perform public.identificar_cliente('loja_um', 31, 'Três');
  perform t.erro($q$select public.identificar_cliente('loja_um', 31, 'Quatro')$q$, 'muitos_clientes');

  -- faixa válida: 1 a 20
  perform t.como(A);
  begin update public.mesas set max_comandas = 0 where id = MID; raise exception 'deveria falhar';
  exception when check_violation then null; end;
  begin update public.mesas set max_comandas = 21 where id = MID; raise exception 'deveria falhar';
  exception when check_violation then null; end;
  update public.mesas set max_comandas = 20 where id = MID;

  -- administrador de outra empresa não altera
  perform t.como(B);
  update public.mesas set max_comandas = 1 where id = MID; get diagnostics n = row_count;
  perform t.igual(n, 0, 'outra empresa não altera o limite');
  perform t.dono();
end $$;
