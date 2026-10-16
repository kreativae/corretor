#!/bin/sh
# Copia o banco do Neon para o Postgres do Coolify, com as empresas (esquemas
# t_* e seus usuários). Pode rodar quantas vezes quiser: cada execução apaga o
# destino e copia de novo. O Neon não é alterado.
#
# No servidor, dentro de um container com o cliente do Postgres 18 (a versão do Neon):
#   curl -fsSLO https://raw.githubusercontent.com/kreativae/corretor/claude/vigilant-hopper-4d8t6r/deploy/migrate-neon.sh
#   docker run --rm -it --network coolify -v "$PWD":/w -w /w postgres:18-alpine sh migrate-neon.sh
set -eu

printf "URL do Neon (conexão DIRETA, sem -pooler): "; stty -echo 2>/dev/null || true; read -r SRC; stty echo 2>/dev/null || true; echo
printf "URL do Postgres do Coolify (interna): ";     stty -echo 2>/dev/null || true; read -r DST; stty echo 2>/dev/null || true; echo

echo "== Origem:  $(psql "$SRC" -Atc "select current_user || ' · ' || version()")"
echo "== Destino: $(psql "$DST" -Atc "select current_user || ' · ' || version()")"
OWNER=$(psql "$SRC" -Atc "select current_user")

printf "Isto APAGA tudo no destino e copia o Neon. Digite SIM para continuar: "; read -r OK
[ "$OK" = "SIM" ] || { echo "Cancelado."; exit 1; }

echo "== Limpando o destino"
psql "$DST" -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$ DECLARE s text; BEGIN
  FOR s IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 't\_%' LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', s);
  END LOOP;
END $$;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "== Usuários: dono ($OWNER) e um por empresa"
{
  echo "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$OWNER') THEN CREATE ROLE \"$OWNER\" NOLOGIN; END IF; END \$\$;"
  echo "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'neon_superuser') THEN CREATE ROLE neon_superuser NOLOGIN; END IF; END \$\$;"
  psql "$SRC" -At <<'SQL'
SELECT format(
  'DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = %L) THEN CREATE ROLE %I LOGIN; END IF; END $$;'
  ' ALTER ROLE %I WITH LOGIN PASSWORD %L; ALTER ROLE %I SET search_path = %I;',
  db_user, db_user, db_user, db_password, db_user, schema_name)
FROM tenants WHERE db_user IS NOT NULL;
SQL
} | psql "$DST" -q -v ON_ERROR_STOP=1

echo "== Copiando dados (pode levar alguns minutos)"
pg_dump "$SRC" --no-subscriptions --no-publications -f /tmp/neon.sql
psql "$DST" -q -f /tmp/neon.sql > /dev/null 2> /tmp/erros.log || true

echo "== Conferindo"
psql "$SRC" -At -c "select count(*) from tenants" > /tmp/a
psql "$DST" -At -c "select count(*) from tenants" > /tmp/b
echo "Empresas — Neon: $(cat /tmp/a) · Coolify: $(cat /tmp/b)"
echo "Tabelas — Neon: $(psql "$SRC" -Atc "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')") · Coolify: $(psql "$DST" -Atc "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")"

ERR=$(grep -c ERROR /tmp/erros.log || true)
echo "Erros na importação: $ERR"
[ "$ERR" = "0" ] || { echo "-- Primeiros erros (sem dados sensíveis):"; grep ERROR /tmp/erros.log | sort | uniq -c | head -20; }
echo "Pronto."
