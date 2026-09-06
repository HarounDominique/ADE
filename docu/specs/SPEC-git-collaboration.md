# Spec: Git and GitHub Collaboration

<!-- Nexus: SPEC-NEXUS.md | Module id: git-collaboration -->

## Objective

Convertir ADE en el punto operativo para Git y GitHub: branches, diffs, commits, worktrees, PRs y reviews enlazados a Tasks y documentación.

## Commands

`npm run build`; `npm test`; `git status`; `git diff`; `git worktree list`; `npm run desktop:dev`.

## Project Structure

`src/ports/git.ts` define Git; `src/adapters/` implementa Git local y GitHub; `src/application/` aplica políticas; `desktop/src/` muestra estado y acciones.

## Code Style

```ts
type GitOperation = { id: string; taskId: string; actor: string; reason: string; result: string };
```

## Testing Strategy

Fixtures Git temporales, ramas concurrentes, conflictos, worktrees, PRs simuladas y validación de que no existe commit sin aprobación humana.

## Boundaries

- Always: mostrar diff, branch, remoto y operación atribuida.
- Ask first: merge, creación de PR, worktree y descarte de cambios, mediante el diálogo in-app definido en [SPEC-desktop-shell](SPEC-desktop-shell.md#interaction-states).
- Never: reescribir historia o eliminar cambios sin confirmación explícita; usar `window.confirm` o `window.prompt`, que el webview no responde.

`Commit`, `Push origin` y `Fetch origin` no piden confirmación adicional: su intención ya es explícita —un botón habilitado sólo cuando la operación es posible, más el diálogo de `Commit`— y una segunda pregunta sólo añadía un clic sin evidencia nueva.

## Success Criteria

Una Task puede seguirse desde su branch y ChangeSet hasta commit/PR, con gates y documentación enlazadas.

## Workflow policy

`.ade/policy.json` define `gitWorkflow`: `pull-request` es el modo por defecto; `direct` habilita commit y push directo. Branches, worktrees, commits, pushes y PRs exigen `confirmed`, actor y razón en el puerto, y se registran contra la Task. Ese `confirmed` acredita intención humana trazable; qué acciones añaden además un diálogo lo decide la superficie, según [Boundaries](#boundaries).

Cada operación devuelve la referencia que la hace auditable: `commit.create` devuelve el SHA creado, `push` resuelve la rama actual y rechaza un `HEAD` desacoplado en lugar de empujar una referencia ambigua, y `branch.create`/`pull-request.create` devuelven nombre y URL. ADE persiste esa referencia contra la Task seleccionada en el workspace, no contra la Task que muestre otra pantalla. `github.status` expone la disponibilidad de la GitHub CLI sin almacenar credenciales.

## Git workspace

Version control es la superficie visible para Git del Project activo y la única vista que muestra el panel operativo `Git workspace`. Su pestaña `History` lista commits recientes con hash, autor, fecha y ficheros modificados; seleccionar un commit carga el diff completo y seleccionar uno de sus ficheros permite aislar el diff de ese cambio. Sus columnas de commits y ficheros modificados se pueden contraer de manera independiente, con un control de restauración accesible en la cabecera correspondiente, para dedicar el ancho a la evidencia; la columna `Changed files` de `Changes` usa ese mismo control, con idéntico icono, posición y animación. Su pestaña `Changes` presenta el working tree en una lista de ficheros seleccionables y un diff por fichero con líneas de contexto, añadidas, eliminadas y hunks resaltadas. Ambas composiciones recalculan el espacio del diff en tiempo real; las líneas largas se reenvuelven preservando espacios, colores y legibilidad. El botón `Commit` vive junto a las tabs y abre un diálogo modal para introducir título y cuerpo opcional; crea sólo el commit local. `Push origin` es una acción separada, igual que GitHub Desktop, y su disponibilidad refleja el estado real del repositorio: se habilita siempre que existan commits que el remoto no ha visto, los haya creado ADE o cualquier otra herramienta. `History` marca esos commits para que el usuario sepa qué debe el repositorio al remoto sin recurrir a la terminal. `Fetch origin` actualiza referencias remotas como acción independiente. La trazabilidad de una Task continúa en sus ChangeSets, gates y operaciones persistidas; la vista Git no sustituye ese historial.

El panel muestra rama activa, ficheros modificados, ramas, worktrees y remotos. Expone branch, worktree, commit, push y PR como acciones separadas: worktree pide rama y ruta absoluta en un diálogo con campos reales y valores propuestos a partir de la Task activa, y el sidecar rechaza una mutación que no reciba los parámetros específicos de su tipo. Cada acción sensible de este panel confirma antes de ejecutar Git mediante el diálogo in-app de la shell, nunca mediante un prompt del navegador.

## Git context selectors

La shell muestra en la topbar `Current project`, `Current task` y `Current branch` como contexto persistente. `project.list` devuelve los Projects locales registrados, sin descubrir ni registrar rutas nuevas; el selector de Project muestra nombre, `repositoryPath` y tipo `Git`/`No Git`, y marca el Project activo. `Current task` muestra como máximo 12 Tasks del Project activo en orden de creación descendente y sincroniza las operaciones Git con la Task elegida. `git.workspace` carga bajo demanda las ramas locales del Project Git seleccionado y alimenta el selector de branch.

La selección de un repositorio llama a `project_context`, cambia la raíz canónica de la shell y refresca el read model y los recursos dependientes. El contexto seleccionado se conserva en un estado único y las respuestas posteriores de `project.snapshot` no pueden reintroducir el nombre o la ruta del Project inicial. La selección de una rama usa `git.branch.switch`, que ejecuta `git switch` con actor, razón y confirmación explícita de la acción de UI. No se hace force checkout, reset ni descarte automático; un working tree incompatible produce un fallo visible y conserva el contexto anterior. Tras éxito, la shell vuelve a consultar `git.workspace` y el snapshot para mostrar la rama real.

La topbar sustituye `Quick Open`; el único buscador de ficheros es el filtro del Explorer.

## Version control read model

El sidecar expone `git.history`, `git.commit.diff`, `git.pending` y `git.pending.diff` como lecturas acotadas al `repositoryPath` del Project activo. `git.history` devuelve commits, sus ficheros y si el remoto los ha visto, `git.commit.diff` devuelve el parche de un commit completo o de un fichero concreto, `git.pending` devuelve ficheros con estado y diff local incluyendo no trackeados en la lista, y `git.pending.diff` devuelve el parche del fichero pendiente seleccionado. Las lecturas no modifican el árbol.

Cada commit de `git.history` incluye `unpushed`. El read model lo resuelve contra el repositorio, no contra la sesión: usa `@{upstream}..HEAD` cuando la rama tiene upstream, `HEAD --not --remotes` cuando no lo tiene, y devuelve el conjunto vacío cuando el Project no declara remotos, porque entonces no hay nada que empujar. Un commit creado fuera de ADE cuenta igual que uno creado en la shell.

Las acciones visibles `git.fetch.origin`, `git.commit.create` y `git.push` requieren `actor`, `reason` y `confirmed: true`; ese `confirmed` acredita que la acción nace de una intención explícita del usuario en la UI, no de un segundo diálogo. `git.commit.create` crea sólo el commit local con título y cuerpo opcional; `Push origin` ejecuta `git.push` sobre la rama actual y se habilita a partir de los commits `unpushed` que devuelve `git.history`, no de lo ocurrido durante la sesión. Cada fase informa de su resultado y un fallo de push nunca revierte un commit ya creado. `git.commit.push` se conserva únicamente como compatibilidad interna para consumidores antiguos, no como acción de esta superficie.

## Open Questions

- La integración actual usa la CLI local `gh`; queda abierta una API oficial sólo si aporta capacidades que `gh` no cubra.
- Los worktrees se crean bajo demanda desde Git; queda abierta la automatización por modo de workflow, que no forma parte del contrato actual.
