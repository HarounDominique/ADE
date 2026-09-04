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

- [x] Task: Escape hatch al repositorio
  - Acceptance: Project Hub ofrece abrir el repositorio en Terminal mediante un comando Tauri validado, rechazando rutas inexistentes.
  - Verify: `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y `node --check desktop/src/main.js`.
  - Files: `desktop/src-tauri/src/lib.rs`, `desktop/src/index.html`, `desktop/src/main.js`

- [x] Task: Conectar Changes al ProjectSnapshot
  - Acceptance: Changes muestra la Task real priorizando estados de revisión y un estado vacío explícito cuando no hay Tasks.
  - Verify: `node --check desktop/src/main.js`.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`

- [x] Task: Hacer Knowledge accionable
  - Acceptance: Knowledge abre specs canónicas mediante Tauri y rechaza rutas fuera de `docu/specs`.
  - Verify: `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y `node --check desktop/src/main.js`.
  - Files: `desktop/src-tauri/src/lib.rs`, `desktop/src/index.html`, `desktop/src/main.js`

- [x] Task: Proteger el contrato de la vertical desktop
  - Acceptance: una prueba verifica las cinco áreas MVP y sus acciones/puentes Tauri críticos.
  - Verify: `npm run build`, `npm test` y `node --check desktop/src/main.js`.
  - Files: `tests/desktop-ui-contract.test.ts`

- [x] Task: Integrar lifecycle del sidecar con Tauri
  - Acceptance: Tauri arranca, supervisa y termina el sidecar sin procesos huérfanos; un error produce estado recuperable en la shell. Supervisor, conexión de streams, render del snapshot, estados `ready/failed`, parada segura incluso tras salida inesperada, un único reintento automático y recuperación manual desde Runtime implementados; smoke de desarrollo y bundle con `ADE_DB_PATH` y `ADE_PROJECT_ID` explícitos superados.
  - Verify: `npm run desktop:smoke` en macOS con permisos de ejecución de app.
  - Files: `desktop/src-tauri/`, `docu/spikes/004-desktop-transport.md`

- [x] Task: Empaquetar el sidecar para macOS
  - Acceptance: `.app` incluye un sidecar ejecutable o runtime autocontenido compatible, y conserva la ruta configurable de `ADE_DB_PATH`. Ejecutable Node SEA arm64 incluido en el recurso Tauri y validado fuera del workspace con DB externa.
  - Verify: `ADE_SEA_NODE=/ruta/node22 npm run desktop:package:app` y ejecución sobre repositorio temporal sin depender del workspace; bundle arm64 verificado. El target `.dmg` queda separado por un fallo del `bundle_dmg.sh` del entorno.
  - Files: `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/binaries/`, `scripts/build-desktop-sidecar.mjs`

- [x] Task: Implementar vertical desktop mínima
  - Plan: [desktop-shell-plan.md](desktop-shell-plan.md)
  - Acceptance: Project Hub, Work, Changes, Knowledge y Runtime permiten recorrer una Task con estados, gates y escape hatch visibles; el contrato de UI y el arranque/parada del bundle están cubiertos.
  - Verify: `npm run desktop:test`, `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y `npm run desktop:smoke`.
  - Files: `src/ui/`, `tests/ui/`

## v0.2 — Operación verificable

- [x] Task: Persistir evidencia de runtime
  - Acceptance: eventos resumidos de Implementer/health/logs se persisten por Task y sesión, con límites, migración y exclusión de secretos.
  - Verify: build, tests de SQLite/migración y captura/consulta de evidencia.
  - Files: `src/domain/`, `src/persistence/`, `src/application/`, `tests/`

- [x] Task: Exponer detalle de Task y runtime history
  - Acceptance: `task.detail` y `runtime.history` rehidratan historial, ChangeSet, Review y evidencia de la Task seleccionada.
  - Verify: tests de read model y protocolo sidecar.
  - Files: `src/application/`, `src/desktop-sidecar.ts`, `tests/`

- [x] Task: Integrar gates y Review reales en Changes
  - Acceptance: Changes muestra gates/findings/evidencia reales y exige actor/razón para re-review y aprobación; no permite saltar gates. `task.approve` persiste la aprobación humana cuando build, tests y agent-review están cubiertos; `task.rereview` ejecuta una revisión independiente sobre el último ChangeSet.
  - Verify: tests de governance/UI y smoke del flujo de aprobación.
  - Files: `desktop/src/`, `src/application/`, `tests/`

- [x] Task: Implementar servicios locales declarados
  - Acceptance: Runtime inicia, inspecciona, comprueba y detiene servicios con timeout y lifecycle sin procesos huérfanos.
  - Verify: tests con procesos temporales, healthcheck y parada.
  - Files: `src/application/`, `src/adapters/`, `desktop/src-tauri/`, `tests/`

