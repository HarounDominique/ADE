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

### Acceptance criteria

- Un repositorio local puede registrarse como `Project`.
- Una `Task` conserva intención, requisitos, contexto, estado, conversaciones y resultado.
- Una Task puede pasar por estados formales sin inferirlos desde texto.
- La conversación pertenece a ADE y permite cambiar de modelo/proveedor sin perder la Task.
- Cada transición significativa produce un evento operativo auditable.

## Commands

Pendientes hasta seleccionar stack. El spike debe documentar comandos ejecutables para `dev`, `build`, `test` y `lint`.

## Project Structure

```text
docu/specs/                 → Nexus y specs
src/domain/project-task/   → Entidades y transiciones
src/application/tasks/     → Casos de uso
tests/domain/project-task/ → Tests de estados y reglas
```

## Code Style

El dominio debe expresar transiciones mediante métodos nombrados, no asignaciones arbitrarias:

```ts
task.markReady();
task.startExecution(executionId);
```

Los identificadores son estables, los estados están enumerados y los eventos contienen causa, actor y timestamp.

## Testing Strategy

Tests unitarios para invariantes y transiciones; tests de integración para persistencia y rehidratación; tests de contrato para eventos consumidos por otros módulos. No se fija framework hasta el spike.

## Boundaries

- **Always:** mantener Task como agregado raíz; registrar causa de transiciones; conservar proveedor/modelo como metadata, no como identidad de conversación.
- **Ask first:** cambiar estados, identidad Task/branch, esquema de persistencia o semántica de eventos.
- **Never:** inferir `COMPLETED` sólo porque el agente terminó; borrar historial operativo; hacer que un proveedor sea dependencia del dominio.

## Success Criteria

Una Task de ejemplo puede crearse, reanudarse, bloquearse, pasar a revisión y completarse con un historial reproducible, sin depender de una UI ni de un proveedor específico.

## Open Questions

- ¿Task y branch se relacionan 1:1 o sólo mediante una referencia?
- ¿Qué eventos son mínimos para el primer event bus?
- ¿Qué operaciones de conversación se incluyen en v0.1 además de continuar, renombrar, archivar y cambiar modelo?
