# Memoria de Stonksu

Revisión inicial: 2026-09-05, código base `0064c37`, rama `dev`. Remoto: `https://github.com/Stonksu-app/app.git`. Árbol limpio al comenzar; `dev` coincidía con la referencia local `origin/dev`; `main` estaba en `37ae309`. Estos datos son una instantánea: comprobar Git en cada tarea.

## Producto y recorrido

Stonksu enseña trading en español mediante sesiones cortas de preguntas y minijuegos. La experiencia se inspira explícitamente en Duolingo: camino de temas, etapas, vidas, rachas, monedas, cofres, logros y celebraciones. El simulador permite practicar con monedas del juego; no envía operaciones a un exchange.

- Entrada: splash, landing, onboarding (experiencia, objetivo, apodo), mapa de aprendizaje. Se puede jugar sin registrarse; con Supabase se crea primero una sesión anónima y se ofrece guardar la cuenta.
- `src/App.tsx` define las rutas. `RequireOnboarded` espera sesión/sincronización antes de decidir entre landing, onboarding y contenido; no basta con comprobar solo el estado local al arrancar.
- Navegación compartida en `components/navItems.ts`: Aprender (`/home`), Guía (`/guia`), Simulador (`/simulador`, destacado en el centro), Retos (`/misiones`, también `/liga`) y Perfil (`/profile`). La tienda sigue en la barra lateral de escritorio (`desktopOnly`) y tiene acceso directo desde Perfil; la barra inferior conserva cinco destinos.
- Rutas adicionales: `/onboarding`, `/entrar`, `/lesson/:lessonId/intro`, `/lesson/:lessonId`, `/lesson/:lessonId/results`, `/guia/leer`, `/guia/repaso`, `/secciones`, `/simulador`, `/planes`, `/ultra`, `/logros`, `/avatar`, `/amigos`, `/amigos/:id`.
- Perfil reúne estadísticas, calendario, personalización y ajustes de cuenta/recordatorios; muestra el identificador del build y el usuario para diagnosticar versiones instaladas.

## Arquitectura y archivos a consultar

| Área | Fuente principal | Responsabilidad |
| --- | --- | --- |
| Arranque/rutas | `src/main.tsx`, `src/App.tsx` | React, router, splash, hooks globales y acceso |
| Progreso y economía | `src/store/useUserStore.ts` | Zustand con persistencia `stonksu-storage`, acciones y recompensas |
| Sesión | `src/store/useAuthStore.ts`, `src/lib/supabase.ts`, `src/lib/nativeAuth.ts` | Cuenta anónima, correo, OAuth, callback nativo |
| Sincronización | `src/hooks/useCloudSync.ts`, `src/lib/cloud.ts`, `src/store/useSyncStore.ts` | Lectura inicial, mapeo SQL, escritura diferida y estado |
| Contenido | `src/data/lessons.ts`, `src/types.ts` | Árbol, preguntas, tarjetas, juegos y tipos |
| Etapas | `src/utils/buildActivityStream.ts`, `src/utils/mastery.ts` | Reparto e intercalado, repaso, errores pendientes |
| Aprendizaje | `src/pages/LessonIntro.tsx`, `Lesson.tsx`, `LessonResults.tsx` | Introducción, ejecución y resultados |
| Guía | `src/pages/Guide*.tsx` | Glosario desbloqueado, lectura y práctica de términos |
| Mercado | `src/pages/Simulator.tsx`, `src/utils/market.ts`, `src/lib/marketData.ts` | Simulación, cálculos puros y precios externos |
| Gráficos | `src/components/PriceChart.tsx`, `CandleChart.tsx`, `TradeHistory.tsx` | Gráfico interactivo, gráficos didácticos e historial |
| Social y ligas | `src/lib/friends.ts`, `leagues.ts`, `src/data/leagues.ts` | RPC, clasificaciones, premios y amistades |
| Misiones/logros | `src/data/dailyMissions.ts`, `missions.ts`, `achievements.ts`, `badges.ts` | Objetivos diarios/permanentes y progreso |
| Planes | `src/data/plans.ts`, `src/pages/Premium.tsx` | Beneficios, precios y disponibilidad |
| Diseño | `src/index.css`, `src/components/Button.tsx`, `Mascot.tsx`, `Avatar.tsx`, `Icon.tsx` | Paleta, interacción y elementos propios |
| Backend | `supabase/migrations/0001…0015` | Esquema, RLS, RPC, triggers y cron |
| Distribución | `vite.config.ts`, `vercel.json`, `capacitor.config.ts`, `.github/workflows/` | Web y paquetes móviles |

