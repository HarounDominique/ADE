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
  - Acceptance: Tauri arranca, supervisa y termina el sidecar sin procesos huérfanos; un error produce estado recuperable en la shell. Supervisor, conexión de streams, render del snapshot, estados `ready/failed`, parada segura incluso tras salida inesperada y un único reintento automático implementados; la recuperación no requiere una vista Runtime independiente. Smoke de desarrollo y bundle con `ADE_DB_PATH` y `ADE_PROJECT_ID` explícitos superados.
  - Verify: `npm run desktop:smoke` en macOS con permisos de ejecución de app.
  - Files: `desktop/src-tauri/`, `docu/spikes/004-desktop-transport.md`

- [x] Task: Empaquetar el sidecar para macOS
  - Acceptance: `.app` incluye un sidecar ejecutable o runtime autocontenido compatible, y conserva la ruta configurable de `ADE_DB_PATH`. Ejecutable Node SEA arm64 incluido en el recurso Tauri y validado fuera del workspace con DB externa.
  - Verify: `ADE_SEA_NODE=/ruta/node22 npm run desktop:package:app` y ejecución sobre repositorio temporal sin depender del workspace; bundle arm64 verificado. El target `.dmg` queda separado por un fallo del `bundle_dmg.sh` del entorno.
  - Files: `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/binaries/`, `scripts/build-desktop-sidecar.mjs`

- [x] Task: Implementar vertical desktop mínima
  - Plan: [desktop-shell-plan.md](desktop-shell-plan.md)
  - Acceptance: Project Hub, Work, Changes y Knowledge permiten recorrer una Task con estados, gates y escape hatch visibles; runtime y servicios se consumen como infraestructura transversal, y el contrato de UI y el arranque/parada del bundle están cubiertos.
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
  - Acceptance: Codex/Claude Code/OpenCode se detectan, seleccionan y diagnostican sin persistir credenciales. OpenCode HTTP, Codex CLI y Claude Code CLI están conectados al runner; las sesiones se persisten por Task y las skills retransmiten eventos hasta `session.idle` cuando el proveedor los ofrece. Codex captura y retoma el `thread_id` real; Claude Code captura y retoma `session_id`; la actividad de skills queda como evidencia persistida por sesión. La conversación completa del proveedor queda fuera de alcance.
  - Verify: contract tests con fakes y smoke de health.
- [x] Task: Distribuir catálogo nativo de skills
  - Acceptance: skills de prompt, review, Spector, workflow, UML, QA, estimación y Git declaran manifest, permisos, versión y trazabilidad. Catálogo, carga/ejecución de skills de proyecto, instalación local/Git y runners OpenCode/Codex/Claude Code están implementados; ADE bloquea `write_code`, `run_commands` y `network` sin concesión por ejecución. Las operaciones del sidecar exponen catálogo, instalación, actualización y ejecución; la vista primaria Agents no incorpora gestión de skills. Una fuente de red se rechaza con `SKILL_INSTALL_CONFIRMATION_REQUIRED` sin confirmación.
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
  - Acceptance: tema claro/oscuro persistente, navegación lateral redimensionable y persistida por Project, Explorer compacto/expandido con animación fluida, búsqueda recursiva file-first con índice reutilizable, debounce, spinner de carga, ruta contextual para distinguir homónimos y restauración de la rama breadcrumb al seleccionar, dock inferior redimensionable y terminal PTY con tabs independientes, transcript por sesión, prompt mínimo, historial y completado de rutas `cd`.
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

- [x] Task: Ampliar el Editor con motores de lenguaje permisivos
  - Spec: [SPEC-file-workspace.md](../docu/specs/SPEC-file-workspace.md) · [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md)
  - ADR: [0023-code-editor-and-formatting.md](../docu/adr/0023-code-editor-and-formatting.md)
  - Acceptance: CodeMirror cubre los lenguajes oficiales incorporados y Monaco se activa automáticamente como fallback para C, C#, Go, Dart, Dockerfiles, Elixir, F#, GraphQL, Kotlin, Lua, Objective-C, Perl, PowerShell, Protocol Buffers, R, Ruby, Scala, Shell y Swift; edición, guardado, descarte, temas y atajos permanecen comunes.
  - Verify: `npm test`, `npm run build`, `npm --prefix desktop run build`, `npm run desktop:package:app` y arranque manual del `.app` en macOS.
  - Files: `desktop/src/main.js`, `desktop/src/styles.css`, `desktop/build.mjs`, `desktop/package.json`, `desktop/package-lock.json`, `tests/desktop-ui-contract.test.ts`, `docu/`, `desktop/THIRD_PARTY_LICENSES.md`.

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

