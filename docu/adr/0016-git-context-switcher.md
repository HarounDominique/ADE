# ADR-0016: Selector de contexto Git en la topbar

## Status

Accepted

## Date

2026-09-04

## Context

La shell mantenía `Quick Open` en la topbar aunque el Explorer ya ofrecía la búsqueda de ficheros. Esa duplicidad ocupaba un espacio de alto valor y no hacía visible el contexto Git que determina dónde trabaja el usuario.

ADE ya persiste Projects locales y puede inspeccionar las ramas del repositorio activo, pero la shell no permitía cambiar de Project ni de branch sin salir de la aplicación. El cambio de contexto debe ser inmediato, trazable y no debe eliminar cambios locales.

## Decision

La topbar sustituye `Quick Open` por dos controles contiguos:

- **Current repository:** muestra el Project Git activo y abre un menú con los Projects locales registrados. Cada entrada muestra nombre y ruta para distinguir repositorios homónimos.
- **Current branch:** muestra la rama activa y abre un menú con las ramas locales del repositorio seleccionado. La lista se obtiene bajo demanda mediante `git.workspace`.

Seleccionar un Project actualiza el workspace canónico de Tauri, la raíz del Explorer, el snapshot de Project, Tasks, servicios, skills y demás contexto dependiente del repositorio. La selección se mantiene en la sesión de la shell y no modifica la identidad persistida de los Projects.

Seleccionar una rama ejecuta `git switch <branch>` a través del sidecar, con actor y razón internos de la acción explícita de la UI. No se fuerza, resetea ni descarta el working tree: si Git detecta cambios incompatibles, la operación falla y la shell conserva el contexto anterior. Tras una operación válida se refrescan branch, estado Git, snapshot y Explorer.

El Explorer conserva la búsqueda como única entrada de búsqueda y añade una lupa junto al título que enfoca ese campo.

## Alternatives considered

### Mantener Quick Open y añadir otro control Git

Rechazado: duplica la búsqueda del Explorer y reduce la jerarquía del contexto operativo.

### Cambiar de branch con `reset --hard` o checkout forzado

Rechazado: puede destruir cambios del usuario. ADE debe dejar que Git rechace el cambio cuando el working tree no sea compatible.

### Cargar todas las ramas de todos los Projects al arrancar

Rechazado: aumenta el coste de arranque y puede bloquear la shell. Las ramas se consultan sólo para el Project activo cuando se abre el menú.

## Consequences

- La shell tiene un contexto Git visible y accionable de forma permanente.
- `project.list` expone únicamente metadata de Projects ya registrados; no descubre ni registra rutas por sí solo.
- `git.branch.switch` reutiliza las reglas de mutación Git y exige confirmación explícita del comando recibido desde la UI, pero no realiza operaciones destructivas.
- El cambio de Project reinicia únicamente el contexto visual y los recursos asociados al Project; las sesiones PTY abiertas no se destruyen automáticamente.
- El menú debe representar loading, empty, failed y switching sin bloquear el resto de la aplicación.
