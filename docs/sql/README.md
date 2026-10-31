# Scripts SQL do banco

Os scripts abaixo foram aplicados **na ordem** (editor de SQL do Cloud ou ferramenta de migração do Lovable).
Este diretório é o registro do que existe no banco; ao criar uma mudança nova, acrescente o próximo número.

| Script | O que faz |
|---|---|
| `01_perfis_acesso.sql` | Papéis `admin`/`master`, marcador de troca de senha (aplicado pelo Lovable) |
| `02_estabelecimentos.sql` | Empresas, vínculo administrador–empresa, dados públicos mínimos |
| `03_master_unico_e_acesso.sql` | Um único master e a regra `tem_acesso_estabelecimento()` |
| `04_catalogo.sql` | Categorias, produtos e mesas por empresa; `eh_membro` exige empresa ativa |
| `05_fotos_storage.sql` | Espaço público das fotos, escrita só de quem tem acesso à empresa |
| `06_inativar_ao_zerar.sql` | Coluna `produtos.inativar_ao_zerar_estoque` |
| `07_estoque.sql` | Histórico de movimentos e `ajustar_estoque()`; o estoque físico deixa de ser editável direto |
| `08_pedidos.sql` | Sessões de mesa, comandas, pedidos, itens, pagamentos e as funções do cliente e do painel |
| `09_caixa.sql` | Caixa: abertura, sangria/reforço, fechamento (esperado × contado); pagamento passa a exigir caixa aberto |

## Testes

`testes/run.sh` cria um banco PostgreSQL temporário que imita o Supabase (papéis `anon`/`authenticated`/`service_role`,
`auth.uid()`, armazenamento), aplica todos os scripts e roda testes de segurança e regras (isolamento entre empresas,
permissões por coluna, estoque, histórico imutável, fotos, perfis).

```sh
PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./docs/sql/testes/run.sh
```

Regra: todo script novo (e toda tabela nova) precisa de RLS ligado e de um teste de isolamento aqui.