No hay servidor propio en el repo. La SPA habla con Supabase y obtiene precios públicos de Binance. React 19, React Router 7, Zustand 5, Tailwind 4, Vite 8, TypeScript 6, Capacitor 8; versiones exactas en el lockfile. Los componentes usan estado React local para la interacción efímera y el store para progreso persistente.

## Aprendizaje y reglas

- Ocho temas en cuatro secciones: fundamentos y velas; soportes/resistencias e indicadores; riesgo y psicología; órdenes y análisis fundamental. El contenido está en TypeScript, no en un CMS.
- Los temas tienen dependencias y 3/4/5 etapas según dificultad. La última es repaso; las anteriores reparten vocabulario y actividades. `introKey(nodeId, stage)` evita saltarse la presentación de términos nuevos.
- Actividades: quiz, emparejar, clasificar, ordenar y completar frases. `buildStage` intercala juegos/preguntas, recupera hasta cinco errores compatibles y puede incluir una pregunta de un tema ya completado.
- El estado de entrada de una sesión se congela para que una respuesta no reconstruya ni reordene el ejercicio en curso. `useComboFeedback` centraliza aciertos, errores, vidas y feedback.
- Cinco vidas, regeneración cada 30 minutos. Nivel cada 100 XP; monedas por aciertos y recompensas. Consultar constantes del store antes de cambiar cantidades.
- Cofres tras temas dominados; protecciones de racha limitadas a dos. Se obtienen por compra y recompensas. Misiones diarias: tres, seleccionadas de forma determinista para la fecha.
- Rachas por día local, con reparación desde historial y liquidación de días sin jugar al arrancar. `activeDates`, `reviewDates` y `frozenDates` evitan contradicciones entre calendario, racha y perfiles de amigos.
- La guía revela términos según avance; práctica sin consumir vidas, dominio hasta tres y penalización de un punto por fallo. El repaso también cuenta como actividad de racha.
- `testMode` es un ajuste local de depuración, no un permiso del backend ni parte del progreso que se sincroniza.

## Persistencia, cuentas y backend

Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, funciona el aprendizaje local. Las variables se incrustan al compilar. No guardar claves privadas ni `service_role` en archivos de memoria, Git o variables `VITE_*`.

La UI lee localStorage; `useCloudSync` escribe tras 2 segundos y fuerza guardado al ocultar/cerrar la página. Si el perfil remoto tiene progreso, se adopta; si está vacío, se siembra con el local. Entre dispositivos se aplica último escritor, no merge por campo. `cloud.ts` traduce camelCase/snake_case; intentos se suben con clave de conflicto para evitar duplicados.

Los campos de progreso nuevos requieren coordinar store, `snapshot()`, `CloudState`, `toRow/fromRow` y SQL. El rango/grupo/semana de liga vienen del servidor; el cliente sube XP semanal. Posiciones, órdenes e historial del simulador, límites diarios y ajustes locales no se sincronizan. La lógica contempla conflictos de apodo, cuentas eliminadas y un reintento sin una columna ausente.

Registrar un anónimo usa vinculación de identidad para conservar su ID/progreso. Google figura habilitado en el código; Apple deshabilitado. La configuración real del proveedor en Supabase no está verificada por leer este repositorio. OAuth nativo abre navegador del sistema y vuelve a `com.stonksu.app://auth`; el esquema debe coincidir en código, Android, iOS y redirects del servicio.

