-- 12 — Apresentação da empresa, versão 2: um só campo de apresentação, contatos e horário por dia.
--
-- Ajusta o script 11: remove "destaques" (a apresentação serve para os dois usos), troca o horário em
-- texto por horário estruturado (7 dias: abre/fecha, ou fechado) para calcular "aberto agora" e "hoje",
-- e acrescenta WhatsApp e Instagram. Pode ser rodado logo depois do 11 (ou do 11 já aplicado antes).
--
-- `horarios` = lista com 7 itens, índice 0 = domingo ... 6 = sábado; cada item é `null` (fechado) ou
-- {"abre": "19:00", "fecha": "02:00"} (fecha menor que abre = vira a madrugada do dia seguinte).
begin;

alter table public.estabelecimentos drop constraint if exists estabelecimentos_destaques_validos;
alter table public.estabelecimentos drop column if exists destaques;
alter table public.estabelecimentos drop column if exists horario_funcionamento;
drop function if exists public.destaques_validos(text[]);

alter table public.estabelecimentos
  add column whatsapp text,
  add column instagram text,
  add column horarios jsonb;

create or replace function public.horarios_validos(_h jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select _h is null or (
    jsonb_typeof(_h) = 'array' and jsonb_array_length(_h) = 7
    and not exists (
      select 1 from jsonb_array_elements(_h) e
       where not (
         jsonb_typeof(e) = 'null'
         or (jsonb_typeof(e) = 'object'
             and (e ->> 'abre') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             and (e ->> 'fecha') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             and (e ->> 'abre') <> (e ->> 'fecha'))
       ))
  )
$$;

alter table public.estabelecimentos
  add constraint estabelecimentos_whatsapp_formato check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  add constraint estabelecimentos_instagram_formato check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint estabelecimentos_horarios_validos check (public.horarios_validos(horarios));

-- usada pela regra (CHECK): quem grava empresas (authenticated/service_role) precisa poder executá-la
revoke all on function public.horarios_validos(jsonb) from public, anon;
grant execute on function public.horarios_validos(jsonb) to authenticated, service_role;

create or replace function public.obter_apresentacao_publica(_slug text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare e record;
begin
  select id, slug, nome, cor_primaria, cor_secundaria, logo_url, descricao, whatsapp, instagram,
         endereco, horarios
    into e from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then return null; end if;
  return jsonb_build_object(
    'empresa', jsonb_build_object(
      'nome', e.nome, 'slug', e.slug, 'cor_primaria', e.cor_primaria, 'cor_secundaria', e.cor_secundaria,
      'logo_url', e.logo_url, 'descricao', e.descricao, 'whatsapp', e.whatsapp, 'instagram', e.instagram,
      'endereco', e.endereco, 'horarios', e.horarios),
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
