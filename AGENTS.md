# Trabajo en Stonksu

## Preferencias del propietario

- Responder en español. Al terminar, dar un texto breve con lo cambiado y subido; mencionar solo fallos o limitaciones relevantes. Evitar informes rutinarios extensos.
- Completar y comprobar cada tarea antes de darla por terminada. Ejecutar las validaciones pertinentes y probar el comportamiento afectado; para cambios visuales, comprobar móvil y escritorio. No afirmar certeza del 100 % ni pruebas que no se hayan realizado.
- Tras completar y validar los cambios solicitados, hacer commit y push a `origin/dev`. El propietario autorizó este flujo el 2026-09-05; no pedir confirmación rutinaria para cada commit/push. Respetar los permisos del entorno si exigen autorización técnica.
- Comprobar rama y estado antes de editar. Preservar cambios ajenos, no forzar pushes y no publicar en `main` ni crear tags de lanzamiento sin una petición específica.
- Mantener actualizada la memoria de proyecto cuando una tarea cambie arquitectura, reglas, diseño o validaciones.

## Contexto persistente

Leer primero [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md). Es el mapa de la aplicación y evita repetir la exploración completa. Después revisar solo los archivos relevantes y los cambios de Git desde la revisión anterior. La memoria orienta; el código vigente prevalece.

Stack: React + TypeScript + Vite + Tailwind, Zustand persistido localmente, Supabase y Capacitor para Android/iOS. Identidad: aprendizaje de trading jugando, estilo Duolingo oscuro, toro propio, lima para progreso y violeta para Ultra/dominio.

Validación base: `npm ci`, `npm run check`, `npm run lint`, `npm run build`. Añadir pruebas de interacción cuando la tarea lo requiera. Los checks no contactan Supabase y no sustituyen pruebas de integración o de dispositivos.

`CLAUDE.md` contiene instrucciones de Graphify: si existe `graphify-out/graph.json`, usar consultas acotadas primero; actualizar el grafo tras cambios de código si la herramienta está disponible. El grafo es generado e ignorado por Git; no es requisito para entender el repositorio si falta.
