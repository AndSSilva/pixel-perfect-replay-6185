#!/usr/bin/env bash
# Roda todos os scripts de docs/sql em um PostgreSQL novo e executa os testes de segurança/regras.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./docs/sql/testes/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=teste_sql_$$
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
run testes/00_harness.sql
for f in 01_perfis_acesso.sql 02_estabelecimentos.sql 03_master_unico_e_acesso.sql 04_catalogo.sql 05_fotos_storage.sql 06_inativar_ao_zerar.sql 07_estoque.sql; do
  echo "aplicando $f"; run "$f"
done
for t in testes/1*.sql; do echo "== $t"; run "$t"; done
echo "TODOS OS TESTES PASSARAM"
