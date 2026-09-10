#!/usr/bin/env bash
# Clona la base de datos de dev entera sobre la de test.
#
# Entera de verdad: el esquema de `public` con sus funciones, políticas RLS y
# triggers, todos sus datos, y todo el contenido de `auth` — usuarios,
# identidades, sesiones, MFA, tokens — y de `storage` si existe. Al terminar,
# test es una copia de dev salvo por lo que no vive en la base de datos.
#
# Uso:
#   DEV_DB_URL='postgresql://postgres.xxx:PASS@aws-0-eu-west-3.pooler.supabase.com:5432/postgres' \
#   TEST_DB_URL='postgresql://postgres.yyy:PASS@aws-0-eu-west-3.pooler.supabase.com:5432/postgres' \
#   ./scripts/db-copy-dev-to-test.sh
#
# Las cadenas salen del botón **Connect** del proyecto, pestaña URI, con el
# puerto 5432 (session mode) y no el 6543: pg_dump necesita sentencias
# preparadas y el pooler de transacciones no las tiene.
#
# Opciones:
#   --dump-only   solo genera los .sql y para, sin tocar test
#   --yes         no pide confirmación (para CI; piénsalo dos veces)
#
# Lo que NO viaja, porque no es contenido de la base: los proveedores de
# acceso (Google, anónimo), el SMTP, las plantillas de correo y las tareas de
# pg_cron. Eso se configura en el panel del proyecto de test.
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
PUBLIC_SQL="$OUT_DIR/dev-public-$STAMP.sql"
AUTH_SQL="$OUT_DIR/dev-auth-$STAMP.sql"
STORAGE_SQL="$OUT_DIR/dev-storage-$STAMP.sql"
DROP_TRIGGERS_SQL="$OUT_DIR/dev-triggers-drop-$STAMP.sql"
MAKE_TRIGGERS_SQL="$OUT_DIR/dev-triggers-create-$STAMP.sql"

echo "Origen  (dev):  $(host_of "$DEV_DB_URL")"
[ "$DUMP_ONLY" -eq 0 ] && echo "Destino (test): $(host_of "$TEST_DB_URL")"
echo

# Los esquemas `auth` y `storage` los crea Supabase al provisionar el proyecto,
# y sus tablas ya existen en test con la versión que use su servicio de auth.
# Por eso de ellos se copian datos y nunca estructura: recrearlos machacaría
# unas tablas que no son nuestras y que el servicio espera tal cual están.
# Quedan fuera por lo mismo dos tablas que no son datos tuyos sino del propio
# servicio: `schema_migrations`, que dice en qué versión está, y `instances`,
# que identifica la instancia de GoTrue del proyecto. Machacar esa con la de
# dev deja la autenticación de test hablando de un proyecto que no es el suyo.
has_schema() {
  [ "$(psql "$1" -tAc "select 1 from information_schema.schemata where schema_name='$2'")" = "1" ]
}

# Los triggers que la app cuelga de auth.users (crear el perfil al registrarse,
# reflejar el estado de la cuenta) viven fuera de `public`, así que un volcado
# de `public` no se los lleva. Y hay que quitarlos de test antes de nada: sus
# funciones están en `public` y el volcado las va a borrar y recrear, cosa que
# Postgres no permite mientras un trigger dependa de ellas.
TRIGGERS_WHERE="not t.tgisinternal and n.nspname in ('auth','storage')"
# Con el search_path vacío, pg_get_triggerdef cualifica los nombres:
# `public.handle_new_user()` en vez de `handle_new_user()`. Importa porque el
# volcado de pg_dump deja el search_path vacío justo antes, así que un nombre
# a secas no resolvería y el trigger no se podría recrear.
echo "==> Leyendo los triggers que la app tiene fuera de public"
psql "$DEV_DB_URL" -tAq -c "set search_path=''" -c "
  select coalesce(string_agg(format('drop trigger if exists %I on %s;', t.tgname, c.oid::regclass), E'\n'), '')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where $TRIGGERS_WHERE" > "$DROP_TRIGGERS_SQL"
psql "$DEV_DB_URL" -tAq -c "set search_path=''" -c "
  select coalesce(string_agg(pg_get_triggerdef(t.oid) || ';', E'\n'), '')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where $TRIGGERS_WHERE" > "$MAKE_TRIGGERS_SQL"
echo "    $(grep -c 'create trigger' "$MAKE_TRIGGERS_SQL" || true) trigger(s)"