- [x] Task: Exponer Agents como superficie conversacional
  - Spec: [SPEC-agent-providers.md](../docu/specs/SPEC-agent-providers.md) · [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md)
  - ADR: [0024-agent-surface.md](../docu/adr/0024-agent-surface.md)
  - Acceptance: ADE muestra `Agents` con selección Codex/Claude Code/OpenCode, sesiones nuevas o reanudables, transcript persistido, prompt asociado al Project/Task, selector de modelo dependiente del provider y permisos sensibles concedidos por ejecución. El modelo seleccionado se transmite al runtime y el catálogo se refresca al cambiar de conversación.
  - Verify: `npm run build` y `npm test`.
  - Files: `src/desktop-sidecar.ts`, `src/persistence/sqlite-store.ts`, `src/ports/agent-runtime.ts`, `desktop/src/`, `tests/`.

- [x] Task: Priorizar conversación en Agents y alinear documentación
  - Acceptance: Agents conserva sesiones y conversación como superficie primaria, elimina el inspector lateral de actividad/ficheros/skills y mantiene la evidencia en los registros operativos; README, diseño, specs, ADR y Nexus describen el mismo contrato.
  - Verify: `npm run build`, `npm test`, `git diff --check` y revisión de referencias.
  - Files: `desktop/src/`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `docu/`, `tasks/`.

- [x] Task: Reservar Git workspace a Version control
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md) · [SPEC-git-collaboration.md](../docu/specs/SPEC-git-collaboration.md)
  - Acceptance: el panel operativo `Git workspace` sólo aparece en `Version control`; Projects, Editor, Agents, Work y Project context no duplican su estado ni sus acciones Git, mientras la topbar conserva el contexto global de Project y branch.
  - Verify: `npm test`, `npm run build`, `git diff --check` y comprobación manual del `.app` en macOS.
  - Files: `desktop/src/main.js`, `desktop/src/styles.css`, `tests/desktop-ui-contract.test.ts`, `docu/`.

