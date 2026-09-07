#!/usr/bin/env bash
# Copia los datos de la base de dev a la de test (rigby-branch).
#
# Es un volcado de DATOS, no de esquema: el esquema de test se crea aplicando
# supabase/migrations en orden, igual que se creó el de dev. Copiar también el
# esquema con pg_dump se dejaría por el camino lo que vive fuera de `public`
# (el trigger sobre auth.users que crea el perfil, por ejemplo), y eso rompe de
# una forma que no se nota hasta que alguien se registra.
#
# Uso:
#   DEV_DB_URL='postgresql://postgres.xxx:PASS@aws-0-eu-west-3.pooler.supabase.com:5432/postgres' \
#   TEST_DB_URL='postgresql://postgres.yyy:PASS@aws-0-eu-west-3.pooler.supabase.com:5432/postgres' \
#   ./scripts/db-copy-dev-to-test.sh
#
# Las cadenas salen de: Dashboard > Project Settings > Database > Connection
# string > URI. Usa el puerto 5432 (session mode), no el 6543 del pooler de
# transacciones: pg_dump necesita sentencias preparadas.
#
# Opciones:
#   --dump-only   solo genera el .sql y para, sin tocar test
#   --yes         no pide confirmación (para CI; piénsalo dos veces)
set -euo pipefail

DUMP_ONLY=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dump-only) DUMP_ONLY=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

: "${DEV_DB_URL:?Falta DEV_DB_URL}"
if [ "$DUMP_ONLY" -eq 0 ]; then
  : "${TEST_DB_URL:?Falta TEST_DB_URL}"
  if [ "$DEV_DB_URL" = "$TEST_DB_URL" ]; then
    echo "DEV_DB_URL y TEST_DB_URL son la misma base. Aborto." >&2
    exit 1
  fi
fi

for bin in pg_dump psql; do
  command -v "$bin" >/dev/null || { echo "Falta $bin (paquete postgresql)." >&2; exit 1; }
done

# Muestra host y proyecto sin enseñar la contraseña por pantalla ni dejarla en
# el historial: el fallo caro aquí es apuntar el restore a producción.
host_of() { printf '%s' "$1" | sed -E 's#^[^:]+://[^@]*@##; s#/.*$##'; }

OUT_DIR="${OUT_DIR:-./.db-backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
AUTH_SQL="$OUT_DIR/dev-auth-$STAMP.sql"
PUBLIC_SQL="$OUT_DIR/dev-public-$STAMP.sql"

echo "Origen  (dev):  $(host_of "$DEV_DB_URL")"
[ "$DUMP_ONLY" -eq 0 ] && echo "Destino (test): $(host_of "$TEST_DB_URL")"
echo

echo "==> Volcando auth.users / auth.identities de dev"
pg_dump "$DEV_DB_URL" --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities > "$AUTH_SQL"

echo "==> Volcando los datos de public de dev"
pg_dump "$DEV_DB_URL" --data-only --no-owner --no-privileges \
  --schema=public > "$PUBLIC_SQL"

echo "    $AUTH_SQL   ($(du -h "$AUTH_SQL" | cut -f1))"
echo "    $PUBLIC_SQL ($(du -h "$PUBLIC_SQL" | cut -f1))"

if [ "$DUMP_ONLY" -eq 1 ]; then
  echo
  echo "Solo volcado, test intacto."
  exit 0
fi

echo
echo "Esto BORRA todo lo que haya ahora en $(host_of "$TEST_DB_URL") y lo"
echo "sustituye por la copia de dev. Las cuentas de test dejan de existir."
if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p 'Escribe "test" para continuar: ' reply
  [ "$reply" = "test" ] || { echo "Cancelado."; exit 1; }
fi

# Vaciar y cargar van en la MISMA transacción, y ese es el punto entero.
# Separarlas deja el peor final posible: el vaciado confirmado y la carga
# abortada a mitad, o sea test en blanco y la copia sin aplicar. TRUNCATE es
# transaccional en Postgres, así que cualquier error aquí deshace también el
# vaciado y test se queda exactamente como estaba.
#
# session_replication_role = replica apaga los triggers de clave ajena durante
# la carga: pg_dump ordena las tablas alfabéticamente, no por dependencias, así
# que sin esto un COPY a `attempts` antes que a `profiles` revienta. Va lo
# primero para que un rol sin permiso para tocarlo falle antes de vaciar nada.
WIPE_SQL="
delete from auth.users;
do \$\$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('truncate table public.%I restart identity cascade', t.tablename);
  end loop;
end \$\$;
"

# El esquema tiene que existir ya en test; si no, esto falla en el primer COPY.
echo "==> Vaciando y cargando test en una sola transacción"
if ! psql "$TEST_DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction \
     -c 'set session_replication_role = replica' \
     -c "$WIPE_SQL" \
     -f "$AUTH_SQL" -f "$PUBLIC_SQL"; then
  echo >&2
  echo "No se cargó nada: test se queda exactamente como estaba." >&2
  echo >&2
  echo 'Si el error es «permission denied to set parameter "session_replication_role"»,' >&2
  echo "conecta como el rol postgres del proyecto (Connection string > URI, no el" >&2
  echo "usuario de solo lectura): hace falta poder apagar los triggers de clave" >&2
  echo "ajena mientras se carga." >&2
  echo >&2
  echo "Si el error es que no existe una tabla, a test le faltan las migraciones:" >&2
  echo "aplica supabase/migrations en orden desde el SQL Editor y vuelve a lanzarlo." >&2
  exit 1
fi

echo
echo "Listo. Comprobación rápida:"
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from auth.users) as usuarios,
          (select count(*) from public.profiles) as perfiles;"
