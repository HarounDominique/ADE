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

Changes presenta el ChangeSet, gates y findings de la Task seleccionada; Git conserva sus operaciones en un panel separado para que el estado del workspace no reemplace la trazabilidad de la Task.

## Open Questions

- ¿GitHub vía CLI local, API oficial o ambos?
- ¿Los worktrees se crean automáticamente sólo en modo standard?
