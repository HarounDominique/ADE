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

## Open Questions

- ¿GitHub vía CLI local, API oficial o ambos?
- ¿Los worktrees se crean automáticamente sólo en modo standard?