- [x] Task: Validar rehidratación completa de v0.2
  - Acceptance: el `.app` reinicia y conserva Task, runtime evidence, ChangeSet, Review y estado de gates desde una DB externa.
  - Verify: `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml`, `npm run desktop:package:app`, `npm run desktop:smoke` y test de rehidratación Task/Runtime/ChangeSet/Review/gates.
  - Files: `scripts/`, `tests/`, `docu/spikes/`

## v0.2 — Release cerrada

- [x] Task: Ejecutar smoke empaquetado completo en macOS gráfico
  - Acceptance: `.app`, sidecar incluido, OpenCode real y una Task en repositorio temporal se validan en el smoke; la ventana arranca y se detiene limpiamente.
- [x] Task: Validar OpenCode real desde la aplicación
  - Acceptance: `opencode serve --pure` permanece disponible y `runtime.health` responde durante el smoke empaquetado. Validado con OpenCode 1.18.26 en `127.0.0.1:4097`; la configuración con plugins mantiene `ServeError` como diagnóstico separado.
- [x] Task: Completar declaración persistida de servicios por Project
  - Acceptance: Runtime lee servicios desde `.ade/services.json`, toma el primero declarado como default y evita comandos hardcodeados en la UI.
- [x] Task: Cerrar contrato de evidencia y policy de gates
  - Acceptance: límites de tamaño/retención, policy mínima por Project y evidencia de documentación quedan especificados, implementados y cubiertos por tests. `documentation-review` es gate por defecto y `knowledge.reconcile.apply` persiste la evidencia vinculada a la Task.

## v0.3 — Workspace agéntico local-first — Release cerrada