Tablas iniciales `profiles` y `attempts` con RLS; migraciones posteriores añaden cuenta, apodos únicos, amigos/toques, dominio de términos, planes, calendarios, ligas y recompensas. Amistad mutua y toques limitados por servidor a uno por amigo/hora; lectura social por RPC, no acceso general a perfiles. Recordatorios de racha/vidas son locales; los toques se muestran dentro de la app, sin infraestructura de push remoto implementada aquí.

Ligas: seis rangos, XP semanal, cron lunes 00:00 UTC; ascenso de los cuatro primeros solo con más de cuatro participantes, descenso del último con más de uno. **0010 y 0011 son cambios temporales de pruebas que reúnen usuarios en una tabla común**; no asumir que toda migración es una configuración definitiva de producción.

## Simulador y planes

El simulador usa BTCUSDT: velas REST de Binance y precio por WebSocket, temporalidades de 1m a 1d. Tiene mercado sintético de respaldo identificado en pantalla. `lightweight-charts` implementa la interacción del gráfico, incluyendo AUTO y ajustes de escala.

El propietario quiere que el simulador sea un destino principal y un atractivo de Ultra, con operativa familiar para principiantes y traders experimentados. La vista de escritorio coloca gráfico e historial a la izquierda y panel de órdenes a la derecha; en móvil se alterna entre Gráfico y Operar, manteniendo ambos montados para conservar inputs, temporalidad y AUTO. `PriceChart` observa su contenedor con ResizeObserver para ajustar el ancho al volver de una vista oculta. Margen/apalancamiento usan selectores compactos; TP/SL y detalles de riesgo/comisiones son desplegables. La posición muestra dirección, margen, PnL y ROI en el panel de órdenes. Se bloquea operar mientras carga el precio. El acceso a Ultra está visible en la cabecera.

Long/short, apalancamiento 1–100x, margen aislado/cruzado, órdenes market/limit, take profit/stop loss, comisiones maker/taker y liquidación. Una posición u orden pendiente se conserva localmente; al volver se consulta el recorrido de velas para resolver ejecuciones/salidas. Historial local de las últimas 50 operaciones. Es una simulación con aproximaciones, no un motor de ejecución remoto.

Gratis y Premium tienen una práctica y una operación por día. Premium (2,99 €/mes en la oferta del código) elimina anuncios propios. Ultra (6,99 €/mes) añade vidas, prácticas y trades ilimitados, y accesorios. Las comprobaciones para temas exclusivos existen, pero ningún tema está marcado Ultra. **No hay cobro integrado**: planes no disponibles para compra real y cambio de plan de prueba en `testMode`.

## Aspecto e intención visual

La referencia está expresada en componentes/comentarios; no hay un archivo de diseño externo versionado. Conservar una app educativa amable y de aspecto consistente, con controles grandes y respuesta inmediata.

- Fondo carbón `#171717`, superficies `carbon-850/800`, texto claro, Nunito como primera fuente CSS (la declaración no demuestra que se descargue la fuente).
- Lima `#C6FF34` para marca, avance y acción; violeta `ultra` para Ultra y dominio/platino; azul cielo para protectores/días congelados; ámbar para premios; rojo para error/bajada. Ligas usan sus propios metales.
- Toro SVG propio: `Mascot` es marca; `Avatar` representa el toro personalizable. Reutilizar `Icon`/sprite y no introducir un segundo sistema visual sin necesidad.
- Botón compartido: altura 50 px (42 pequeño), radio 12 px, mayúsculas, labio 3D de 4 px que se comprime al pulsar. Tarjetas redondeadas y bordes marcados.
- Mapa serpenteante con nodos/anillos, banners de unidad pegajosos, cofres y acabado violeta al dominar. Escritorio: navegación lateral desde `lg`, estadísticas laterales desde `xl`. Móvil: barra superior y cinco destinos inferiores.
- Respetar safe areas, `100dvh`, scroll accesible y gestos táctiles. Los helpers de padding seguro sustituyen padding: combinar mediante `calc` si se necesita espaciado extra.
- CSS global sin capa puede vencer utilidades Tailwind. Defaults de botones deben ir en `@layer base`; no imponer `position` global a `.platinum-node` (rompería sticky). El elemento con brillo necesita su propio bloque de posicionamiento.
- Confeti, combos, partículas y celebraciones acompañan recompensas. Mantener contraste y las reglas existentes de movimiento reducido.

