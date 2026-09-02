# Tasks: Project and Task Workflow v0.1

<!-- Plan: tasks/plan.md | Spec: docu/specs/SPEC-project-task-workflow.md -->

- [ ] Task: Formalizar Project y Repository
  - Acceptance: existen tipos con identificadores estables y una relación explícita Project → Repository; Task puede referenciar Project sin depender de OpenCode.
  - Verify: `npm run build` y tests de validación de identificadores y relación.
  - Files: `src/domain/project.ts`, `src/domain/task.ts`, `tests/domain/project.test.ts`

- [ ] Task: Persistir y rehidratar Tasks con historial
  - Acceptance: una Task guardada y cargada conserva intención, estado, eventos, actor, razón y orden temporal; una base existente sigue siendo legible.
  - Verify: `npm test` con round-trip y migración.
  - Files: `src/persistence/sqlite-store.ts`, `tests/sqlite-store.test.ts`

- [ ] Task: Crear casos de uso de Task
  - Acceptance: existen operaciones para crear, consultar, reanudar y avanzar una Task; todas validan razones y transiciones mediante el dominio.
  - Verify: tests de aplicación para rutas válidas e inválidas.
  - Files: `src/application/tasks/`, `tests/application/tasks/`

- [ ] Task: Definir gates mínimos del workflow
  - Acceptance: el sistema expresa qué evidencia permite `READY_FOR_HUMAN` y qué aprobación permite `COMPLETED`, sin inferir cierre por finalización del agente.
  - Verify: tests de gates y transición humana.
  - Files: `src/domain/task.ts`, `src/application/tasks/`, `tests/domain/task.test.ts`

- [ ] Task: Integrar el flujo CLI con los casos de uso
  - Acceptance: `npm run review` usa los casos de uso de Task y mantiene el flujo persistido Implementer → Reviewer.
  - Verify: `npm run build && npm test` y smoke test con OpenCode local.
  - Files: `src/application/run-review-flow.ts`, `src/review-spike.ts`, `tests/review-flow.test.ts`

- [ ] Task: Sincronizar documentación del módulo
  - Acceptance: nexus, specs dependientes, plan y tareas reflejan los contratos implementados y no quedan referencias rotas.
  - Verify: `rg 'SPEC-project-task-workflow|project-task-workflow' docu` y revisión de headings.
  - Files: `docu/specs/`, `tasks/`
