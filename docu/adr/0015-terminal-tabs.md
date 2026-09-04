# ADR-0015: Sesiones PTY independientes por tab de terminal

## Status

Accepted

## Date

2026-09-04

## Context

El dock de terminal de ADE sólo podía mantener un proceso PTY y un transcript global. Eso obliga a perder o mezclar contexto al alternar entre repositorios, servidores, agentes o comandos de diagnóstico que deben vivir en paralelo. La terminal debe conservar la frontera de seguridad del Project y seguir siendo una sesión nativa e interactiva.

## Decision

El backend mantiene un registro de sesiones PTY indexado por un `sessionId` estable durante la vida de la ventana. Cada tab de la UI se corresponde con una entrada del registro y conserva su propio transcript, cwd, historial y estado de completado. Los eventos `terminal:output` incluyen el `sessionId` para que la UI sólo actualice el tab de origen. Las operaciones de input y cierre reciben el mismo identificador; el cierre de la ventana detiene todas las sesiones.

La UI muestra tabs en el dock inferior, crea una sesión nueva con una acción visible, cambia de sesión sin reiniciar procesos y cierra sólo la sesión elegida. Siempre que quede abierto el dock existe un tab activo; cerrar el último tab crea una sesión vacía preparada para arrancar bajo demanda.

## Alternatives considered

### Un único PTY con multiplexación de comandos

Rechazado: mezclar comandos en un proceso no permite aislar cwd, estado de shell ni TUIs interactivas.

### Tabs visuales con un único proceso compartido

Rechazado: conserva el problema de estado compartido y no permite ejecutar sesiones concurrentes de forma predecible.

### Un proceso externo por tab sin registro en Rust

Rechazado: debilita la supervisión de lifecycle y hace difícil detener exactamente la sesión solicitada al cerrar un tab.

## Consequences

- El supervisor debe proteger un mapa de procesos, no una opción única.
- Los eventos de salida necesitan contexto de sesión y la UI debe enrutar por `sessionId`.
- El límite de seguridad del workspace se aplica al cwd de cada nueva sesión.
- La persistencia significa continuidad durante la vida de la shell; persistir sesiones entre reinicios queda fuera hasta disponer de una estrategia de rehidratación segura.
- Se requieren tests de aislamiento, lifecycle y routing de eventos además de los tests existentes del PTY.