- [x] Task: Endurecer la shell desktop y su carga inicial
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md) · [SPEC-file-workspace.md](../docu/specs/SPEC-file-workspace.md)
  - ADR: [0023-code-editor-and-formatting.md](../docu/adr/0023-code-editor-and-formatting.md)
  - Acceptance: no hay chrome simulado ni fixtures de Tasks; Knowledge y Git sólo muestran sus paneles propios; Tasks, tabs y diálogos son accesibles por teclado; la ventana macOS conserva un workbench usable al redimensionar; Monaco y Prettier no bloquean la carga inicial.
  - Verify: `node --check desktop/src/main.js`, `npm run build`, `npm --prefix desktop run build`, `npm test`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml` y `git diff --check`.
  - Files: `desktop/src/`, `desktop/src-tauri/tauri.conf.json`, `tests/desktop-ui-contract.test.ts`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `docu/`.

## Version control hardening — 2026-09-06

- [x] Task: Consolidar Changes como split real de working tree y diff
  - Acceptance: la lista de cambios y el diff usan dos paneles flexibles sin tracks implícitos ni huecos reservados; seleccionar un fichero actualiza el diff dominante.
  - Verify: `npm test` (115 tests TypeScript), `npm run build` y bundle `.app` macOS.
  - Specs: [SPEC-desktop-shell](../docu/specs/SPEC-desktop-shell.md#version-control), [SPEC-git-collaboration](../docu/specs/SPEC-git-collaboration.md#git-workspace), [ADR-0028](../docu/adr/0028-github-desktop-version-control-parity.md).

- [x] Task: Hacer History colapsable y legible en cambios de layout
  - Acceptance: commits y ficheros modificados se contraen de forma independiente; cada panel conserva un control de restauración accesible, alineado con su cabecera y animado salvo `prefers-reduced-motion`.
  - Verify: `npm test` (115 tests TypeScript) y revisión manual del `.app`.

- [x] Task: Adaptar el diff al ancho disponible
  - Acceptance: líneas largas del diff se reenvuelven sin perder espacios, color ni selección; el ancho útil se recalcula al expandir, contraer o redimensionar columnas.
  - Verify: `npm test` (115 tests TypeScript), `npm run build` y revisión manual de Changes/History.

## Agents workbench — 2026-09-06

- [x] Task: Reorganizar Agents por Task con conversación dominante
  - Plan: [plan-agent-workbench-parity.md](plan-agent-workbench-parity.md)
  - Spec: [SPEC-agent-providers.md](../docu/specs/SPEC-agent-providers.md#next-iteration-agent-workbench) · [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md#agents)
  - ADR: [0029-chatgpt-inspired-agent-workbench.md](../docu/adr/0029-chatgpt-inspired-agent-workbench.md)
  - Acceptance: el rail muestra sólo conversaciones del Project activo, agrupadas por Task y `General`; el thread usa todo el ancho restante; provider/modelo/permisos siguen siendo explícitos y cambiar de provider crea una sesión nueva sin falsear su reanudación.
  - Verify: `npm run build`, `npm --prefix desktop run build`, `npm test` (117 TypeScript tests), contratos de agrupación/invalidation/provider-modelo y smoke macOS pendiente de provider real disponible.
  - Files: `src/persistence/`, `src/desktop-sidecar.ts`, `desktop/src/`, `tests/`, `docu/`.

## Cierre del bucle — backlog abierto (2026-09-08)

Auditoría de origen: [product-gap-audit](../docu/knowledge/product-gap-audit.md). Cada tarea cita el hueco que cierra.

- [x] Task: Convertir un turno de `Agents` en ChangeSet y evidencia (G1)
  - Spec: [SPEC-changes-review-governance.md](../docu/specs/SPEC-changes-review-governance.md) · [SPEC-agent-runtime.md](../docu/specs/SPEC-agent-runtime.md)
  - Acceptance: un turno con permiso de escritura sobre una Task activa produce el mismo `ChangeSet` y la misma evidencia con Claude Code, Codex y OpenCode; `task.run` deja de ser el único camino al pipeline y ningún proveedor queda cableado en el sidecar.
  - Verify: `npm test` (266 tests TypeScript, incluidos cuatro sobre repositorio Git temporal) y contrato de que el sidecar no instancia un proveedor fijo. Smoke manual con un proveedor real pendiente.
  - Files: `src/application/agents/capture-turn-change-set.ts`, `src/desktop-sidecar.ts`, `src/application/run-spike.ts`, `tests/agent-turn-capture.test.ts`, [ADR-0043](../docu/adr/0043-agent-turn-as-pipeline-entry.md).
  - Abierto: el ChangeSet retrata el working tree completo, no el delta del turno; distinguirlos depende de G6.

- [x] Task: Alimentar las gates `build` y `tests` con ejecuciones reales (G2, G3)
  - Spec: [SPEC-changes-review-governance.md](../docu/specs/SPEC-changes-review-governance.md) · [SPEC-run-configurations.md](../docu/specs/SPEC-run-configurations.md)
  - Acceptance: una configuración de run marcada como verificación escribe `RuntimeEvidence` con código de salida y cola de salida acotada, ligada a la Task; `build` y `tests` pasan por esa evidencia y no por la existencia de un ChangeSet; una gate sin productor no es `required` por defecto.
  - Verify: `npm test` (272 tests TypeScript) con casos de éxito, fallo, run detenido y ausencia de ejecución. Revisión manual de Changes pendiente.
  - Files: `src/domain/run-configuration.ts`, `src/application/local-runtime/verification-evidence.ts`, `src/application/local-runtime/run-config.ts`, `src/application/local-runtime/run-detection.ts`, `src/application/change-review-read-model.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `tests/verification-gates.test.ts`, [ADR-0044](../docu/adr/0044-verification-gates-from-real-runs.md).

