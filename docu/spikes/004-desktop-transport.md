# Spike 004 — Transporte entre Tauri y el backend TypeScript

**Estado:** implementación parcial
**Fecha:** 2026-09-03
**Módulo:** `desktop-shell`

## Objetivo

Conectar la shell Tauri con los casos de uso TypeScript sin duplicar dominio, SQLite, Git ni las reglas de transición en Rust.

## Criterios

- El frontend no accede directamente a SQLite, Git ni procesos.
- Los casos de uso TypeScript siguen siendo la autoridad de las mutaciones.
- El transporte funciona sin cloud y permite cancelar operaciones largas.
- Los errores conservan causa, evidencia y punto de reentrada.
- El modo desarrollo y el bundle macOS tienen una ruta de arranque reproducible.
- No se expone un puerto local innecesario a otras aplicaciones.

## Alternativas

| Alternativa | Ventaja | Coste / riesgo | Evaluación |
|---|---|---|---|
| Reimplementar consultas en Rust | Bundle autónomo | Duplica dominio y persistencia; deriva con rapidez | Rechazada para MVP |
| HTTP local | Fácil de inspeccionar | Puerto, ciclo de vida y superficie de ataque | Válida sólo con autenticación local y puerto efímero |
| Sidecar TypeScript por stdio | Conserva casos de uso; no abre puerto | Empaquetado y supervisión del proceso | Recomendación provisional |
| Ejecutar CLI por cada consulta | Implementación inicial mínima | Lento, frágil para eventos y mutaciones largas | Sólo smoke/debug |

## Recomendación provisional

Usar un sidecar TypeScript supervisado por Tauri y un protocolo JSON-RPC sobre stdin/stdout. Tauri arranca y detiene el proceso; el sidecar crea `AdeStore`, expone read models y enruta comandos de aplicación. stdout queda reservado para respuestas protocolizadas y stderr para logs.

El primer corte debe implementar sólo `project.snapshot`, con request id, respuesta `result/error` y cierre limpio. Las mutaciones y eventos se añaden después de validar lifecycle y empaquetado.

El primer corte está implementado en `src/desktop-sidecar.ts` y se ejecuta con `npm run desktop:sidecar` cuando `ADE_DB_PATH` está configurado. Los tests verifican snapshot, request id y errores estructurados, y un smoke test validó el proceso real sobre stdin/stdout con SQLite temporal. Tauri dispone de un supervisor con arranque, consulta de estado y parada idempotente, además de los comandos y eventos JSON-RPC; el smoke integrado arranca la app con `ADE_PROJECT_ID` y `ADE_DB_PATH` explícitos, y la UI solicita el snapshot para renderizarlo.

## Gates del spike

1. El sidecar responde a una consulta snapshot desde un repositorio temporal.
2. Tauri lo arranca, recibe una respuesta y lo termina sin proceso huérfano.
3. Una excepción del sidecar produce error estructurado y no rompe la shell.
4. El bundle macOS incluye el ejecutable y conserva la ruta de datos elegida.

**Progreso:** gates 1 y 2 cubiertos en tests/smoke de desarrollo; la shell ya muestra `ready/failed` y conserva el último snapshot confirmado. Gate 3 (fallo y recuperación automatizada) y gate 4 (bundle) pendientes.

## Fuera de alcance

HTTP público, cloud, autenticación multiusuario, reimplementación del dominio en Rust y streaming de logs del agente.
