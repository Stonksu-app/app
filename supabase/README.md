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

Y en **Authentication → URL Configuration**, que son **dos campos distintos y no intercambiables**:

| Campo | Qué es | Comodines |
| --- | --- | --- |
| *Site URL* | El destino de reserva cuando ninguno de la lista encaja. **Un solo valor.** | **No admite.** El propio campo lo dice |
| *Redirect URLs* | La lista blanca de destinos permitidos | Sí, con `**` |

Para el proyecto **dev**:

```
Site URL:       https://dev-stonksu.vercel.app
```

```
Redirect URLs:  http://localhost:5173/**
                https://dev-stonksu.vercel.app/**
```

Y para producción, lo mismo con su dominio.

La app siempre pide volver a `<origen actual>/home` — las tres llamadas que redirigen (confirmar correo, vincular Google, iniciar sesión con Google) usan `window.location.origin`. Por eso hay que permitir **cada origen desde el que abras la app**, no solo uno.

> **Los dos síntomas de tener esto mal:**
>
> - Un comodín en *Site URL*: no coincide con nada, así que **todo** cae en la reserva y acabas siempre en la misma URL, sea cual sea el sitio desde el que entraste.
> - La lista de *Redirect URLs* vacía: da igual lo que pida la app, siempre irás al *Site URL*. Si además ese sigue siendo el `http://localhost:3000` de fábrica, verás un `ERR_CONNECTION_REFUSED` con el token colgando de la barra de direcciones.
>
> En ambos casos la autenticación **sí ha funcionado** — el token lo demuestra —, es solo que el navegador aterriza donde no hay nada escuchando.

Si usas los despliegues de vista previa de Vercel, cada uno tiene su propio subdominio aleatorio. Añade también su patrón, por ejemplo `https://dev-stonksu-*.vercel.app/**`, o el login fallará justo en las previews.

## Plantillas de correo

En [`templates/`](templates/) están los cuatro correos, con la paleta y los botones de la app. Se pegan en **Authentication → Emails**, cada uno en su plantilla. El detalle de cuál va dónde y por qué están escritas en tablas está en [`templates/_shell.md`](templates/_shell.md).

### Antes hace falta un SMTP propio

Desde el [3 de junio de 2026](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), los proyectos gratuitos **creados después de esa fecha** no pueden editar las plantillas si usan el servidor de correo de Supabase. Lo hicieron porque unas pocas cuentas abusivas estaban a punto de conseguir que les pusieran toda la infraestructura en listas negras.

La excepción es la salida: **un proyecto gratuito con SMTP propio sí puede editarlas**. Y conviene igualmente, porque el correo de serie de Supabase está limitado a un puñado de envíos por hora y no sirve para producción.

