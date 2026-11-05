-- 13 — A apresentação da empresa passa a ser editada pelo administrador (em Configurações).
--
-- O master continua cadastrando nome, endereço (slug), logo e cores. Apresentação, WhatsApp, Instagram,
-- endereço físico, horário por dia e intervalo ficam com os administradores da própria empresa, pela função
-- `atualizar_apresentacao` (o administrador NÃO ganha permissão de alterar a tabela: só estes campos).
-- Acrescenta o intervalo de atendimento (um só, vale para todos os dias abertos).
--
-- `intervalo` = null (sem intervalo) ou {"inicio": "12:00", "fim": "14:00"}. Rodar depois do 12.
begin;

alter table public.estabelecimentos add column intervalo jsonb;

-- Atenção: chave ausente dá NULL e uma regra CHECK com NULL passa; por isso o coalesce(…, false).
create or replace function public.intervalo_valido(_i jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select _i is null or coalesce(
    jsonb_typeof(_i) = 'object'
    and (_i ->> 'inicio') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and (_i ->> 'fim') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and (_i ->> 'inicio') <> (_i ->> 'fim'), false)
$$;
revoke all on function public.intervalo_valido(jsonb) from public, anon;
grant execute on function public.intervalo_valido(jsonb) to authenticated, service_role;

-- Corrige o horário do script 12: um dia sem "abre" ou "fecha" (ex.: {"abre":"19:00"}) passava na validação.
create or replace function public.horarios_validos(_h jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select _h is null or (
    jsonb_typeof(_h) = 'array' and jsonb_array_length(_h) = 7
    and not exists (
      select 1 from jsonb_array_elements(_h) e
       where not coalesce(
         jsonb_typeof(e) = 'null'
         or (jsonb_typeof(e) = 'object'
             and (e ->> 'abre') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             and (e ->> 'fecha') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             and (e ->> 'abre') <> (e ->> 'fecha')), false)
    )
  )
$$;

alter table public.estabelecimentos
  add constraint estabelecimentos_intervalo_valido check (public.intervalo_valido(intervalo));

create or replace function public.atualizar_apresentacao(
  _empresa uuid, _descricao text, _whatsapp text, _instagram text, _endereco text,
  _horarios jsonb, _intervalo jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.tem_acesso_estabelecimento(_empresa) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.estabelecimentos set
    descricao = nullif(btrim(_descricao), ''),
    whatsapp = nullif(btrim(_whatsapp), ''),
    instagram = nullif(btrim(_instagram), ''),
    endereco = nullif(btrim(_endereco), ''),
    horarios = case when jsonb_typeof(_horarios) = 'null' then null else _horarios end,
    intervalo = case when jsonb_typeof(_intervalo) = 'null' then null else _intervalo end
   where id = _empresa;
  if not found then
    raise exception 'empresa não encontrada' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.atualizar_apresentacao(uuid, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.atualizar_apresentacao(uuid, text, text, text, text, jsonb, jsonb) to authenticated;

create or replace function public.obter_apresentacao_publica(_slug text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare e record;
begin
  select id, slug, nome, cor_primaria, cor_secundaria, logo_url, descricao, whatsapp, instagram,
         endereco, horarios, intervalo
    into e from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then return null; end if;
  return jsonb_build_object(
    'empresa', jsonb_build_object(
      'nome', e.nome, 'slug', e.slug, 'cor_primaria', e.cor_primaria, 'cor_secundaria', e.cor_secundaria,
      'logo_url', e.logo_url, 'descricao', e.descricao, 'whatsapp', e.whatsapp, 'instagram', e.instagram,
      'endereco', e.endereco, 'horarios', e.horarios, 'intervalo', e.intervalo),
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', m.numero,
        'disponivel', not exists (
          select 1 from public.sessoes_mesa s
           where s.mesa_id = m.id and s.status <> 'encerrada'
             and exists (select 1 from public.pedidos p where p.sessao_id = s.id and p.status = 'confirmado'))
      ) order by m.numero)
      from public.mesas m where m.estabelecimento_id = e.id and m.ativa), '[]'::jsonb));
end;
$$;
revoke all on function public.obter_apresentacao_publica(text) from public;
grant execute on function public.obter_apresentacao_publica(text) to anon, authenticated;

commit;
