-- 07 — Estoque com histórico de movimentos.
-- O estoque físico (produtos.estoque_qtd) só muda pela função ajustar_estoque() (ajustes manuais)
-- ou, na etapa de pedidos, pela baixa na entrega. Nenhum cliente edita esse campo diretamente.
begin;

create type public.tipo_movimento_estoque as enum (
  'saldo_inicial', 'reposicao', 'alteracao_quantidade', 'baixa_avaria', 'baixa_entrega'
);

create table public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete set null,
  nome_produto text not null,
  tipo public.tipo_movimento_estoque not null,
  variacao integer not null,
  saldo_apos integer not null,
  observacao text,
  usuario_id uuid references auth.users(id) on delete set null,
  -- clock_timestamp (e não now): lançamentos da mesma transação mantêm a ordem real.
  criado_em timestamptz not null default clock_timestamp(),
  constraint movimentos_variacao_nao_zero check (variacao <> 0),
  constraint movimentos_saldo_nao_negativo check (saldo_apos >= 0),
  constraint movimentos_observacao_tamanho check (observacao is null or char_length(observacao) <= 200)
);
create index movimentos_estoque_produto_idx on public.movimentos_estoque (produto_id, criado_em desc);
create index movimentos_estoque_empresa_idx on public.movimentos_estoque (estabelecimento_id, criado_em desc);

-- Histórico só cresce: não se edita nem se apaga. (A única mudança permitida é produto_id virar
-- nulo quando o produto é excluído; o nome do produto fica guardado no próprio movimento.)
create or replace function public.movimentos_estoque_imutavel()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'o histórico de estoque não pode ser apagado';
  end if;
  if new.estabelecimento_id is distinct from old.estabelecimento_id
     or new.nome_produto is distinct from old.nome_produto
     or new.tipo is distinct from old.tipo
     or new.variacao is distinct from old.variacao
     or new.saldo_apos is distinct from old.saldo_apos
     or new.observacao is distinct from old.observacao
     or new.usuario_id is distinct from old.usuario_id
     or new.criado_em is distinct from old.criado_em
     or (new.produto_id is distinct from old.produto_id and new.produto_id is not null) then
    raise exception 'o histórico de estoque não pode ser alterado';
  end if;
  return new;
end;
$$;
create trigger movimentos_estoque_imutavel
  before update or delete on public.movimentos_estoque
  for each row execute function public.movimentos_estoque_imutavel();

alter table public.movimentos_estoque enable row level security;
revoke all on table public.movimentos_estoque from anon, authenticated;
grant select on table public.movimentos_estoque to authenticated;
grant all on table public.movimentos_estoque to service_role;
create policy "ver movimentos de estoque" on public.movimentos_estoque
  for select to authenticated using (public.tem_acesso_estabelecimento(estabelecimento_id));

-- Produtos que já tinham estoque antes do histórico entram com um saldo inicial.
insert into public.movimentos_estoque (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, observacao)
select p.estabelecimento_id, p.id, p.nome, 'saldo_inicial', p.estoque_qtd, p.estoque_qtd, 'Saldo existente antes do histórico'
from public.produtos p
where p.estoque_qtd > 0
  and not exists (select 1 from public.movimentos_estoque m where m.produto_id = p.id);

-- Clientes deixam de editar o estoque físico diretamente: sem permissão na coluna estoque_qtd.
revoke insert, update on table public.produtos from authenticated;
grant insert (id, estabelecimento_id, categoria_id, nome, descricao, preco_venda_centavos,
              preco_custo_centavos, disponivel, foto_path, inativar_ao_zerar_estoque)
  on table public.produtos to authenticated;
grant update (categoria_id, nome, descricao, preco_venda_centavos, preco_custo_centavos,
              disponivel, foto_path, inativar_ao_zerar_estoque)
  on table public.produtos to authenticated;

-- Ajuste manual de estoque. Devolve o novo saldo.
--   saldo_inicial        define o saldo (só uma vez, enquanto não há histórico)
--   reposicao            soma (quantidade > 0)
--   alteracao_quantidade define o novo saldo (exige motivo)
--   baixa_avaria         subtrai (quantidade > 0, exige motivo, não deixa negativar)
-- Se a baixa zerar o estoque e o produto estiver com "inativar ao zerar" ligado, ele fica indisponível.
create or replace function public.ajustar_estoque(
  _produto uuid,
  _tipo public.tipo_movimento_estoque,
  _quantidade integer,
  _observacao text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  atual integer;
  novo integer;
  obs text := nullif(btrim(coalesce(_observacao, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select id, estabelecimento_id, nome, estoque_qtd, inativar_ao_zerar_estoque
    into p
    from public.produtos
   where id = _produto
   for update;
  if not found then
    raise exception 'produto_nao_encontrado';
  end if;
  if not public.tem_acesso_estabelecimento(p.estabelecimento_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if _tipo = 'baixa_entrega' then
    raise exception 'tipo_invalido';
  end if;
  if _quantidade is null or _quantidade < 0 then
    raise exception 'quantidade_invalida';
  end if;
  if obs is not null and char_length(obs) > 200 then
    raise exception 'observacao_invalida';
  end if;

  atual := p.estoque_qtd;
  if _tipo = 'saldo_inicial' then
    if exists (select 1 from public.movimentos_estoque where produto_id = _produto) then
      raise exception 'saldo_inicial_ja_registrado';
    end if;
    novo := _quantidade;
  elsif _tipo = 'reposicao' then
    if _quantidade <= 0 then raise exception 'quantidade_invalida'; end if;
    novo := atual + _quantidade;
  elsif _tipo = 'alteracao_quantidade' then
    if obs is null then raise exception 'observacao_obrigatoria'; end if;
    novo := _quantidade;
  else -- baixa_avaria
    if _quantidade <= 0 then raise exception 'quantidade_invalida'; end if;
    if obs is null then raise exception 'observacao_obrigatoria'; end if;
    if _quantidade > atual then raise exception 'estoque_insuficiente'; end if;
    novo := atual - _quantidade;
  end if;

  if novo > 1000000 then raise exception 'limite_excedido'; end if;
  if novo = atual then raise exception 'sem_alteracao'; end if;

  update public.produtos
     set estoque_qtd = novo,
         disponivel = case when novo = 0 and novo < atual and p.inativar_ao_zerar_estoque then false else disponivel end
   where id = _produto;

  insert into public.movimentos_estoque
    (estabelecimento_id, produto_id, nome_produto, tipo, variacao, saldo_apos, observacao, usuario_id)
  values
    (p.estabelecimento_id, p.id, p.nome, _tipo, novo - atual, novo, obs, (select auth.uid()));

  return novo;
end;
$$;
revoke all on function public.ajustar_estoque(uuid, public.tipo_movimento_estoque, integer, text) from public, anon;
grant execute on function public.ajustar_estoque(uuid, public.tipo_movimento_estoque, integer, text) to authenticated;

commit;
