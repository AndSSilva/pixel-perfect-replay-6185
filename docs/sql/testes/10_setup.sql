-- Ajudantes de teste e dados fixos (executados como dono do banco).
create schema t;
grant usage on schema t to public;

create function t.erro(_sql text, _trecho text) returns void language plpgsql as $$
begin
  begin
    execute _sql;
  exception when others then
    if position(_trecho in sqlerrm) = 0 then
      raise exception 'erro inesperado: "%" (esperava conter "%") em: %', sqlerrm, _trecho, _sql;
    end if;
    return;
  end;
  raise exception 'deveria ter falhado, mas passou: %', _sql;
end $$;

create function t.igual(_obtido anyelement, _esperado anyelement, _desc text) returns void language plpgsql as $$
begin
  if _obtido is distinct from _esperado then
    raise exception 'FALHOU: % (obtido=%, esperado=%)', _desc, _obtido, _esperado;
  end if;
end $$;

create function t.dono() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;
create function t.como(_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', _uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t.anonimo() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;
grant execute on all functions in schema t to public;

-- Pessoas: M=master, A=admin da E1, B=admin da E2, AB=admin de E1 e E2, Z=admin sem empresa, I=admin da E3 (inativa)
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'm@x'), ('10000000-0000-4000-8000-000000000002', 'a@x'),
  ('10000000-0000-4000-8000-000000000003', 'b@x'), ('10000000-0000-4000-8000-000000000004', 'ab@x'),
  ('10000000-0000-4000-8000-000000000005', 'z@x'), ('10000000-0000-4000-8000-000000000006', 'i@x');
insert into public.perfis_acesso (user_id, papel, deve_trocar_senha) values
  ('10000000-0000-4000-8000-000000000001', 'master', false),
  ('10000000-0000-4000-8000-000000000002', 'admin', false),
  ('10000000-0000-4000-8000-000000000003', 'admin', false),
  ('10000000-0000-4000-8000-000000000004', 'admin', false),
  ('10000000-0000-4000-8000-000000000005', 'admin', true),
  ('10000000-0000-4000-8000-000000000006', 'admin', false);
insert into public.estabelecimentos (id, slug, nome, ativo) values
  ('20000000-0000-4000-8000-000000000001', 'loja_um', 'Loja Um', true),
  ('20000000-0000-4000-8000-000000000002', 'loja_dois', 'Loja Dois', true),
  ('20000000-0000-4000-8000-000000000003', 'loja_tres', 'Loja Três', false);
insert into public.estabelecimento_membros (estabelecimento_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006');
