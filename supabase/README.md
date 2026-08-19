# Backend (Supabase)

El progreso vive en localStorage y se refleja en Supabase. **Sin claves configuradas la app funciona igual que siempre**, solo que el progreso no sale del dispositivo — así que nada de esto es urgente ni puede romper lo que ya está desplegado.

## Puesta en marcha

### 1. Crear dos proyectos

En [supabase.com](https://supabase.com) → New project. Uno por entorno:

| Proyecto        | Para          |
| --------------- | ------------- |
| `stonksu-dev`   | rama `dev`    |
| `stonksu-prod`  | producción    |

Elige la región más cercana (`eu-west-3` París, por ejemplo). Guarda la contraseña de la base de datos en tu gestor: no vuelve a mostrarse.

> El plan gratuito permite **2 proyectos activos**, justo estos dos. Y **pausa un proyecto tras 7 días sin actividad**; se reactiva desde el panel en un par de minutos. En dev da igual, en producción con usuarios reales es la razón principal para pasar al plan de pago.

### 2. Activar el acceso anónimo

**Authentication → Sign In / Providers → Anonymous Sign-Ins → Enable.**

Viene desactivado de fábrica. Sin esto la app no podrá crear sesión y se quedará funcionando solo en local.

Si algún día abres esto al público, activa también el CAPTCHA (**Authentication → Attack Protection**): sin él, cualquiera puede generar cuentas anónimas en bucle y llenarte la tabla.

### 3. Crear las tablas

En cada proyecto: **SQL Editor → New query**, pega el contenido de [`migrations/0001_init.sql`](migrations/0001_init.sql) y ejecútalo. Es re-ejecutable, así que si lo lanzas dos veces no pasa nada.

Comprueba en **Table Editor** que aparecen `profiles` y `attempts`, ambas con el candado de RLS activo.

### 4. Conectar la app

**Project Settings → Data API** te da la URL, y **Project Settings → API Keys** la clave `anon` / publishable.

En local:

```bash
cp .env.example .env
```

y rellena las dos variables con los datos del proyecto **dev**.

En Vercel: **Settings → Environment Variables**. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` dos veces, una para *Production* (con las claves de prod) y otra para *Preview* (con las de dev). Después hay que **volver a desplegar**: Vite incrusta las variables en el bundle en tiempo de compilación, no las lee al arrancar.

## Sobre las claves

La clave `anon` está **pensada para ir en el cliente** y aparecer en el JavaScript. Lo que protege los datos es RLS: cada política exige `auth.uid() = id`, así que con esa clave solo puedes leer y escribir tus propias filas.

La clave `service_role` es otra cosa: **se salta RLS por completo**. No debe entrar en este repositorio, ni en una variable `VITE_*` (todo lo que lleve ese prefijo acaba en el bundle), ni en Vercel mientras no haya un backend que la necesite.

## Cómo funciona la sincronización

**Local primero.** Una lección cambia el estado en casi cada toque; esperar a la red en cada uno haría que el juego se sintiera roto y dejaría de funcionar sin cobertura. Así que localStorage es lo que lee la interfaz, y la nube es una copia con 2 segundos de retardo, que además se fuerza al ocultar la pestaña o cerrar la app.

**Primer arranque.** Se crea una cuenta anónima, se lee el perfil y:

- si la nube tiene progreso, gana la nube;
- si la nube está vacía, sube lo que hubiera en el dispositivo.

Así, conectar el backend no borra lo que ya habías jugado.

**Dos dispositivos a la vez** se resuelven con "gana el último que escribe". Es honesto para lo que esto es; un merge de verdad necesitaría marcas de tiempo por campo y no compensa hasta que alguien juegue en el móvil y en el portátil en el mismo minuto.

`testMode` **no se sincroniza** a propósito: es un interruptor de depuración, y subirlo desbloquearía el árbol entero en cualquier dispositivo donde entres.

## Comprobaciones

```bash
npm run check -- cloud
```

Cruza las tres capas: los campos del store, el mapeo de `src/lib/cloud.ts` y las columnas de la migración. Si añades un campo al store y olvidas cualquiera de las otras dos, falla. Ese es justo el fallo que si no aparece en silencio y solo se nota cuando alguien reinstala y ha perdido las monedas.

## Registro real

La app ya insiste en registrarse ([`RegisterGate`](../src/components/RegisterGate.tsx)) y sabe vincular la cuenta anónima, pero el panel de Supabase tiene que permitirlo. Cuatro cosas:

### 1. Manual Linking (obligatorio)

**Authentication → Sign In / Providers → Manual Linking → Enable.**

Sin esto, `linkIdentity()` falla. Es lo que permite **añadir** una identidad a la cuenta anónima en vez de crear una cuenta nueva: si se hiciera con `signInWithOAuth`, se abandonaría la cuenta anónima y con ella todo lo jugado.

### 2. Verificación de correo

**Authentication → Sign In / Providers → Email → Confirm email → ON.**

Con esto activado, `updateUser({ email })` deja la dirección en `new_email` y no la confirma hasta que se pulsa el enlace. Es justo lo que quieres: hasta ese momento la cuenta sigue siendo anónima y no se ha perdido nada si el correo nunca llega.

Y en **Authentication → URL Configuration**:

- *Site URL*: la de producción.
- *Redirect URLs*: añade `http://localhost:5173/**`, el dominio de preview de Vercel y el de producción.

> **Esto no es opcional.** La app pide volver a `http://localhost:5173/home`, pero Supabase solo respeta esa petición si la URL está en la lista; si no, **te manda al Site URL**, que de fábrica es `http://localhost:3000`. El síntoma es un `ERR_CONNECTION_REFUSED` en el puerto 3000 con el token colgando de la barra de direcciones. La verificación en sí habrá funcionado — el token lo demuestra —, solo que el navegador aterriza donde no hay nada escuchando.

## Plantillas de correo

En [`templates/`](templates/) están los cuatro correos, con la paleta y los botones de la app. Se pegan en **Authentication → Emails**, cada uno en su plantilla. El detalle de cuál va dónde y por qué están escritas en tablas está en [`templates/_shell.md`](templates/_shell.md).

La que usa el paso de cuenta anónima a registrada es **Change Email Address**, no *Confirm signup* — es fácil cambiar la equivocada y no entender por qué el correo sigue saliendo como antes.

## La pantalla de Google

Lo que ves al pulsar "Continuar con Google" lo controla Google, no Supabase. En [Google Cloud Console](https://console.cloud.google.com) → **Pantalla de consentimiento → Branding**:

- *Nombre de la aplicación*: `Stonksu`
- *Logotipo*: [`public/google-consent-logo.png`](../public/google-consent-logo.png), ya generado a 120x120, que es lo que Google pide

> Subir un logotipo **dispara la verificación de marca de Google**, que tarda días. El nombre de la aplicación se puede cambiar sin eso. Si tienes prisa por probar, pon solo el nombre y deja el logo para cuando vayas a publicar.

El `fqebfuvdvuoxxafvnrju.supabase.co` que aparece en "Ir a…" **no se puede cambiar** en el plan gratuito: requiere un dominio propio de autenticación, que es un añadido de pago de Supabase. Es cosmético, pero conviene saber que ahí seguirá hasta entonces.

### 3. Google

En [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **OAuth client ID** (tipo *Web application*). En *Authorized redirect URIs* pon exactamente:

```
https://<tu-proyecto>.supabase.co/auth/v1/callback
```

Copia el *Client ID* y el *Client secret* en **Authentication → Sign In / Providers → Google**.

### 4. Apple

Esto tiene un coste que conviene saber antes: **Sign in with Apple exige estar en el Apple Developer Program, 99 €/año**. No se puede montar con una cuenta gratuita, a diferencia de instalar por AltStore. Si aún no la tienes, deja Apple para cuando vayas a publicar en la App Store — donde además pasa a ser obligatorio si ofreces Google.

Cuando la tengas: Services ID + una clave Sign in with Apple, y el mismo `callback` de arriba como *Return URL*.

> Estado ahora mismo (comprobado contra tu proyecto dev): **ninguno de los dos proveedores está activado todavía** — `linkIdentity` responde `provider is not enabled`. La app lo traduce a "Ese proveedor aún no está activado en Supabase" en vez de tragárselo.

## Migraciones

Ejecútalas en orden desde el **SQL Editor**. Las dos son re-ejecutables.

| Archivo | Qué hace |
| --- | --- |
| [`0001_init.sql`](migrations/0001_init.sql) | `profiles`, `attempts`, RLS y restricciones |
| [`0002_account_status.sql`](migrations/0002_account_status.sql) | refleja `email` / `is_anonymous` / `registered_at` desde `auth.users`, más la vista `account_summary` |
| [`0003_unique_names.sql`](migrations/0003_unique_names.sql) | apodos únicos e insensibles a mayúsculas, más la función `name_available` |
| [`0004_friends.sql`](migrations/0004_friends.sql) | amistades mutuas, toques, y las funciones para gestionarlas |

`auth.users` no se puede leer desde el cliente, así que sin la 0002 no hay forma de saber por consulta qué cuentas son reales, y el Table Editor te muestra un muro de perfiles sin distinguir personas de sesiones anónimas que morirán con la caché de un navegador.

Después de la 0002:

```sql
select * from public.account_summary;
```

## La app de iPhone (.ipa)

Vite incrusta las variables `VITE_*` **al compilar**, y `.env` está en `.gitignore`, así que GitHub Actions no las tiene. Sin ellas el `.ipa` sale con el backend apagado: sin sincronización, sin cuenta y sin aviso de registro.

Las variables y secrets de repositorio en GitHub son **únicos por repositorio**, no por rama, así que los dos entornos se distinguen por un sufijo en el nombre. En **Settings → Secrets and variables → Actions**:

| Pestaña | Nombre | Valor |
| --- | --- | --- |
| *Variables* | `VITE_SUPABASE_URL_DEV` | URL del proyecto dev |
| *Secrets* | `VITE_SUPABASE_ANON_KEY_DEV` | clave anon de dev |
| *Variables* | `VITE_SUPABASE_URL_PROD` | URL del proyecto de producción |
| *Secrets* | `VITE_SUPABASE_ANON_KEY_PROD` | clave anon de producción |

La URL va como variable porque no es secreta; la clave va como secret solo para no dejarla escrita en el repositorio — en el bundle acaba igual, y no pasa nada, porque lo que protege los datos es RLS.

Los nombres **sin sufijo** siguen valiendo, pero solo para dev. Producción exige los `_PROD` explícitos y el build **falla** si faltan: un `.ipa` distribuido hablando con la base de datos de pruebas es peor que no tener `.ipa`.

### Qué entorno usa cada build

Lo decide el tag:

| Tag | Entorno |
| --- | --- |
| `v0.8.0-dev`, `v0.8.0-beta`, `v0.8.0-rc1` | dev |
| `v0.8.0` | producción |

También puedes lanzarlo a mano desde la pestaña **Actions**, eligiendo el entorno en un desplegable.

El artefacto sale nombrado `Stonksu-dev-v0.8.0-dev` o `Stonksu-production-v0.8.0`, para que dos `.ipa` descargados no se confundan. Y dentro de la app, el pie de **Perfil** avisa en ámbar **"base de datos de pruebas"** cuando el build es de dev.

**El `.ipa` solo se construye al crear un tag `v*`.** Es la causa habitual de "la app del móvil no se ha actualizado": hay commits nuevos en `dev` pero ningún tag desde el último build.

```bash
git tag v0.8.0-dev && git push origin v0.8.0-dev
```

Para comprobar qué build lleva realmente el móvil, mira el pie de **Perfil**: muestra `git describe`, así que `v0.7.0-6-g60c3091` significa "seis commits por delante de v0.7.0" y deja claro de un vistazo si el teléfono va atrasado.

## Apodos únicos

Solo puede existir un "mordekai". La unicidad la impone un índice único sobre `lower(btrim(name))`, que es el único sitio donde puede imponerse de verdad: dos personas pueden estar escribiendo el mismo apodo en el mismo instante, y ninguna comprobación previa cierra esa ventana.

Es **insensible a mayúsculas** a propósito — "Pollo" y "pollo" son el mismo apodo para una persona, así que permitir los dos vaciaría de sentido la regla.

RLS impide al cliente leer perfiles ajenos, así que tampoco puede comprobar si un apodo está libre. Para eso está `name_available(text)`, una función `security definer` que ve todas las filas pero **devuelve un solo booleano**: no filtra nada más allá de "cogido o no", que es inherente a tener nombres únicos. Excluye tu propia fila, para que reguardar tu nombre no choque contigo mismo.

Si la migración no está aplicada, la llamada falla, la app lo trata como "no se pudo comprobar" y deja continuar. Nunca bloquea a nadie por un fallo de red.

Para la carrera que sí queda abierta —dos confirmaciones simultáneas— el índice rechaza a uno, y el cliente prueba `pollo2`, `pollo3`… hasta encontrar hueco. Se pierde el apodo exacto, pero no la sincronización, que es lo caro.

## Amigos y toques

La amistad es **mutua**: uno la pide por apodo y el otro acepta. No es por gusto — un toque pone una notificación en el móvil de alguien, y eso necesita permiso de las dos partes. Con un modelo de "seguir", un desconocido podría seguirte solo para poder darte toques.

Un par nunca tiene dos filas: si pides amistad a quien ya te la había pedido, se acepta la suya en vez de crear otra.

Toda la escritura pasa por funciones `security definer` y las tablas solo tienen políticas de lectura. Así las reglas sobre quién puede aceptar o pinguear a quién viven en un sitio, en vez de repartidas por políticas que el cliente pueda intentar rodear.

RLS impide leer perfiles ajenos, así que la lista de amigos la monta `friend_list()`, que devuelve **solo** apodo, toro, racha y XP, y **solo** de gente con la que tienes relación.

Los toques están limitados a **uno por amigo y hora**. Un aviso que se puede repetir sin límite deja de ser un aviso y pasa a ser acoso.

## Notificaciones

El recordatorio de racha es una **notificación local**, programada por el propio móvil. No necesita servidor, funciona sin cobertura y —lo que decide el asunto— **no necesita el Apple Developer Program**: una cuenta gratuita no puede llevar el entitlement `aps-environment`, así que un `.ipa` firmado con AltStore no puede recibir push remoto de ninguna forma.

Se programan los próximos 7 días por separado, no una repetición diaria, porque una repetición no puede saltarse un día — te avisaría precisamente los días que sí practicaste. Se reprograman al terminar una lección, al cambiar el ajuste y al abrir la app.

El **toque de un amigo sí es push remoto**, porque lo dispara otra persona. Hasta que haya cuenta de pago, el toque espera en la bandeja y se muestra dentro de la app al abrirla. En Android, cuando exista el proyecto, Firebase lo permite gratis.

## Cuentas duplicadas

Supabase **ya impide** que una misma cuenta de Google quede vinculada a dos perfiles: ese es exactamente el error `identity_already_exists`. La app lo detecta y ofrece entrar en el perfil que ya la tiene, porque dos progresos separados no se pueden fusionar.

Lo que sí se acumula son las **cuentas anónimas**: se crea una por cada navegador o dispositivo que abre la app sin registrarse. Es el precio de dejar jugar sin registro, y conviene barrerlas de vez en cuando.

Ver el estado real (desde el **SQL Editor**, que no pasa por RLS):

```sql
select u.id, u.email, u.is_anonymous, u.created_at,
       p.xp, p.streak, p.coins,
       (select string_agg(i.provider, ', ')
          from auth.identities i where i.user_id = u.id) as proveedores
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

Saber qué perfil se quedó una cuenta de Google:

```sql
select user_id, provider, identity_data->>'email' as correo
from auth.identities
where provider = 'google';
```

Borrar anónimas viejas que nunca llegaron a jugar. El `on delete cascade` se lleva por delante su perfil y su historial:

```sql
delete from auth.users u
using public.profiles p
where p.id = u.id
  and u.is_anonymous
  and p.xp = 0
  and not p.onboarded
  and u.created_at < now() - interval '7 days';
```

Y si en pruebas necesitas **liberar** una cuenta de Google que quedó pegada a un perfil huérfano, borra ese usuario y podrás volver a vincularla:

```sql
delete from auth.users where id = '<el user_id de la consulta anterior>';
```

> Cuidado con la última: borra el perfil y todo su historial. En producción solo tiene sentido sobre una cuenta anónima abandonada.

## Lo que falta

- **Ranking / ligas**, que necesitarían una vista con datos agregados, no acceso directo a `profiles`.
- **Recuperar la cuenta al desinstalar**: si borras la app antes de registrarte, la sesión anónima se pierde y el perfil queda huérfano en la base de datos. Merece un borrado periódico de anónimos sin actividad.
- **Reducir el bundle**: con las claves puestas, `supabase-js` ya no se puede descartar por tree-shaking y añade unos 52 kB comprimidos (de 127 a 179 kB). Cargarlo de forma diferida detrás de la pantalla de carga lo sacaría del camino crítico, que además dura 10 segundos.
