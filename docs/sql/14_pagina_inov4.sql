-- 14 — Página da INOV4 (link raiz, sem /empresa): textos editáveis pelo master.
--
-- Uma única linha (tabela `plataforma`) com apresentação, WhatsApp, Instagram, endereço, horário por dia e
-- intervalo. Logo, nome e cores da INOV4 ficam no código. Ninguém acessa a tabela diretamente: o público lê
-- pela função `obter_apresentacao_plataforma` e só o master grava, por `atualizar_apresentacao_plataforma`.
-- Rodar depois do 13 (usa `horarios_validos` e `intervalo_valido`).
begin;

create table public.plataforma (
  id boolean primary key default true check (id),   -- só pode existir uma linha
  descricao text,
  whatsapp text,
  instagram text,
  endereco text,
  horarios jsonb,
  intervalo jsonb,
  atualizado_em timestamptz not null default now(),
  constraint plataforma_descricao_tamanho check (descricao is null or char_length(descricao) <= 500),
  constraint plataforma_endereco_tamanho check (endereco is null or char_length(endereco) <= 200),
  constraint plataforma_whatsapp_formato check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  constraint plataforma_instagram_formato check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint plataforma_horarios_validos check (public.horarios_validos(horarios)),
  constraint plataforma_intervalo_valido check (public.intervalo_valido(intervalo))
);
insert into public.plataforma (id) values (true);

alter table public.plataforma enable row level security;
revoke all on table public.plataforma from anon, authenticated;
grant all on table public.plataforma to service_role;

create or replace function public.obter_apresentacao_plataforma()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'descricao', descricao, 'whatsapp', whatsapp, 'instagram', instagram,
    'endereco', endereco, 'horarios', horarios, 'intervalo', intervalo)
  from public.plataforma
$$;
revoke all on function public.obter_apresentacao_plataforma() from public;
grant execute on function public.obter_apresentacao_plataforma() to anon, authenticated;

create or replace function public.atualizar_apresentacao_plataforma(
  _descricao text, _whatsapp text, _instagram text, _endereco text, _horarios jsonb, _intervalo jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.eh_master() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.plataforma set
    descricao = nullif(btrim(_descricao), ''),
    whatsapp = nullif(btrim(_whatsapp), ''),
    instagram = nullif(btrim(_instagram), ''),
    endereco = nullif(btrim(_endereco), ''),
    horarios = case when jsonb_typeof(_horarios) = 'null' then null else _horarios end,
    intervalo = case when jsonb_typeof(_intervalo) = 'null' then null else _intervalo end,
    atualizado_em = now()
   where id;
end;
$$;
revoke all on function public.atualizar_apresentacao_plataforma(text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.atualizar_apresentacao_plataforma(text, text, text, text, jsonb, jsonb) to authenticated;

commit;