# --clean para que test parta de cero en `public`. Con privilegios: los GRANT a
# anon/authenticated son lo que deja hablar a PostgREST, y sin ellos la copia
# quedaría perfecta y completamente inaccesible desde la app.
echo "==> Volcando el esquema public de dev, con datos"
pg_dump "$DEV_DB_URL" --schema=public --clean --if-exists --no-owner > "$PUBLIC_SQL"

echo "==> Volcando los datos de auth de dev"
pg_dump "$DEV_DB_URL" --data-only --no-owner --no-privileges \
  --schema=auth --exclude-table=auth.schema_migrations \
  --exclude-table=auth.instances > "$AUTH_SQL"

if has_schema "$DEV_DB_URL" storage; then
  echo "==> Volcando los datos de storage de dev"
  pg_dump "$DEV_DB_URL" --data-only --no-owner --no-privileges \
    --schema=storage --exclude-table=storage.migrations > "$STORAGE_SQL"
else
  : > "$STORAGE_SQL"
fi

for f in "$PUBLIC_SQL" "$AUTH_SQL" "$STORAGE_SQL"; do
  echo "    $f ($(du -h "$f" | cut -f1))"
done

if [ "$DUMP_ONLY" -eq 1 ]; then
  echo
  echo "Solo volcado, test intacto."
  exit 0
fi

echo
echo "Esto BORRA la base de $(host_of "$TEST_DB_URL") entera — su esquema"
echo "public, sus usuarios y todo lo demás — y la sustituye por la copia de dev."
if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p 'Escribe "test" para continuar: ' reply
  [ "$reply" = "test" ] || { echo "Cancelado."; exit 1; }
fi

# Todo en una transacción, y ese es el punto entero: si algo falla a mitad,
# test se queda exactamente como estaba en vez de medio borrado. TRUNCATE y el
# DDL son transaccionales en Postgres, así que el rollback lo deshace todo.
#
# session_replication_role = replica apaga durante la carga los triggers de
# clave ajena (pg_dump ordena las tablas alfabéticamente, no por dependencias)
# y también los de la app, que si no crearían un perfil por cada usuario que
# entra por auth. Va lo primero para que un rol sin permiso para tocarlo falle
# antes de vaciar nada.
#
# `auth` se carga ANTES que `public`, y no es indiferente: el volcado de public
# recrea sus claves ajenas con ALTER TABLE ADD CONSTRAINT, que valida las filas
# en el acto recorriendo la tabla. Eso no es un trigger, así que replica no lo
# calla — con los usuarios todavía sin cargar, cada perfil apunta a un usuario
# que no existe y la validación tumba el clon entero.
WIPE_AUTH_SQL="
do \$\$
declare t record;
begin
  for t in select tablename from pg_tables
           where schemaname = 'auth'
             and tablename not in ('schema_migrations', 'instances')
  loop
    execute format('truncate table auth.%I cascade', t.tablename);
  end loop;
end \$\$;
"

echo "==> Clonando sobre test en una sola transacción"
if ! psql "$TEST_DB_URL" -q -v ON_ERROR_STOP=1 --single-transaction \
     -c 'set session_replication_role = replica' \
     -f "$DROP_TRIGGERS_SQL" \
     -c "$WIPE_AUTH_SQL" \
     -f "$AUTH_SQL" \
     -f "$PUBLIC_SQL" \
     -f "$STORAGE_SQL" \
     -f "$MAKE_TRIGGERS_SQL"; then
  echo >&2
  echo "No se cargó nada: test se queda exactamente como estaba." >&2
  echo >&2
  echo 'Si el error es «permission denied to set parameter "session_replication_role"»,' >&2
  echo "conecta como el rol postgres del proyecto (botón Connect > URI): hace falta" >&2
  echo "poder apagar los triggers mientras se carga." >&2
  echo >&2
  echo "Si el error habla de una columna que no existe en un esquema auth o storage," >&2
  echo "los dos proyectos van con versiones distintas del servicio: actualiza el más" >&2
  echo "atrasado desde el panel y vuelve a lanzarlo." >&2
  exit 1
fi

echo
echo "Listo. Comprobación rápida:"
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -c \
  "select (select count(*) from auth.users) as usuarios,
          (select count(*) from auth.identities) as identidades,
          (select count(*) from public.profiles) as perfiles;"
echo
echo "Recuerda que los proveedores de acceso, el SMTP y las tareas de pg_cron"
echo "no viajan en la base: configúralos en el panel del proyecto de test."
