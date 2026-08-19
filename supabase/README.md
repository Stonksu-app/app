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
- *Redirect URLs*: añade `http://localhost:5173/**`, el dominio de preview de Vercel y el de producción. Sin esto el enlace del correo rebota.

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

`auth.users` no se puede leer desde el cliente, así que sin la 0002 no hay forma de saber por consulta qué cuentas son reales, y el Table Editor te muestra un muro de perfiles sin distinguir personas de sesiones anónimas que morirán con la caché de un navegador.

Después de la 0002:

```sql
select * from public.account_summary;
```

## La app de iPhone (.ipa)

Vite incrusta las variables `VITE_*` **al compilar**, y `.env` está en `.gitignore`, así que GitHub Actions no las tiene. Sin ellas el `.ipa` sale con el backend apagado: sin sincronización, sin cuenta y sin aviso de registro.

En GitHub → **Settings → Secrets and variables → Actions**:

| Pestaña | Nombre | Valor |
| --- | --- | --- |
| *Variables* | `VITE_SUPABASE_URL` | `https://<proyecto>.supabase.co` |
| *Secrets* | `VITE_SUPABASE_ANON_KEY` | la clave anon |

La URL va como variable porque no es secreta; la clave va como secret solo para no dejarla escrita en el repositorio — en el bundle acaba igual, y no pasa nada, porque lo que protege los datos es RLS.

Si faltan, el workflow no falla: avisa y compila igual, en modo local.

**El `.ipa` solo se construye al crear un tag `v*`.** Es la causa habitual de "la app del móvil no se ha actualizado": hay commits nuevos en `dev` pero ningún tag desde el último build.

```bash
git tag v0.8.0 && git push origin v0.8.0
```

Para comprobar qué build lleva realmente el móvil, mira el pie de **Perfil**: muestra `git describe`, así que `v0.7.0-6-g60c3091` significa "seis commits por delante de v0.7.0" y deja claro de un vistazo si el teléfono va atrasado.

## Lo que falta

- **Ranking / ligas**, que necesitarían una vista con datos agregados, no acceso directo a `profiles`.
- **Recuperar la cuenta al desinstalar**: si borras la app antes de registrarte, la sesión anónima se pierde y el perfil queda huérfano en la base de datos. Merece un borrado periódico de anónimos sin actividad.
- **Reducir el bundle**: con las claves puestas, `supabase-js` ya no se puede descartar por tree-shaking y añade unos 52 kB comprimidos (de 127 a 179 kB). Cargarlo de forma diferida detrás de la pantalla de carga lo sacaría del camino crítico, que además dura 10 segundos.