- [x] Task: Implementar Workspace Core
  - Acceptance: árbol local navegable, visor/apertura y terminal nativa con cwd y permisos validados; el árbol usa expansión perezosa y la raíz canónica bloquea escapes y symlinks externos.
  - Verify: `npm run build`, `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y prueba manual macOS.
- [x] Task: Integrar proveedores agénticos
  - Acceptance: Codex/OpenCode se detectan, seleccionan y diagnostican sin persistir credenciales. OpenCode HTTP y Codex CLI están conectados al runner; las sesiones se persisten por Task y las skills retransmiten eventos hasta `session.idle`. Codex captura y retoma el `thread_id` real; la actividad de skills queda como evidencia persistida por sesión. La conversación completa del proveedor queda fuera de alcance.
  - Verify: contract tests con fakes y smoke de health.
- [x] Task: Distribuir catálogo nativo de skills
  - Acceptance: skills de prompt, review, Spector, workflow, UML, QA, estimación y Git declaran manifest, permisos, versión y trazabilidad. Catálogo, carga/ejecución de skills de proyecto, instalación local/Git y runners OpenCode/Codex están implementados; ADE bloquea `write_code`, `run_commands` y `network` sin concesión por ejecución. La instalación es accionable desde el workbench y una fuente de red se rechaza con `SKILL_INSTALL_CONFIRMATION_REQUIRED` sin confirmación.
  - Verify: validación de manifests, instalación local y ejecución de una skill fixture.
- [x] Task: Integrar Git y GitHub con Tasks
  - Acceptance: branch, diff, worktree, commit y PR muestran actor, razón, ChangeSet y gates; operaciones peligrosas piden confirmación. `gitWorkflow` admite `pull-request` o `direct` (commit+push), Task→operación se persiste y la UI muestra el resultado de PR. Las operaciones se atribuyen a la Task seleccionada, `commit.create` devuelve su SHA, `push` resuelve la rama actual y `github.status` es accionable; Changes presenta ChangeSet, gates y findings, y Git mantiene su traza separada.
  - Verify: fixtures Git y contract tests GitHub.
- [x] Task: Implementar documentación viva y consultoría
  - Acceptance: cambios en specs calculan impacto sobre Nexus, citers, diagramas, QA docs y estimaciones; la reconciliación genera automáticamente informes Markdown, QA y estimación bajo `docu/generated/`, actualiza su traza idempotente en el Nexus y satisface la gate documental de la Task. Los cambios semánticos no deterministas quedan para revisión humana.
  - Verify: grafo, headings rotos, impacto transitivo y tests de sync.
- [x] Task: Integrar Workspace v0.3 y validar release
  - Acceptance: el smoke empaquetado valida app, sidecar, OpenCode real, Task real, persistencia de evidencia/gates tras reinicio del sidecar y arranque/parada limpia; el recorrido visual de Git/documentación queda cubierto por la shell y sus contract tests.
  - Verify: smoke gráfico macOS, OpenCode real, rehidratación y suites completas.

## Post-v0.3 — Refinamiento de shell (2026-09-04)

- [x] Task: Mantener sincronizada la identidad del Project seleccionado en toda la shell
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md) · [SPEC-git-collaboration.md](../docu/specs/SPEC-git-collaboration.md)
  - ADR: [0018-active-project-context-state.md](../docu/adr/0018-active-project-context-state.md)
  - Acceptance: cambiar de Project desde Projects o la topbar actualiza nombre, ruta, Git/No Git y branch sin que un snapshot asíncrono restaure el Project inicial.

- [x] Task: Sincronizar la interacción de Explorer y terminal con la shell actual
  - Acceptance: tema claro/oscuro persistente, navegación lateral redimensionable y persistida por Project, Explorer compacto/expandido con animación fluida, búsqueda recursiva file-first con índice reutilizable, debounce, spinner de carga, ruta contextual para distinguir homónimos y restauración de la rama breadcrumb al seleccionar, dock inferior redimensionable y terminal PTY con transcript único, prompt mínimo, historial y completado de rutas `cd`.
  - Verify: `npm run build`, `npm test` y `cargo test --manifest-path desktop/src-tauri/Cargo.toml`.
  - Files: `desktop/src/`, `desktop/src-tauri/src/lib.rs`, `DESIGN.md`, `docu/specs/`.

## Terminal tabs

- [x] Task: Añadir tabs de terminal PTY independientes
  - Spec: [SPEC-workspace-core.md](../docu/specs/SPEC-workspace-core.md) · [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md)
  - ADR: [0015-terminal-tabs.md](../docu/adr/0015-terminal-tabs.md)
  - Acceptance: el dock crea, selecciona y cierra tabs; cada tab mantiene un PTY, transcript, cwd, historial y autocompletado independientes; cambiar de tab no reinicia sesiones ni mezcla salida; cerrar un tab libera sólo su proceso y mantiene un tab activo mientras haya sesiones. ✅
  - Verify: `npm run build`, `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y smoke manual macOS.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`, `desktop/src-tauri/src/lib.rs`, `tests/`, `docu/specs/`.

## v0.4 — Workspace interno

- [x] Task: Abrir ficheros dentro de ADE
  - Spec: [SPEC-file-workspace.md](../docu/specs/SPEC-file-workspace.md)
  - ADR: [0014-internal-file-viewer.md](../docu/adr/0014-internal-file-viewer.md)
  - Acceptance: seleccionar un fichero de texto abre un editor interno que ocupa toda su superficie; permite editar, guardar con `Save` o `⌘/Ctrl+S`, descartar cambios y abrir externamente de forma explícita. Binarios, errores y ficheros demasiado grandes muestran estado explicativo. La escritura queda confinada a la raíz canónica del Project.
  - Verify: `npm run build`, `npm test` y `cargo test --manifest-path desktop/src-tauri/Cargo.toml`; bundle `.app` generado y arrancado manualmente en macOS; smoke gráfico automatizado pendiente.
  - Files: `desktop/src/`, `desktop/src-tauri/src/lib.rs`, `tests/`, `docu/specs/`.

- [x] Task: Convertir Overview en Projects y admitir carpetas No Git
  - Spec: [SPEC-project-task-workflow.md](../docu/specs/SPEC-project-task-workflow.md) · [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md)
  - ADR: [0017-projects-and-editor-navigation.md](../docu/adr/0017-projects-and-editor-navigation.md)
  - Acceptance: Projects lista Projects persistidos, permite añadir una carpeta local desde el selector macOS, distingue Git/No Git, permite retirar un Project del seguimiento sin tocar sus ficheros y muestra sólo el título activo y las métricas compactas; el selector superior usa el mismo catálogo.
  - Verify: `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml`, build desktop y alta manual de una carpeta con y sin Git.

- [x] Task: Convertir el visor en Editor navegable
  - Acceptance: Editor es una opción lateral explícita; abrir o buscar un fichero activa Editor y conserva edición, guardado, descarte y estado vacío.
  - Verify: contrato UI, `node --check desktop/src/main.js` y prueba manual de apertura desde Explorer.

- [x] Task: Añadir selector visual de repositorio y branch
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md) · [SPEC-git-collaboration.md](../docu/specs/SPEC-git-collaboration.md)
  - ADR: [0016-git-context-switcher.md](../docu/adr/0016-git-context-switcher.md)
  - Acceptance: la topbar sustituye Quick Open por selectores de Project Git y branch; Project lista los repositorios persistidos, branch lista las ramas locales bajo demanda y ambos estados son accesibles.
  - Verify: `npm test`, `node --check desktop/src/main.js`, build desktop y prueba manual de cambio de Project/branch en macOS.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`, `src/desktop-sidecar.ts`, `src/application/git/git-mutations.ts`, `tests/`.

- [x] Task: Añadir affordance de búsqueda al Explorer
  - Acceptance: una lupa junto a `Explorer` enfoca el buscador existente sin duplicar la lógica de búsqueda.
  - Verify: test de contrato UI y navegación por teclado.
