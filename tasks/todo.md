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

- [x] Task: Definir read model ProjectSnapshot
  - Acceptance: existe un modelo de lectura que compone Project, Tasks filtradas y métricas sin exponer SQLite a la UI.
  - Verify: `npm run build` y tests de `ProjectSnapshot`.
  - Files: `src/application/project-snapshot.ts`, `src/persistence/sqlite-store.ts`, `tests/project-snapshot.test.ts`

- [x] Task: Implementar protocolo inicial desktop sidecar
  - Acceptance: `project.snapshot` responde por JSON-RPC stdio con request id y errores estructurados.
  - Verify: `npm run build` y tests del sidecar.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`

- [x] Task: Crear Tasks desde Work
  - Acceptance: la shell presenta un formulario de intención, persiste una Task mediante el caso de uso y refresca el Project Hub.
  - Verify: `node --check desktop/src/main.js`, `npm run build`, tests sidecar y smoke Tauri.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`, `src/desktop-sidecar.ts`

- [x] Task: Exponer transiciones de Task por sidecar
  - Acceptance: `task.advance` valida estado, razón y actor mediante el caso de uso y persiste el historial.
  - Verify: `npm run build` y tests del sidecar.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`

- [x] Task: Controles visuales de transición en Work
  - Acceptance: Work muestra acciones sólo para transiciones permitidas, envía razón/actor y refresca el snapshot tras completar.
  - Verify: `node --check desktop/src/main.js` y `npm run build`.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`

- [x] Task: Exponer estado inicial del runtime en la shell
  - Acceptance: Runtime distingue sidecar listo de agente desconectado y no afirma ejecución sin evidencia; muestra último evento/error cuando el contrato lo proporcione.
  - Verify: `npm run build`, `npm test` y `node --check desktop/src/main.js`.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`, `desktop/src/`

- [x] Task: Conectar ejecución del Implementer y eventos de runtime
  - Acceptance: `task.run` acepta una Task ejecutable sin bloquear stdin/stdout, inicia OpenCode, retransmite eventos y refleja `CONNECTED`/`FAILED`; Work puede iniciar la ejecución y refresca el snapshot al terminar.
  - Verify: `npm run build`, `npm test` y `node --check desktop/src/main.js`.
  - Files: `src/application/run-spike.ts`, `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`, `desktop/src/main.js`

- [x] Task: Mostrar evidencia detallada del runtime
  - Acceptance: Runtime conserva y muestra los 12 eventos más recientes por Task, con hora, tipo y error sin afirmar estados no evidenciados.
  - Verify: `node --check desktop/src/main.js`, `npm run build`, `npm test` y `cargo test --manifest-path desktop/src-tauri/Cargo.toml`.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`

- [x] Task: Hacer recuperables los fallos de ejecución
  - Acceptance: `task.run` rechaza estados no ejecutables y persiste `BLOCKED` cuando una Task en ejecución falla, conservando el error Runtime.
  - Verify: `npm run build` y `npm test`.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`

- [x] Task: Diagnóstico explícito de conexión OpenCode
  - Acceptance: Runtime puede solicitar `runtime.health`, mostrar versión cuando responde y conservar un error `RUNTIME_UNAVAILABLE` cuando no hay conexión.
  - Verify: `npm run build`, `npm test` y `node --check desktop/src/main.js`.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`, `desktop/src/`

- [ ] Task: Integrar lifecycle del sidecar con Tauri
  - Acceptance: Tauri arranca, supervisa y termina el sidecar sin procesos huérfanos; un error produce estado recuperable en la shell. Supervisor, conexión de streams, render del snapshot, estados `ready/failed`, parada segura incluso tras salida inesperada, un único reintento automático y recuperación manual desde Runtime implementados; smoke de desarrollo con `ADE_DB_PATH` y `ADE_PROJECT_ID` explícitos y pruebas de fallo de proceso superados. Falta validar el flujo dentro de una ventana Tauri empaquetada.
  - Verify: smoke test macOS en modo desarrollo y bundle.
  - Files: `desktop/src-tauri/`, `docu/spikes/004-desktop-transport.md`

- [ ] Task: Empaquetar el sidecar para macOS
  - Acceptance: `.app` incluye un sidecar ejecutable o runtime autocontenido compatible, y conserva la ruta configurable de `ADE_DB_PATH`. Estado actual: ejecutable Node SEA arm64 generado y incluido en el recurso Tauri; falta probar instalación fuera del workspace.
  - Verify: `npm run desktop:package` y ejecución sobre repositorio temporal sin depender del workspace; bundle arm64 verificado.
  - Files: `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/binaries/`, `scripts/build-desktop-sidecar.mjs`

- [ ] Task: Implementar vertical desktop mínima
  - Plan: [desktop-shell-plan.md](desktop-shell-plan.md)
  - Acceptance: Project Hub, Work, Changes, Knowledge y Runtime permiten recorrer una Task con estados, gates y escape hatch visibles.
  - Verify: `npm run desktop:test` y smoke test en macOS.
  - Files: `src/ui/`, `tests/ui/`
