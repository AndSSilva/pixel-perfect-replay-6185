-- 11 — Página de apresentação da empresa (/{slug}): textos, endereço, cores/logo e mesas disponíveis.
--
-- Só o master edita (a regra de UPDATE de `estabelecimentos` já é só do master). O logo fica em um espaço
-- público de leitura (`logos-empresas`) com escrita só do master. A página pública usa a função
-- `obter_apresentacao_publica`, que devolve apenas o necessário e a lista de mesas ativas com um sinal
-- "disponível" (sem expor consumo, clientes ou valores). Mesa disponível = ativa e sem atendimento
-- com pedido aprovado (mesma regra do painel: quem só abriu o QR Code não ocupa a mesa).
-- Depende do 08_pedidos.sql.
begin;

alter table public.estabelecimentos
  add column descricao text,
  add column destaques text[] not null default '{}',
  add column horario_funcionamento text,
  add column endereco text;

create or replace function public.destaques_validos(_d text[])
returns boolean language sql immutable set search_path = ''
as $$
  select coalesce(cardinality(_d), 0) <= 8
     and not exists (select 1 from unnest(_d) x where char_length(btrim(x)) not between 1 and 60)
$$;

alter table public.estabelecimentos
  add constraint estabelecimentos_descricao_tamanho check (descricao is null or char_length(descricao) <= 500),
  add constraint estabelecimentos_horario_tamanho check (horario_funcionamento is null or char_length(horario_funcionamento) <= 300),
  add constraint estabelecimentos_endereco_tamanho check (endereco is null or char_length(endereco) <= 200),
  add constraint estabelecimentos_destaques_validos check (public.destaques_validos(destaques)),
  add constraint estabelecimentos_logo_formato check (logo_url is null or (logo_url ~ '^https://' and char_length(logo_url) <= 500));

-- ------------------------------------------------------------------ logos (leitura pública; escrita só do master)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-empresas', 'logos-empresas', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "master ve logos" on storage.objects for select to authenticated
  using (bucket_id = 'logos-empresas' and public.eh_master());
create policy "master envia logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos-empresas' and public.eh_master());
create policy "master troca logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos-empresas' and public.eh_master());
create policy "master apaga logos" on storage.objects for delete to authenticated
  using (bucket_id = 'logos-empresas' and public.eh_master());

-- ------------------------------------------------------------------ função pública
create or replace function public.obter_apresentacao_publica(_slug text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare e record;
begin
  select id, slug, nome, cor_primaria, cor_secundaria, logo_url, descricao, destaques,
         horario_funcionamento, endereco
    into e from public.estabelecimentos where slug = lower(_slug) and ativo;
  if not found then return null; end if;
  return jsonb_build_object(
    'empresa', jsonb_build_object(
      'nome', e.nome, 'slug', e.slug, 'cor_primaria', e.cor_primaria, 'cor_secundaria', e.cor_secundaria,
      'logo_url', e.logo_url, 'descricao', e.descricao, 'destaques', to_jsonb(e.destaques),
      'horario_funcionamento', e.horario_funcionamento, 'endereco', e.endereco),
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

-- usada pela regra (CHECK): quem grava empresas (authenticated/service_role) precisa poder executá-la
revoke all on function public.destaques_validos(text[]) from public, anon;
grant execute on function public.destaques_validos(text[]) to authenticated, service_role;
revoke all on function public.obter_apresentacao_publica(text) from public;
grant execute on function public.obter_apresentacao_publica(text) to anon, authenticated;

commit;
