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

## Lo que falta

- **Vincular la cuenta anónima** a un email o a Apple, para cambiar de móvil sin perder el progreso. La cuenta anónima ya es una fila real de `auth.users`, así que vincularla conserva el mismo `id` y por tanto el mismo perfil — falta la pantalla.
- **Ranking / ligas**, que necesitarían una vista pública con datos agregados, no acceso directo a `profiles`.
