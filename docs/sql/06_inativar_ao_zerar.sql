-- 06 — Regra do produto: inativar automaticamente quando o estoque zerar (desligada por padrão).
alter table public.produtos
  add column inativar_ao_zerar_estoque boolean not null default false;
