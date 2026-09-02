# Spec: Project and Task Workflow

<!-- Nexus: SPEC-NEXUS.md | Module id: project-task-workflow -->

## Objective

Definir la unidad de trabajo de ADE para que una intención humana sea persistente, trazable y separable de la conversación concreta con un proveedor.

## Domain model

```text
Workspace → Project → Task
                    ├── Conversation / Message
                    ├── Execution / ToolCall
                    ├── ChangeSet / Checkpoint
                    ├── Review / Finding / Gate
                    ├── TestRun / RuntimeObservation
                    └── Decision
```

`Project` referencia Repository, Worktree, Documents, Skills, Policies, Services y Commits. `Task` es el agregado raíz del trabajo; no se crea una Task por cada mensaje ni se hace que una conversación sea la identidad del trabajo.

## Project and Repository contract

`Project` es la identidad estable que agrupa un repositorio local y su configuración de ADE. `Repository` representa la ubicación Git concreta. En v0.1 la relación es `Project 1 → 1 Repository`, pero `Task` sólo conserva `projectId` y `repositoryPath` como referencias; no incorpora la lógica de Git ni crea branches automáticamente.

```ts
type Project = {
  id: string;
  name: string;
  repositoryPath: string;
  createdAt: string;
};

type Repository = {
  path: string;
  gitRoot: string;
  branch?: string;
};
```

Invariantes del contrato:

- `id`, `name` y `repositoryPath` no pueden estar vacíos.
- `repositoryPath` debe ser absoluto y apuntar a un directorio existente.
- El repositorio debe poder identificarse mediante `git rev-parse --show-toplevel`; la validación no modifica el árbol de trabajo.
- Dos Projects no pueden registrar el mismo `gitRoot` dentro de la misma base ADE.
- Una Task puede existir antes de que se complete la detección de branch; el branch es metadata mutable, no identidad.
- El dominio no depende de un cliente Git concreto: la detección se realiza detrás de un puerto/adaptador.

La creación de Project falla de forma explícita si la ruta no existe, no es un repositorio Git o ya está registrada. La operación debe devolver la raíz Git canónica para evitar duplicados por rutas relativas o subdirectorios.

### Acceptance criteria

- Un repositorio local puede registrarse como `Project`.
- Un Project expone una raíz Git canónica y puede vincular Tasks mediante `projectId`.
- Una `Task` conserva intención, requisitos, contexto, estado, conversaciones y resultado.
- Una Task puede pasar por estados formales sin inferirlos desde texto.
- La conversación pertenece a ADE y permite cambiar de modelo/proveedor sin perder la Task.
- Cada transición significativa produce un evento operativo auditable.

## Commands

La primera implementación usa TypeScript ejecutado con Node.js y SQLite local:

```bash
npm install
npm run build
npm test
npm run dev -- /ruta/al/repositorio "Inspect the repository"
npm run review -- /ruta/al/repositorio "Describe the task"
```

`npm run dev` ejecuta el spike Implementer y `npm run review` ejecuta el flujo Implementer → Reviewer. Ambos requieren OpenCode sirviendo en `127.0.0.1:4096`, salvo que se configure `OPENCODE_URL`. La metadata se guarda en `.ade/ade.db`, salvo que se configure `ADE_DB_PATH`.

## Project Structure

```text
docu/specs/                 → Nexus y specs
src/domain/task.ts         → Agregado Task, estados, transiciones y eventos
src/application/           → Casos de uso que crean y avanzan Tasks
src/persistence/           → Rehidratación y persistencia SQLite
tests/                      → Tests de dominio, persistencia y flujo end-to-end
tasks/                      → Plan y tareas de implementación del módulo
```

## Code Style

El dominio debe expresar transiciones mediante métodos nombrados, no asignaciones arbitrarias:

```ts
task.markReady();
task.startExecution(executionId);
```

Los identificadores son estables, los estados están enumerados y los eventos contienen causa, actor y timestamp.

## Testing Strategy

Tests unitarios para invariantes y transiciones; tests de integración para persistencia, migraciones y rehidratación; tests end-to-end para el flujo de una Task con ChangeSet y Review. El comando de verificación es `npm run build && npm test`. Los eventos persistidos deben conservar orden, actor, causa, timestamp y estado resultante.

## Boundaries

- **Always:** mantener Task como agregado raíz; registrar causa de transiciones; conservar proveedor/modelo como metadata, no como identidad de conversación.
- **Ask first:** cambiar estados, identidad Task/branch, esquema de persistencia o semántica de eventos.
- **Never:** inferir `COMPLETED` sólo porque el agente terminó; borrar historial operativo; hacer que un proveedor sea dependencia del dominio.

## Success Criteria

Una Task de ejemplo puede crearse, reanudarse, bloquearse, pasar a revisión y completarse con un historial reproducible, sin depender de una UI ni de un proveedor específico.

## v0.1 decisions

- Task y branch se relacionan mediante una referencia futura; no se impone una relación 1:1 mientras no exista soporte de worktrees.
- El mínimo de eventos del agregado es `task.created` y `task.status_changed`; sesiones, ChangeSets, Reviews y TestRuns mantienen sus propios registros relacionados por `taskId`.
- La conversación es metadata operativa del trabajo y su contrato detallado queda fuera de este primer slice; v0.1 sólo exige que no sea la identidad de la Task.
- La transición a `COMPLETED` requiere aprobación humana posterior a `READY_FOR_HUMAN`; el final de una sesión de agente nunca la produce por sí solo.

## Open Questions

- ¿Qué campos de Project y Repository deben persistirse antes de construir la UI?
- ¿Cuándo se crea una rama o worktree y cómo se vincula al `taskId`? En v0.1 no se crean automáticamente.
- ¿Necesitamos un event bus observable en v0.1 o basta la secuencia persistida en `TaskEvent[]`?
