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
- Ask first: push, merge, commit, creación de PR o descarte de cambios.
- Never: reescribir historia o eliminar cambios sin confirmación explícita.

## Success Criteria

Una Task puede seguirse desde su branch y ChangeSet hasta commit/PR, con gates y documentación enlazadas.

## Workflow policy

`.ade/policy.json` define `gitWorkflow`: `pull-request` es el modo por defecto; `direct` habilita commit y push directo. Branches, worktrees, commits, pushes y PRs exigen confirmación, actor y razón, y se registran contra la Task.

Cada operación devuelve la referencia que la hace auditable: `commit.create` devuelve el SHA creado, `push` resuelve la rama actual y rechaza un `HEAD` desacoplado en lugar de empujar una referencia ambigua, y `branch.create`/`pull-request.create` devuelven nombre y URL. ADE persiste esa referencia contra la Task seleccionada en el workspace, no contra la Task que muestre otra pantalla. `github.status` expone la disponibilidad de la GitHub CLI sin almacenar credenciales.

Version control es la superficie visible para Git del Project activo. Su pestaña `History` lista commits recientes con hash, autor, fecha y ficheros modificados; seleccionar un commit carga el diff completo y seleccionar uno de sus ficheros permite aislar el diff de ese cambio. Su pestaña `Changes` lista el estado pendiente y el diff local, y permite introducir título y cuerpo opcional para ejecutar `Commit` local. Una vez creado, habilita `Push origin` como acción separada, igual que GitHub Desktop. `Fetch origin` actualiza referencias remotas y exige confirmación explícita. La trazabilidad de una Task continúa en sus ChangeSets, gates y operaciones persistidas; la vista Git no sustituye ese historial.

El panel muestra rama activa, ficheros modificados, ramas, worktrees y remotos. Expone branch, worktree, commit, push y PR como acciones separadas: worktree solicita ruta y rama, y el sidecar rechaza una mutación que no reciba los parámetros específicos de su tipo. Cada acción sensible mantiene el diálogo de confirmación antes de ejecutar Git.

## Git context selectors

La shell muestra en la topbar `Current project` y `Current branch` como contexto persistente. `project.list` devuelve los Projects locales registrados, sin descubrir ni registrar rutas nuevas; el selector de Project muestra nombre, `repositoryPath` y tipo `Git`/`No Git`, y marca el Project activo. `git.workspace` carga bajo demanda las ramas locales del Project Git seleccionado y alimenta el selector de branch.

La selección de un repositorio llama a `project_context`, cambia la raíz canónica de la shell y refresca el read model y los recursos dependientes. El contexto seleccionado se conserva en un estado único y las respuestas posteriores de `project.snapshot` no pueden reintroducir el nombre o la ruta del Project inicial. La selección de una rama usa `git.branch.switch`, que ejecuta `git switch` con actor, razón y confirmación explícita de la acción de UI. No se hace force checkout, reset ni descarte automático; un working tree incompatible produce un fallo visible y conserva el contexto anterior. Tras éxito, la shell vuelve a consultar `git.workspace` y el snapshot para mostrar la rama real.

La topbar sustituye `Quick Open`; el único buscador de ficheros es el filtro del Explorer.

## Version control read model

El sidecar expone `git.history`, `git.commit.diff` y `git.pending` como lecturas acotadas al `repositoryPath` del Project activo. `git.history` devuelve commits y sus ficheros, `git.commit.diff` devuelve el parche de un commit completo o de un fichero concreto y `git.pending` devuelve ficheros con estado y diff local, incluyendo no trackeados en la lista. Las lecturas no modifican el árbol.

Las acciones visibles `git.fetch.origin`, `git.commit.create` y `git.push` requieren `actor`, `reason` y `confirmed: true`. `git.commit.create` crea sólo el commit local con título y cuerpo opcional; después la UI habilita `Push origin`, que ejecuta `git.push` sobre la rama actual. Cada fase informa de su resultado y un fallo de push nunca revierte un commit ya creado. `git.commit.push` se conserva únicamente como compatibilidad interna para consumidores antiguos, no como acción de esta superficie.

## Open Questions

- La integración actual usa la CLI local `gh`; queda abierta una API oficial sólo si aporta capacidades que `gh` no cubra.
- Los worktrees se crean bajo demanda desde Git; queda abierta la automatización por modo de workflow, que no forma parte del contrato actual.
