# Plan: Project and Task Workflow v0.1

<!-- Spec: docu/specs/SPEC-project-task-workflow.md | Module id: project-task-workflow -->

## Objective

Completar la primera base operativa de ADE alrededor del agregado `Task`, de modo que una intención humana pueda crearse, persistirse, reanudarse y avanzar mediante estados explícitos sin depender de una UI o de un proveedor de agentes.

## Current baseline

- `Task` ya valida intención, estados, transiciones y eventos.
- `AdeStore` ya persiste Task, ChangeSet y Review en SQLite.
- El flujo CLI ya crea una Task y la deja en `READY_FOR_HUMAN` después de una Review.
- Project/Repository, persistencia/rehidratación, casos de uso, gates y CLI básica ya están implementados.
- Falta integrar `npm run review` con los casos de uso y construir la vertical desktop.

## Implementation order

1. Formalizar los tipos de Project y Repository y su relación con Task.
2. Añadir persistencia y rehidratación del agregado Task sin perder eventos.
3. Exponer casos de uso para crear, consultar, reanudar y avanzar una Task.
4. Definir la matriz de transiciones y gates mínimos como contratos testeables.
5. Integrar el flujo existente para consumir esos casos de uso.
6. Actualizar el nexus y las specs dependientes cuando cambien los contratos.

## Risks and mitigations

- **Duplicar estado entre dominio y SQLite:** rehidratar siempre desde una representación persistida única y probar round-trip.
- **Acoplar Task a OpenCode:** mantener runtime y proveedor en adapters; el agregado sólo conoce metadata y eventos.
- **Hacer crecer demasiado v0.1:** dejar conversaciones completas, branches/worktrees y event bus fuera hasta que exista evidencia de necesidad.
- **Permitir estados inválidos desde la CLI:** centralizar transiciones en `Task.transition` y probar cada ruta permitida y rechazada.

## Verification checkpoints

- Tras el dominio: `npm run build && npm test` con matriz completa de transiciones.
- Tras persistencia: test de creación, rehidratación, historial y migración.
- Tras casos de uso: test de Task nueva, Task existente y transición con razón/actor.
- Antes de integrar: test end-to-end del flujo standard y revisión de referencias en `SPEC-NEXUS.md`.

## Out of scope

UI desktop, worktrees paralelos, conversaciones completas, sincronización cloud, event bus en tiempo real y commits automáticos.
