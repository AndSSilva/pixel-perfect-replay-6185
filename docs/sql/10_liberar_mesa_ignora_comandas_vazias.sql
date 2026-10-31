-- 10 — Liberar mesa ignora comandas "vazias".
--
-- Regra (decidida com o dono do produto): a mesa só passa a contar como ocupada quando o atendente
-- APROVA o primeiro pedido. Quem apenas abriu o QR Code (ou fez um pedido que ninguém aprovou)
-- não pode impedir a liberação da mesa. Por isso, ao liberar, as comandas abertas sem nenhum pedido
-- confirmado e sem pedido pendente válido são encerradas automaticamente (sem consumo, sem cobrança).
-- A ocupação exibida no painel é calculada pelo app (sessão com ao menos um pedido confirmado).
-- Depende do 08_pedidos.sql.
begin;

create or replace function public.liberar_mesa(_mesa uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare m record; s record;
begin
  select * into m from public.mesas where id = _mesa for update;
  if not found then raise exception 'mesa_nao_encontrada'; end if;
  perform public.exigir_acesso(m.estabelecimento_id);
  select * into s from public.sessoes_mesa where mesa_id = _mesa and status <> 'encerrada' for update;
  if not found then raise exception 'mesa_sem_atendimento'; end if;
  if exists (select 1 from public.pedidos where sessao_id = s.id and status = 'pendente' and expira_em > clock_timestamp()) then
    raise exception 'pedidos_pendentes';
  end if;
  if exists (select 1 from public.itens_pedido i join public.pedidos p on p.id = i.pedido_id
              where p.sessao_id = s.id and p.status = 'confirmado' and i.status = 'aguardando') then
    raise exception 'itens_nao_entregues';
  end if;
  -- comandas sem pedido confirmado (e, a esta altura, sem pendente válido): encerra sem cobrança
  update public.comandas c set status = 'paga', fechada_em = clock_timestamp()
   where c.sessao_id = s.id and c.status = 'aberta'
     and not exists (select 1 from public.pedidos p where p.comanda_id = c.id and p.status = 'confirmado');
  if exists (select 1 from public.comandas where sessao_id = s.id and status = 'aberta') then
    raise exception 'comandas_em_aberto';
  end if;
  update public.sessoes_mesa set status = 'encerrada', encerrada_em = clock_timestamp() where id = s.id;
end;
$$;

-- a recriação preserva as permissões, mas reafirmamos para não depender disso
revoke all on function public.liberar_mesa(uuid) from public, anon;
grant execute on function public.liberar_mesa(uuid) to authenticated;

commit;
