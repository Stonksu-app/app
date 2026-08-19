# Stonksu

Aprender trading jugando. React + TypeScript + Vite, con Supabase detrás y una
app de iPhone compilada con Capacitor.

```bash
npm install
npm run dev      # http://localhost:5173
```

Sin `.env` la app funciona igual, guardando el progreso solo en el navegador.
Para conectarla a Supabase, mira [`supabase/README.md`](supabase/README.md).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y compila a `dist/` |
| `npm run check` | Ejecuta las comprobaciones de `scripts/check-*.ts` |
| `npm run check -- cloud` | Solo una de ellas |
| `npm run lint` | Oxlint |
| `npm run ios:sync` | Compila y copia a `ios/` |

Las comprobaciones cubren lo que no se ve al mirar la pantalla: aritmética de
fechas para las rachas, el reparto del contenido entre etapas, que ningún campo
del perfil se caiga de la sincronización, que los apodos y las plantillas de
correo sigan cuadrando con el SQL. No son tests unitarios al uso, son
afirmaciones sobre cosas que fallarían en silencio.

## Despliegue

Vercel, desde la rama `dev`. La configuración vive en
[`vercel.json`](vercel.json) y hace dos cosas.

**La redirección a `index.html`.** El router es de cliente, así que ninguna de
las rutas existe como fichero: sin esto, entrar directo a `/home` o recargar
`/amigos` devuelve 404, que es además donde aterrizan todos los redirects de
autenticación. El servidor de Vite hace esa redirección por su cuenta, así que
el fallo solo aparece desplegado. El comodín es seguro para `favicon.svg` y
compañía porque Vercel [da precedencia al sistema de ficheros antes de aplicar
los rewrites](https://vercel.com/docs/project-configuration/vercel-json#rewrites).

**La caché.** Vite pone un hash en el nombre de cada fichero de `assets/`, así
que un fichero distinto es una URL distinta y se pueden cachear para siempre.
`index.html` es el único nombre que nunca cambia, y cachearlo dejaría a la gente
clavada en un build viejo.

> `vercel.json` **no admite comentarios**, ni siquiera claves `"//"`: Vercel lo
> valida contra un esquema y el despliegue falla con *should NOT have additional
> property*. Por eso esta explicación está aquí y no en el fichero.

## La app de iPhone

Se compila en GitHub Actions al crear un tag, y sale sin firmar para que
AltStore la firme con tu Apple ID. El tag decide contra qué base de datos
apunta: `v0.8.0-dev` usa la de pruebas, `v0.8.0` la de producción.

```bash
git tag v0.8.0-dev && git push origin v0.8.0-dev
```

El pie de **Perfil** muestra el `git describe` del build, que es la única forma
de saber qué versión lleva realmente el móvil.

Dos límites de Apple que conviene tener presentes: una cuenta gratuita **no
puede recibir notificaciones push** ni usar *Sign in with Apple*. Por eso los
recordatorios de racha son notificaciones locales, que sí funcionan.

## Cómo está organizado

```
src/
  pages/       una por ruta
  components/  piezas compartidas
  store/       zustand: progreso, sesión, sincronización
  lib/         supabase, amigos, apodos, notificaciones
  data/        lecciones, misiones, logros
  utils/       lógica pura y testeable
scripts/       comprobaciones ejecutables
supabase/      migraciones SQL y plantillas de correo
```

El progreso vive en `localStorage` y se refleja en Supabase con retardo. Es a
propósito: una lección cambia el estado en casi cada toque, y esperar a la red
en cada uno haría que el juego se sintiera roto y dejara de funcionar sin
cobertura.
