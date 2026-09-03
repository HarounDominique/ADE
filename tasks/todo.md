# Tasks: Project and Task Workflow v0.1

<!-- Plan: tasks/plan.md | Spec: docu/specs/SPEC-project-task-workflow.md -->

- [x] Task: Formalizar Project y Repository
  - Plan: [project-repository-plan.md](project-repository-plan.md)
  - Acceptance: existen tipos con identificadores estables y una relación explícita Project → Repository; Task puede referenciar Project sin depender de OpenCode.
  - Verify: `npm run build` y tests de validación de identificadores y relación.
  - Files: `src/domain/project.ts`, `src/domain/task.ts`, `tests/domain/project.test.ts`

- [x] Task: Persistir y rehidratar Tasks con historial
  - Acceptance: una Task guardada y cargada conserva intención, estado, eventos, actor, razón y orden temporal; una base existente sigue siendo legible.
  - Verify: `npm test` con round-trip y migración.
  - Files: `src/persistence/sqlite-store.ts`, `tests/sqlite-store.test.ts`

- [x] Task: Crear casos de uso de Task
  - Acceptance: existen operaciones para crear, consultar, reanudar y avanzar una Task; todas validan razones y transiciones mediante el dominio.
  - Verify: tests de aplicación para rutas válidas e inválidas.
  - Files: `src/application/tasks/`, `tests/application/tasks/`

- [x] Task: Definir gates mínimos del workflow
  - Acceptance: el sistema expresa qué evidencia permite `READY_FOR_HUMAN` y qué aprobación permite `COMPLETED`, sin inferir cierre por finalización del agente.
  - Verify: tests de gates y transición humana.
  - Files: `src/domain/task.ts`, `src/application/tasks/`, `tests/domain/task.test.ts`

- [x] Task: Integrar el flujo `review` con los casos de uso
  - Acceptance: `npm run review` y `npm run ade -- review` usan los casos de uso de Task y mantienen el flujo persistido Implementer → Reviewer; `npm run ade` expone las operaciones básicas.
  - Verify: `npm run build && npm test` y smoke test con OpenCode local.
  - Files: `src/application/run-review-flow.ts`, `src/review-spike.ts`, `tests/review-flow.test.ts`

- [x] Task: Exponer CLI básica de Project y Task
  - Acceptance: `npm run ade -- help` funciona y permite registrar Projects, crear Tasks y avanzar estados.
  - Verify: `npm run build && npm test && npm run ade -- help`.
  - Files: `src/cli.ts`, `package.json`, `README.md`

- [x] Task: Sincronizar documentación del módulo
  - Acceptance: nexus, specs dependientes, plan y tareas reflejan los contratos implementados y no quedan referencias rotas.
  - Verify: `rg 'SPEC-project-task-workflow|project-task-workflow' docu` y revisión de headings; verificado durante los commits de la vertical desktop.
  - Files: `docu/specs/`, `tasks/`

- [ ] Task: Implementar vertical desktop mínima
  - Plan: [desktop-shell-plan.md](desktop-shell-plan.md)
  - Acceptance: Project Hub, Work, Changes, Knowledge y Runtime permiten recorrer una Task con estados, gates y escape hatch visibles.
  - Verify: `npm run desktop:test` y smoke test en macOS.
  - Files: `src/ui/`, `tests/ui/`
