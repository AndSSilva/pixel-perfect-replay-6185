create type public.papel_app as enum ('admin', 'master');

create table public.perfis_acesso (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel public.papel_app not null,
  deve_trocar_senha boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select on table public.perfis_acesso to authenticated;
grant all on table public.perfis_acesso to service_role;

alter table public.perfis_acesso enable row level security;
revoke all on table public.perfis_acesso from anon;
revoke insert, update, delete on table public.perfis_acesso from authenticated;
create policy "ler proprio perfil" on public.perfis_acesso
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.marcar_senha_trocada()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  update public.perfis_acesso
     set deve_trocar_senha = false, atualizado_em = now()
   where user_id = uid;
end;
$$;
revoke all on function public.marcar_senha_trocada() from public, anon;
grant execute on function public.marcar_senha_trocada() to authenticated;