- [x] Task: Publicar el resultado aprobado como commit atribuido (G4, G5)
  - Spec: [SPEC-changes-review-governance.md](../docu/specs/SPEC-changes-review-governance.md) · [SPEC-git-collaboration.md](../docu/specs/SPEC-git-collaboration.md)
  - Acceptance: existe un seam `ship` que sólo commitea con aprobación humana y gates requeridas en `passed`/`waived`; el commit de `Version control` envía `taskId` y queda registrado en la traza Git de la Task.
  - Verify: `npm test` (278 tests TypeScript) con aprobación ausente, gate fallida, árbol limpio y publicación completa sobre repositorio Git temporal.
  - Files: `src/application/tasks/ship-from-store.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `desktop/src/styles.css`, `tests/task-ship.test.ts`, [ADR-0045](../docu/adr/0045-ship-the-approved-task.md).
  - Hallazgo: el panel de gobernanza había desaparecido de la shell y `Approve`/`Re-review` eran inejecutables; recuperan superficie en el detalle de la Task.

- [x] Task: Dar punto de retorno a un turno con escritura (G6)
  - Spec: [SPEC-agent-providers.md](../docu/specs/SPEC-agent-providers.md) · [SPEC-changes-review-governance.md](../docu/specs/SPEC-changes-review-governance.md) · ADR: [0048-checkpoint-before-a-writing-turn](../docu/adr/0048-checkpoint-before-a-writing-turn.md)
  - Acceptance: un turno con `write_code`/`write_docs` deja un checkpoint restaurable antes de ejecutarse, visible desde la Task y reversible con confirmación explícita; no se crean commits en la rama del usuario sin pedirlo.
  - Verify: `npm test` (300 tests TypeScript, siete nuevos sobre repositorio Git temporal: foto sin tocar `HEAD`, índice ni rama; restauración de lo modificado, lo borrado y lo inventado; repositorio sin primer commit; confirmación obligatoria).
  - Files: `src/application/agents/turn-checkpoint.ts`, `src/application/agents/task-checkpoints.ts`, `src/persistence/sqlite-store.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `tests/turn-checkpoint.test.ts`.
  - Abierto: las referencias `refs/ade/checkpoints/` no se podan, y el delta del turno —que ahora sería calculable contra la foto— sigue sin calcularse.