## Validación y distribución

`npm run check` descubre los `scripts/check-*.ts`, los empaqueta con esbuild y ejecuta afirmaciones. Cubre contenido, etapas, secuencias, dominio, errores, progreso, economía/planes, logros, rachas, nombres, sincronización, mercado, combos, splash y estilos. `npm run check -- market` limita el área. El runner sustituye `import.meta.env` por un objeto vacío: **no prueba un Supabase real**.

`npm run lint` usa Oxlint. `npm run build` ejecuta `tsc -b` y Vite, y después intenta actualizar Graphify de forma opcional. Para comportamiento visible, añadir comprobación en navegador a tamaños móvil/escritorio; cambios nativos requieren validación específica. Ningún conjunto de checks demuestra perfección universal.

Vercel se documenta desde `dev`; `vercel.json` resuelve rutas SPA a index y controla caché. No admite comentarios. Push a `dev` no recompila por sí solo los binarios instalados. Workflows nativos se activan manualmente o con tags `v*`: Android APK debug e iOS IPA sin firmar. El selector real de entorno acepta sufijos `-dev`, `-beta`, `-rc` o `-rc.*`; otros tags van a producción. Evitar asumir que `-rc1` se considera dev porque aparezca como ejemplo antiguo.

## Desajustes documentales conocidos

Priorizar implementación y checks sobre comentarios antiguos: `supabase/README.md` enumera solo cuatro migraciones y dice que faltan ligas, aunque hay quince migraciones y ligas implementadas. Hay comentarios que aún llaman azul al platino, o hablan de splash de diez segundos: CSS, motor y `utils/splash.ts` prevalecen (5 s frío, 900 ms reciente, más transición). Las instrucciones remotas de SMTP, OAuth y despliegue son documentación, no prueba de la configuración desplegada.

## Mantenimiento de esta memoria

Usar este mapa como punto de partida, inspeccionar el diff y abrir solo los módulos afectados. Actualizar las secciones que cambien, sin acumular diarios de cada tarea. Las preferencias duraderas están en `AGENTS.md`; no depender de que una conversación anterior permanezca en contexto.

Validación de la revisión inicial: `npm run check` pasó los 15 scripts; `npm run lint` terminó sin errores y con ocho avisos existentes (Fast Refresh y dependencias de hooks); `npm run build` pasó, con aviso de bundle superior a 500 kB. Graphify no estaba instalado. Esta tarea añade documentación, sin modificar la aplicación. No se verificaron visualmente pantallas en navegador, backend desplegado, OAuth real ni binarios móviles; no considerar esos flujos certificados por estos resultados.

Validación de navegación y simulador (2026-09-05): pruebas de interacción en Chromium con precios de prueba controlados, a 320/390/768/1024/1440 px; acceso a tienda, preservación de inputs/AUTO/temporalidad, abrir/cerrar market, persistir/cancelar límite, límite diario gratis y acceso a Ultra, y carga del gráfico oculto. Revisión visual móvil/escritorio. No equivale a probar precios externos reales ni binarios nativos. Referencias de interacción: [panel de Paper Trading de TradingView](https://www.tradingview.com/support/solutions/43000516466-paper-trading-main-functionality/) y [tipos de orden de Bitget](https://www.bitget.com/support/articles/12560603809539).
