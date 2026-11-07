-- 16 · Limite de comandas abertas por mesa, definido no cadastro da mesa.
-- Rodar depois do script 15. Antes era fixo em 10; agora cada mesa tem o seu limite (padrão 10, até 20).
-- Mesas existentes continuam com 10.

alter table public.mesas add column if not exists max_comandas integer not null default 10;
alter table public.mesas drop constraint if exists mesas_max_comandas_faixa;
alter table public.mesas add constraint mesas_max_comandas_faixa check (max_comandas between 1 and 20);

-- Mesma função do script 08, usando o limite da mesa (as permissões continuam as mesmas).
create or replace function public.identificar_cliente(_slug text, _numero integer, _nome text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  e record; m record; s record;
  nome text := btrim(coalesce(_nome, ''));
  tok text; cid uuid; n integer;
begin
  if char_length(nome) not between 1 and 40 then raise exception 'nome_invalido'; end if;
  select id into e from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then raise exception 'empresa_indisponivel'; end if;
  -- trava a mesa: duas pessoas chegando juntas não criam duas sessões
  select id, numero, max_comandas into m from public.mesas
   where estabelecimento_id = e.id and numero = _numero and ativa for update;
  if not found then raise exception 'mesa_indisponivel'; end if;

  -- limpeza preguiçosa: comanda aberta sem nenhum pedido há mais de 45 min é encerrada,
  -- e a sessão sem comandas abertas e sem pedidos também (evita "ocupar" mesa à toa)
  update public.comandas c set status = 'paga', fechada_em = clock_timestamp()
   where c.mesa_id = m.id and c.status = 'aberta'
     and c.aberta_em < clock_timestamp() - public.validade_pedido_pendente()
     and not exists (select 1 from public.pedidos p where p.comanda_id = c.id);
  update public.sessoes_mesa x set status = 'encerrada', encerrada_em = clock_timestamp()
   where x.mesa_id = m.id and x.status <> 'encerrada'
     and not exists (select 1 from public.comandas c where c.sessao_id = x.id and c.status = 'aberta')
     and not exists (select 1 from public.pedidos p where p.sessao_id = x.id);

  select * into s from public.sessoes_mesa where mesa_id = m.id and status <> 'encerrada';
  if not found then
    insert into public.sessoes_mesa (estabelecimento_id, mesa_id) values (e.id, m.id) returning * into s;
  end if;
  if s.status = 'fechamento' then raise exception 'mesa_em_fechamento'; end if;

  select count(*) into n from public.comandas where sessao_id = s.id and status = 'aberta';
  if n >= m.max_comandas then raise exception 'muitos_clientes'; end if;

  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.comandas (estabelecimento_id, sessao_id, mesa_id, mesa_numero, cliente_nome, token_hash)
  values (e.id, s.id, m.id, m.numero, nome, public.hash_token(tok))
  returning id into cid;
  return jsonb_build_object('comanda_id', cid, 'token', tok);
end;
$$;
