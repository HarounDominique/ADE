# ADR-0030: Confirmaciones in-app y acciones de intención explícita

## Status

Accepted

## Date

2026-09-06

## Amends

[ADR-0022](0022-version-control-commit-flow.md), en la parte de su decisión que hacía publicar «bajo confirmación explícita».

## Context

La shell usaba `window.confirm` y `window.prompt` como superficie de confirmación en varias acciones. El webview de Tauri no responde a esas llamadas, de modo que cada acción apoyada en ellas quedaba inerte: pulsar no producía nada visible ni ejecutaba la operación. Afectaba a `Push origin`, `Fetch origin`, el commit local, retirar un Project del seguimiento, descartar cambios sin guardar y las operaciones de `Repository actions`. La creación de worktrees era directamente inalcanzable, porque pedía rama y ruta mediante dos `window.prompt` que nunca devolvían valor.

El fallo se presentaba como un bug de UI, pero la causa es de diseño: la shell delegaba una decisión de producto —cómo se confirma una mutación— en una API del navegador que este entorno no implementa. `Agents` ya había resuelto su caso con un diálogo propio para borrar conversaciones, sin que esa solución estuviera formalizada como contrato de la shell.

Al revisar cada sitio aparece además una segunda pregunta: no todas esas confirmaciones aportaban algo. Un botón que sólo se habilita cuando la operación es posible, pulsado deliberadamente, ya es una declaración de intención; añadirle un diálogo que repite el nombre de la acción cuesta un clic y no aporta evidencia nueva.

## Decision

1. Toda confirmación de la shell se resuelve con un diálogo propio, modal, con título, consecuencia descrita, etiqueta de acción específica y cancelación. `window.confirm` y `window.prompt` quedan prohibidos en `desktop/src`.
2. Cualquier dato que la acción necesite se pide con campos reales dentro de un diálogo, nunca con un prompt del navegador.
3. Confirman: retirar un Project del seguimiento, descartar cambios sin guardar, cerrar un documento sucio, crear un worktree y las operaciones Git de `Repository actions`.
4. No confirman: `Commit`, `Push origin` y `Fetch origin`. Su intención ya es explícita —un botón habilitado sólo cuando la operación es posible, más el diálogo propio de `Commit`— y ninguna de las tres destruye trabajo.
5. El criterio general: se confirma lo que puede perder trabajo o crear estado difícil de deshacer, no lo que simplemente muta el repositorio de forma prevista y reversible.

## Alternatives considered

### Conservar `window.confirm` y arreglar el webview

Rechazado: no depende de ADE. El comportamiento de los diálogos nativos en el webview es del entorno, y apoyar una decisión de producto en él deja la superficie a merced de la plataforma.

### Retirar todas las confirmaciones

Rechazado: convierte un bug en pérdida de datos. Descartar cambios sin guardar o retirar un Project necesitan un punto de parada; el problema era la superficie, no la existencia de la guarda.

### Un diálogo distinto por acción

Rechazado: multiplica marcado y estilos para un mismo patrón. Un único diálogo parametrizado por título, texto, etiqueta y tono mantiene la coherencia visual y reduce la superficie a mantener.

## Consequences

- La shell tiene un único mecanismo de confirmación reutilizable, con el callback pendiente limpiado también al cerrar con `Esc`.
- La creación de worktrees pasa a ser posible: rama y ruta absoluta se introducen en un diálogo con valores propuestos a partir de la Task activa.
- `Discard` gana la confirmación que nunca tuvo, nombrando el fichero afectado.
- Un test de contrato ancla la decisión: `desktop/src/main.js` no puede contener `window.confirm` ni `window.prompt`, y los diálogos deben existir en el HTML. Una regresión falla en `npm test`, no en producción.
- Las mutaciones del sidecar siguen exigiendo `confirmed`, `actor` y `reason`. Ese `confirmed` acredita intención humana trazable en el puerto; qué acciones añaden además un diálogo lo decide la superficie.

## Implementation evidence

La entrega del 2026-09-06 sustituye los cinco puntos afectados por el diálogo compartido y añade el formulario de worktree. `npm test` pasa con 120 tests TypeScript, incluido el contrato que prohíbe los prompts nativos, y `cargo test` con 18 Rust. El contrato de producto queda en [SPEC-desktop-shell](../specs/SPEC-desktop-shell.md#interaction-states), con [SPEC-git-collaboration](../specs/SPEC-git-collaboration.md#boundaries) y [SPEC-file-workspace](../specs/SPEC-file-workspace.md#interaction-states) citándolo.