- [x] Task: Mostrar el coste del trabajo agéntico (G7)
  - Spec: [SPEC-agent-runtime.md](../docu/specs/SPEC-agent-runtime.md#turn-accounting) · ADR: [0040-agent-turn-accounting](../docu/adr/0040-agent-turn-accounting.md) · [0049-turn-cost-read-where-the-work-is](../docu/adr/0049-turn-cost-read-where-the-work-is.md)
  - Acceptance: la conversación y la Task pueden decir qué consumieron por turno y en total, distinguiendo cache; una sesión sin contabilidad se muestra como desconocida y nunca como cero.
  - Verify: `npm test` (307 tests TypeScript, seis nuevos sobre totales de sesión y de Task: cache separada, turno sin precio, mezcla de turnos con y sin coste, y ausencia frente a cero).
  - Files: `src/persistence/sqlite-store.ts`, `src/application/task-detail.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `desktop/src/index.html`, `desktop/src/styles.css`, `tests/agent-usage-totals.test.ts`.
  - Abierto: OpenCode sigue sin exponer consumo en su seam, de modo que sus conversaciones se leen como no contabilizadas.

- [x] Task: Resolver distribución y actualización del `.app` (G8)
  - Spec: [SPEC-cross-platform-support.md](../docu/specs/SPEC-cross-platform-support.md#distribution-and-update) · ADR: [0050-installable-artifact-and-update-notice](../docu/adr/0050-installable-artifact-and-update-notice.md)
  - Acceptance: existe un artefacto instalable reproducible y la app puede informar de que hay una versión más reciente; la instalación deja de ser un reemplazo manual del bundle.
  - Verify: `npm test` (314 tests TypeScript, siete nuevos sobre orden de versiones, feed publicado, feed inalcanzable y forma del script), `npm run desktop:release` sobre el bundle real —`.dmg` montado y comprobado: `Assay.app` con su sidecar y enlace a `/Applications`— y `npm run desktop:smoke`.
  - Files: `scripts/package-desktop-release.mjs`, `src/application/release/update-check.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `desktop/src/index.html`, `desktop/src/styles.css`, `package.json`, `tests/app-release.test.ts`.
  - Abierto: el artefacto no está firmado ni notarizado, Windows y Linux siguen sin artefacto propio y publicar la release sigue siendo manual.

## Aviso al desarrollador — 2026-09-09

- [x] Task: Avisar con un tono cuando un turno termina
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md#agents) · ADR: [0046-turn-chime-and-frozen-remote-notice](../docu/adr/0046-turn-chime-and-frozen-remote-notice.md)
  - Acceptance: un turno completado o fallido emite un tono corto; uno detenido por el operador no; el tono está encendido por defecto, se silencia desde la cabecera y la preferencia sobrevive al reinicio.
  - Verify: `npm test` (279 tests TypeScript) y comprobación manual en el `.app`.
  - Files: `desktop/src/main.js`, `desktop/src/index.html`, `desktop/src/styles.css`, `tests/desktop-ui-contract.test.ts`.

- [ ] Task: Aviso remoto al desarrollador (congelado)
  - ADR: [0046-turn-chime-and-frozen-remote-notice](../docu/adr/0046-turn-chime-and-frozen-remote-notice.md)
  - Alcance registrado: casilla de aviso por turno junto a los permisos —fuera de `grantedPermissions`—, correo por SMTP con la credencial en el keychain del sistema, webhook saliente como alternativa, y contenido mínimo: Project, Task, una frase y desenlace. Sin prompts, diffs ni salida salvo opt-in explícito.
  - Bloqueado por: no existe configuración de usuario en ADE y el correo añade dos fronteras de plataforma a las siete declaradas en [SPEC-cross-platform-support](../docu/specs/SPEC-cross-platform-support.md#platform-boundary).

## Cierre del juicio verificable — 2026-09-09

Huecos de producto detectados al revisar Assay contra `PRODUCT.md` con el backlog de `product-gap-audit` ya cerrado.

- [x] Task: Dar a la Task un listón escrito antes de empezar
  - Spec: [SPEC-project-task-workflow.md](../docu/specs/SPEC-project-task-workflow.md#domain-model) · ADR: [0051-acceptance-criteria-belong-to-the-task](../docu/adr/0051-acceptance-criteria-belong-to-the-task.md)
  - Acceptance: la Task guarda criterios de aceptación comprobables; no pasa a `READY` sin al menos uno; los criterios llegan al turno del agente, al prompt del reviewer y al detalle donde se aprueba; cambiarlos queda en el historial.
  - Verify: `npm test` (321 tests TypeScript, cinco nuevos sobre la puerta de `READY`, el registro del cambio, el round-trip con filas antiguas, el prompt del agente y el seam del sidecar).
  - Files: `src/domain/task.ts`, `src/persistence/sqlite-store.ts`, `src/application/tasks/task-commands.ts`, `src/application/review-change-set.ts`, `src/adapters/opencode-reviewer.ts`, `src/application/structural-context/ask-briefing.ts`, `src/desktop-sidecar.ts`, `desktop/src/`, `tests/task-acceptance.test.ts`.
  - Abierto: el reviewer no dice todavía qué criterio incumple cada finding.

- [x] Task: Revisar con el proveedor que el operador tenga
  - Spec: [SPEC-changes-review-governance.md](../docu/specs/SPEC-changes-review-governance.md#review-and-finding-contract) · ADR: [0052-review-runs-on-the-operators-provider](../docu/adr/0052-review-runs-on-the-operators-provider.md)
  - Acceptance: la review deja de exigir OpenCode; `ReviewerPort` se resuelve por proveedor como ya hace el turno, y una gate `agent-review` es alcanzable con Claude o Codex.
  - Verify: `npm test` (328 tests TypeScript, siete nuevos: review CLI con JSON envuelto en prosa, transcript JSONL de Codex, salida estructurada de OpenCode por el mismo contrato, respuesta ilegible rechazada, prompt sin criterios y elección de proveedor).
  - Files: `src/adapters/review-contract.ts`, `src/adapters/cli-reviewer.ts`, `src/adapters/provider-runtime.ts`, `src/adapters/opencode-reviewer.ts`, `src/desktop-sidecar.ts`, `desktop/src/main.js`, `tests/cli-reviewer.test.ts`.
  - Abierto: un finding no dice todavía qué criterio de aceptación incumple.

- [x] Task: Dar a Assay configuración de usuario
  - Spec: [SPEC-desktop-shell.md](../docu/specs/SPEC-desktop-shell.md) · ADR: [0053-user-settings-live-in-ades-store](../docu/adr/0053-user-settings-live-in-ades-store.md)
  - Acceptance: existe una superficie de ajustes persistida fuera de `localStorage`; el tono, el modelo por defecto y el feed de actualización viven ahí, y desbloquea las preferencias que hoy congelan capacidades.
  - Verify: `npm test` (333 tests TypeScript, cinco nuevos sobre defaults, escritura parcial que no borra lo demás, limpieza de un modelo por defecto, trimado del feed y el seam del sidecar).
  - Files: `src/persistence/sqlite-store.ts`, `src/application/settings/settings.ts`, `src/desktop-sidecar.ts`, `desktop/src/index.html`, `desktop/src/main.js`, `desktop/src/styles.css`, `tests/user-settings.test.ts`.
  - Abierto: no hay preferencia por Project, y el aviso remoto sigue frenado por sus dos fronteras de plataforma, ya no por falta de configuración.

## Editor en varias ventanas — 2026-09-09

Pregunta del operador: separar un tab del Editor a su propia ventana, para trabajar con varios monitores. Troceado para pagar lo frágil al final, no al principio.

- [x] Task: Dar al editor una superficie que cualquier ventana pueda pedir (1a)
  - Acceptance: CodeMirror, Monaco, el cambio entre motores, el tema y el caret viven en un módulo con estado propio por instancia; la shell habla de documentos y delega el editor; el comportamiento del Editor no cambia.
  - Verify: `npm test` (336 tests TypeScript, con los contratos del editor apuntando ya al módulo y uno nuevo que prohíbe a la shell tocar los motores), `npm --prefix desktop run build`. Comprobación manual del Editor en el `.app` pendiente.
  - Files: `desktop/src/code-editor.js`, `desktop/src/paths.js`, `desktop/src/main.js`, `tests/desktop-ui-contract.test.ts`.

- [x] Task: Abrir un fichero del Editor en su propia ventana (1b)
  - Spec: [SPEC-file-workspace.md](../docu/specs/SPEC-file-workspace.md#product-contract)
  - Acceptance: una acción del tab mueve —no clona— el documento a una ventana propia con su editor completo; un buffer sin guardar no se pierde; cerrar la ventana devuelve el fichero; la capability nombra la ventana nueva y las pestañas persistidas no se pisan entre ventanas.
  - Verify: `npm test` (338 tests TypeScript, dos nuevos: el traslado con su guardado previo y su vuelta, y la ventana con su capability acotada y su diálogo propio de cierre), `npm --prefix desktop run build`. Comprobación manual sobre dos monitores pendiente.
  - Files: `desktop/src/editor-window.html`, `desktop/src/editor-window.js`, `desktop/src/main.js`, `desktop/src/index.html`, `desktop/src/styles.css`, `desktop/build.mjs`, `desktop/src-tauri/capabilities/`.
  - Abierto: la ventana suelta no formatea con Prettier ni renderiza Markdown; ambas siguen siendo de la ventana principal.

- [x] Task: Separar un tab arrastrándolo fuera de la ventana (2)
  - Spec: [SPEC-file-workspace.md](../docu/specs/SPEC-file-workspace.md#product-contract)
  - Acceptance: soltar un tab fuera de la ventana abre la ventana del paso 1b; soltarlo dentro no cambia nada.
  - Verify: `npm test` (339 tests TypeScript, uno nuevo sobre el gesto, la escala del monitor y la negativa a separar sin límites legibles), `npm --prefix desktop run build`. Comprobación manual sobre dos monitores pendiente.
  - Files: `desktop/src/main.js`, `desktop/src/styles.css`.
  - Abierto: sólo se ha ejercitado en macOS; el gesto es lo único de esta serie que puede necesitar ajuste por plataforma.

