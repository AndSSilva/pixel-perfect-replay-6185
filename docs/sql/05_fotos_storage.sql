-- 05 — Espaço das fotos dos produtos (leitura pública; escrita só de quem tem acesso à empresa).
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-fotos', 'produtos-fotos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Ler (listar) é necessário para apagar e trocar: sem uma regra de leitura, a linha fica invisível
-- e o PostgreSQL não deixa o DELETE/UPDATE agir. (Quem só abre a foto pelo endereço público não passa por aqui.)
create policy "ver fotos da empresa" on storage.objects for select to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.tem_acesso_estabelecimento(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "enviar fotos da empresa" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produtos-fotos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.tem_acesso_estabelecimento(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
create policy "trocar fotos da empresa" on storage.objects for update to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.tem_acesso_estabelecimento(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
create policy "apagar fotos da empresa" on storage.objects for delete to authenticated
  using (
    bucket_id = 'produtos-fotos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.tem_acesso_estabelecimento(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

commit;