Con [Resend](https://resend.com) (3.000 correos al mes gratis), en **Project Settings → Authentication → SMTP Settings**:

| Campo | Valor |
| --- | --- |
| Host | `smtp.resend.com` |
| Puerto | `465` |
| Usuario | `resend` |
| Contraseña | tu API key de Resend |
| Sender email | una dirección de tu dominio verificado |

> **El remitente es lo que falla primero.** Mientras no verifiques un dominio, Resend solo te deja usar `onboarding@resend.dev`, **y solo entrega a la dirección con la que te diste de alta en Resend**. Es un sandbox anti-abuso. Cualquier otro destinatario se rechaza y Supabase lo muestra como `Error sending email change email`, que no dice nada de la causa real.
>
> Es decir: si te registraste en Resend con `a@gmail.com` y pruebas la app con `b@gmail.com`, **no llega y el error no te lo explica**. Para probar tú, usa la misma dirección; para que se registre cualquier otra persona, verifica un dominio.

El error real siempre está en **Logs → Auth Logs** del panel de Supabase. El mensaje que ve el usuario es genérico a propósito, así que ahí es donde se mira.

### Entrar con correo sin haber resuelto el envío

Si lo que quieres es que el registro con correo y contraseña funcione **ya**, y el envío te está bloqueando: **desactiva la confirmación**.

**Authentication → Sign In / Providers → Email → Confirm email → OFF.**

Con eso Supabase aplica la dirección en el acto y **no envía nada**, así que ningún problema de SMTP puede estorbar. La app lo detecta: en vez de mandarte a mirar un buzón que no va a recibir nada, dice "¡Cuenta guardada!" y te deja seguir.

Lo que se pierde es real y conviene tenerlo claro: **cualquiera puede registrarse con un correo que no es suyo**. Para desarrollo da igual; antes de tener usuarios de verdad, vuelve a activarlo con el dominio ya verificado en Resend.

> Si la contraseña se queda sin poner —Supabase la rechaza en cuentas anónimas que aún no tienen dirección—, se pone después desde **Perfil → Contraseña**. Sin ese paso tendrías una cuenta a la que solo se entra por Google.

Cualquier otro proveedor sirve igual — Postmark, SendGrid, Amazon SES. Lo que desbloquea las plantillas es dejar de usar el SMTP compartido, no cuál elijas.

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

### 4. Otros proveedores

La app soporta **Google, Discord, Twitch, Facebook y Apple**. Todos funcionan ya en el código; lo que decide cuáles se ven es [`src/lib/providers.ts`](../src/lib/providers.ts):

```ts
{ id: 'discord', label: 'Discord', enabled: false, … }
```

Pon `enabled: true` **solo después** de activarlo en Supabase. Un botón para un proveedor sin configurar falla con "provider is not enabled", que es peor que no ofrecerlo.

El procedimiento es el mismo para todos: creas una aplicación OAuth en el proveedor, pones el `callback` de Supabase como URI de redirección, y pegas el Client ID y el Secret en **Authentication → Sign In / Providers**.

```
https://<tu-proyecto>.supabase.co/auth/v1/callback
```

| Proveedor | Dónde se crea la app | Fricción |
| --- | --- | --- |
| **Discord** | [Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2 | Ninguna. Gratis, sin revisión, cinco minutos |
| **Twitch** | [dev.twitch.tv](https://dev.twitch.tv/console/apps) → Register Your Application | Ninguna. Gratis, sin revisión |
| **Facebook** | [Meta for Developers](https://developers.facebook.com) | Pide revisión de la app antes de salir de modo desarrollo |
| **Apple** | Services ID + clave | 99 €/año del Developer Program |

> Si tuviera que elegir el siguiente, **Discord**: no cuesta nada, no hay revisión, y es donde está la gente que ya sigue mercados. Twitch es igual de barato y el público se solapa.

Añadir uno que no esté en la lista —LinkedIn, Spotify, GitHub…— es una entrada más en ese array y su logotipo en `ProviderMarks.tsx`. Supabase soporta bastantes más.

### 5. Apple

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

### "Ese apodo ya está cogido" siendo el tuyo

`name_available()` excluye tu propia fila, así que reguardar tu nombre nunca choca contigo. Si te dice que está cogido, **no estás en la cuenta que crees**: el apodo pertenece a otro perfil.

Es lo que dejan los intentos de vinculación que fallaron mientras `detectSessionInUrl` estaba mal: el progreso se quedó en una cuenta anónima y la identidad de Google acabó pegada a otra distinta. Al entrar con Google aterrizas en la segunda, que está vacía.

Para verlo:

```sql
select p.name, p.xp, u.is_anonymous, u.email,
       (select string_agg(i.provider, ', ')
          from auth.identities i where i.user_id = u.id) as proveedores
from auth.users u
join public.profiles p on p.id = u.id
order by p.xp desc;
```

Si el apodo con XP sale en una fila anónima sin proveedores, y hay otra fila con `google` y cero XP, ese es el reparto.

**Recuperarlo**, en este orden:

1. Borra la cuenta huérfana que se quedó el Google, con la consulta de `auth.identities` de abajo para encontrar su `user_id`.
2. Vuelve al navegador donde sigues siendo el apodo con progreso — su sesión anónima está en el `localStorage` de ese navegador.
3. Desde ahí, **Guarda tu progreso → Continuar con Google**. Ahora la identidad se vincula a la cuenta buena.

El orden importa: mientras el Google siga pegado a la otra cuenta, el paso 3 falla con `identity_already_exists`.

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

### Empezar de cero en dev

Cuando las cuentas de prueba se enredan y ninguna tiene progreso que merezca la pena, sale más barato vaciar que operar. **Solo en dev**, obviamente:

```sql
delete from auth.users;
```

El `on delete cascade` se lleva perfiles, intentos, amistades y toques. Después, borra el `localStorage` de cada navegador con el que hayas probado (o abre una ventana nueva), porque si no seguirán presentando un token de una cuenta que ya no existe.

Tras eso, el primer registro con Google o con correo se vincula limpiamente a la cuenta anónima con la que empieces.

### Barrido periódico

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
