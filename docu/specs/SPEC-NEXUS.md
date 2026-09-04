# Nexus: ADE — Agentic Development Environment

**Estado:** v0.1 MVP implementado; v0.2 cerrada; v0.3 cerrada; slice v0.4 file-workspace implementada y validada
**Fecha:** 2026-09-02  
**Fuente:** informe fundacional de ADE proporcionado por el usuario

Este nexus es el índice único de las specs de ADE. Las specs se citan por `module id + heading`, nunca por número de línea.

## Product brief

ADE es una **Agentic Software Engineering Workstation** para el desarrollador individual avanzado que dirige agentes capaces de explorar, modificar y verificar software. El problema que resuelve es la fragmentación entre agente, IDE, terminal, Git, documentación, skills y runtime: ninguna herramienta representa simultáneamente la intención, el contexto, el cambio y su aceptabilidad.

La visión es que el humano dirija intención y restricciones, los agentes ejecuten trabajo y ADE haga observable, verificable, reversible y revisable el resultado. ADE no compite por tener el mejor modelo: organiza el workflow por encima de modelos y runtimes intercambiables.

Éxito inicial significa que el usuario pueda trabajar una semana principalmente dentro de ADE y reducir drásticamente los cambios de contexto. La primera versión es desktop/local-first; el diseño debe poder evolucionar a equipos sin introducir cloud en el MVP.

## Product principles

- **Agent-first:** `Task`, no archivo ni editor, es la unidad principal.
- **Human-in-command:** el humano define intención, restricciones y aceptación.
- **Provider-agnostic:** cambiar de modelo no obliga a cambiar de workflow.
- **Documentation-first:** el conocimiento versionado expresa intención y arquitectura.
- **Verification-first:** el agente no es autoridad sobre su propio resultado.
- **Observable and reversible:** cada operación significativa tiene evidencia, atribución e historial.
- **Progressive autonomy:** permisos y automatización escalan según confianza y riesgo.

## Truth model

| Fuente | Qué representa | No debe sustituirse por |
|---|---|---|
| Código | Verdad ejecutable | Resumen del agente |
| Documentación | Verdad intencional y de diseño | Memoria opaca |
| Git | Verdad histórica | Timeline de ADE |
| Tests y runtime | Evidencia comportamental | Afirmación de “terminado” |
| ADE DB | Historial operativo | Estado del repositorio |
| ASK (futuro) | Evidencia estructural | Juicio humano |

## Tech Foundations

- Producto desktop, local-first y orientado inicialmente a un desarrollador avanzado.
- El dominio se organiza alrededor de `Project → Task → Agent → Change → Verification → Review`.
- OpenCode es el runtime inicial preferido, siempre detrás de un `AgentRuntimePort`.
- Git conserva código, documentación, skills e historial del repositorio.
- SQLite es la opción provisional para metadata operativa de ADE.
- Markdown y configuración versionable son el formato preferente de conocimiento.
- Implementer y Reviewer son roles separados; el reviewer recibe contexto fresco y evidencia.
- Las gates son declarativas y bloquean transiciones cuando una condición requerida falla.
- El workflow de desarrollo es adaptativo: las fases orientan, los gates protegen y los bucles permiten volver al punto que necesita nueva información.
- Tauri 2 es el framework adoptado para el shell desktop; el esquema operativo actual de `.ade/` usa JSON versionable y retrieval semántico sigue diferido.

## Modules

| Module id | Spec file | Responsibility | Depends on | Status | Blocked by |
|---|---|---|---|---|---|
| project-task-workflow | [SPEC-project-task-workflow.md](SPEC-project-task-workflow.md) | Projects, Tasks, conversaciones y estados | — | done | — |
| development-workflow | [SPEC-development-workflow.md](SPEC-development-workflow.md) | Transiciones adaptativas, skills de workflow y modos de ejecución | project-task-workflow | done | — |
| agent-runtime | [SPEC-agent-runtime.md](SPEC-agent-runtime.md) | Sesiones, implementer, reviewer y adapter | project-task-workflow | done | — |
| knowledge-docs | [SPEC-knowledge-docs.md](SPEC-knowledge-docs.md) | Documentación, skills, contexto y drift | project-task-workflow | done | — |
| changes-review-governance | [SPEC-changes-review-governance.md](SPEC-changes-review-governance.md) | ChangeSets, Git, gates, findings y aprobación | agent-runtime, knowledge-docs | done | — |
| local-runtime | [SPEC-local-runtime.md](SPEC-local-runtime.md) | Servicios, procesos, terminal, logs y tests | project-task-workflow | done | — |
| desktop-shell | [SPEC-desktop-shell.md](SPEC-desktop-shell.md) | Project Hub, navegación, visor y escape hatch | project-task-workflow, changes-review-governance, local-runtime | done | — |
| workspace-core | [SPEC-workspace-core.md](SPEC-workspace-core.md) | Terminal nativa, árbol local, archivos y contexto de workspace | desktop-shell, project-task-workflow | done | — |
| agent-providers | [SPEC-agent-providers.md](SPEC-agent-providers.md) | Proveedores agénticos, licencias, sesiones y permisos | agent-runtime, workspace-core | done | — |
| native-skills | [SPEC-native-skills.md](SPEC-native-skills.md) | Catálogo, instalación, versionado y ejecución de skills | knowledge-docs, development-workflow, agent-providers | done | — |
| git-collaboration | [SPEC-git-collaboration.md](SPEC-git-collaboration.md) | Git local, GitHub, branches, worktrees y PRs | workspace-core, changes-review-governance, agent-providers | done | — |
| living-knowledge | [SPEC-living-knowledge.md](SPEC-living-knowledge.md) | Grafo de referencias, specs vivas, diagramas y reconciliación | knowledge-docs, native-skills, workspace-core | done | — |
| file-workspace | [SPEC-file-workspace.md](SPEC-file-workspace.md) | Editor interno de texto, lectura/escritura segura y escape hatch externo | workspace-core, desktop-shell | done | — |

`done` identifica capacidades implementadas y verificadas; `planned` identifica una spec aprobada para una iteración posterior, todavía no implementada.

**Build order:** `project-task-workflow → development-workflow → agent-runtime + knowledge-docs + local-runtime → changes-review-governance → desktop-shell`.

**v0.3 build order:** `workspace-core → agent-providers + native-skills → git-collaboration + living-knowledge → desktop-shell integration`. `quality-consulting` se implementará como skills nativas sobre esos contratos.

Las ramas paralelas sólo pueden comenzar cuando `project-task-workflow` haya definido el contrato de Task y sus eventos mínimos. `development-workflow` define las transiciones que coordinan las ramas, pero no convierte cada fase en una obligación.

## v0.3 product direction

ADE evoluciona de shell desktop operativa a workspace agéntico local-first. El usuario debe poder abrir un repositorio, navegar su máquina, usar una terminal nativa, seleccionar un proveedor con licencia, ejecutar skills y mantener código y documentación viva dentro del mismo contexto.

La v0.3 prioriza `workspace-core`: sin contexto local navegable y terminal integrada, los demás módulos obligan al usuario a volver a cambiar de aplicación.

## Current implementation baseline

La aplicación macOS actual ofrece una shell desktop Tauri con navegación lateral única, Project Hub, Work, Knowledge, Changes y Runtime. El Explorer mantiene como hint la rama del archivo activo y puede convertirse en un árbol completo; ambos cambios tienen transición fluida. El tema claro/oscuro se alterna desde la esquina superior derecha y se conserva entre sesiones.

El dock inferior expone un único transcript de terminal PTY persistente, redimensionable y confinado a la raíz del Project. El prompt mínimo, Enter, historial con `↑`/`↓` y completado de directorios para `cd` con `Tab` están implementados; las sugerencias ambiguas se recorren con `↑`/`↓` y se cierran con `Esc`. La baseline de verificación actual es 82 tests TypeScript y 17 tests Rust; el `.app` macOS se empaqueta y el smoke de OpenCode real sigue validado históricamente. La selección de ficheros abre ahora dentro de ADE en el editor de texto definido en [SPEC-file-workspace](SPEC-file-workspace.md), con guardado y descarte acotados al Project.

## Current v0.4 slice

La slice v0.4 implementa [SPEC-file-workspace](SPEC-file-workspace.md): el fichero de texto seleccionado aparece dentro de ADE en un editor con superficie completa, lectura y escritura Tauri autorizadas, estado dirty, `Save`, `Discard`, límite de 2 MiB y apertura externa únicamente mediante una acción explícita. No se adelanta un editor completo.

## Scope boundary

Este nexus cubre MVP, v0.2 y la planificación v0.3. AgentMemory, ASK como dependencia, browser automation, cloud, sync realtime, colaboración multiusuario y productización siguen fuera. Los worktrees entran en v0.3 sólo como aislamiento Git local.

## MVP contract

El modo `standard` cubre: abrir repositorio, crear Task, resolver contexto, ejecutar Implementer, capturar ChangeSet, build/tests, resumen, Reviewer independiente, findings, re-review, reconciliación documental, aprobación humana y commit. El modo `quick` sirve para cambios pequeños; `recovery` permite reentrar tras nueva evidencia o un fallo. Ningún modo puede omitir los invariantes definidos en [SPEC-development-workflow.md#gates-and-invariants](SPEC-development-workflow.md#gates-and-invariants).

Los cuatro spikes previos a UI significativa son: integración OpenCode y eventos; Implementer/Reviewer; resolución e impacto documental; y runtime local con logs y verificación.

## v0.2 contract

La siguiente iteración está definida en [SPEC-v0.2.md](SPEC-v0.2.md): revisión y gates visibles, evidencia de runtime persistida, servicios locales declarados y navegación contextual de Tasks. Su orden de entrega es `runtime-evidence → task-detail-read-model → review-gates-ui → local-services → rehydration-smoke`. Cloud, worktrees, colaboración, multiagente complejo y commits autónomos continúan fuera de alcance.

## Deferred decisions

Estas decisiones no bloquean las releases cerradas y se mantienen para iteraciones posteriores: esquema SQLite definitivo; retrieval y embeddings; checkpoints; automatización de commits; evolución del esquema `.ade/`; enforcement completo de taxonomía documental; memoria/equipos; licensing y pricing; editor completo; `.dmg`; cloud y colaboración realtime.

## Change Log

Las entradas siguientes son históricas y describen el estado en el momento de cada corte; el encabezado y la última entrada son la referencia vigente para el estado de release.

- 2026-09-02 — initial — Se descompuso el informe fundacional en seis módulos base, se fijaron dependencias y build order; quedan abiertas las decisiones tecnológicas indicadas en Tech Foundations.
- 2026-09-02 — development-workflow — Se añadió el módulo de workflow adaptativo y se propagó a producto, MVP y governance: fases orientativas, invariantes obligatorios, modos según riesgo y bucles de re-discuss/re-build/re-review.
- 2026-09-02 — consolidation — Se consolidaron el brief de producto, el contrato MVP y las decisiones abiertas en el nexus; `docu/specs/` pasa a ser la única fuente de specs.
- 2026-09-02 — spike-001 — Se implementó la primera slice `Task → OpenCode adapter → SSE → diff`, con tests locales pasando; queda pendiente el smoke test contra OpenCode real.
- 2026-09-02 — spike-001-validation — Smoke test real completado con OpenCode 1.18.26 en repositorio efímero: health, sesión, prompt, 68 eventos, `session.idle` y captura Git validados; se corrigió la detección de archivos no trackeados.
- 2026-09-02 — spike-002 — Se implementó el contrato ReviewerPort, Review/Findings, orquestación independiente y persistencia SQLite; 8 tests pasan. La integración LLM real quedó validada en el smoke test posterior.
- 2026-09-02 — spike-002-validation — OpenCode 1.18.26 validó una sesión de Reviewer independiente con salida JSON estructurada y 0 findings sobre el smoke test; el parser usa `info.structured`.
- 2026-09-02 — review-flow — Se conectó el flujo completo Implementer → ChangeSet → Reviewer → Review/Findings → SQLite, con CLI `npm run review` y test end-to-end local.
- 2026-09-02 — review-flow-validation — `npm run review` validado con OpenCode real: dos sesiones, Review persistida, Task `READY_FOR_HUMAN` y findings con evidencia; se añadió migración SQLite para esquemas existentes.
- 2026-09-02 — project-task-workflow — Se concretó el contrato v0.1 con comandos ejecutables, estructura real, estrategia de tests y decisiones sobre estados/eventos; el módulo queda `ready` para plan y tareas.
- 2026-09-02 — project-repository-identity — Se fijó en la spec y ADR-0002 la identidad estable Project → Repository, la raíz Git canónica y el alcance v0.1 sin branches/worktrees automáticos.
- 2026-09-02 — development-workflow — Se concretaron la matriz de transiciones, contrato de gates, invocación de skills y modos adaptativos; ADR-0003 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — agent-runtime — Se concretaron `AgentRuntimePort`, aislamiento Implementer/Reviewer, OpenCode HTTP/SSE, salida estructurada y límites de v0.1; ADR-0004 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — knowledge-docs — Se concretaron metadata, taxonomía, resolución determinista, niveles de impacto y reconciliación; ADR-0005 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — local-runtime — Se concretaron lifecycle de procesos, contrato de servicios, health/log evidence y límites de seguridad; ADR-0006 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — changes-review-governance — Se concretaron semántica de gates, ChangeSets/checkpoints, findings, re-review y aprobación humana; ADR-0007 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — desktop-shell — Se concretaron Project Hub, áreas de navegación, estados de interacción, escape hatch y límites del shell; ADR-0008 registra la decisión y el módulo queda `ready`.
- 2026-09-02 — documentation-milestone — Todos los módulos del MVP quedan en `ready`; la siguiente fase es implementar el contrato Project/Repository y la vertical desktop mínima.
- 2026-09-02 — implementation-foundation — Project/Repository, persistencia y rehidratación, casos de uso, gates y CLI básica implementados; 19 tests pasan. Queda integrar el flujo review con los comandos y construir la vertical desktop.
- 2026-09-02 — mvp-cli — CLI unificada validada en repositorio efímero: registro de Project, creación/avance de Task y persistencia SQLite; 21 tests pasan. El siguiente hito es la vertical desktop.
- 2026-09-02 — spike-003 — Comparativa Tauri/Electron validada: Tauri 2 compila `.app`/`.dmg` y arranca en macOS; ADR-0009 registra la adopción para el shell MVP.
- 2026-09-02 — desktop-shell-bootstrap — Se creó el shell visual Tauri con navegación Project/Work/Knowledge/Changes/Runtime y estados representativos; se validó bundle `.app`/`.dmg`.
- 2026-09-02 — desktop-project-context — Se definió `ProjectSnapshot` y se añadió el comando Tauri de solo lectura `project_context`; la integración de Task/SQLite/Git completo queda para los siguientes puntos de la vertical.
- 2026-09-03 — desktop-read-model — Se añadieron consultas de colección al store y el read model `ProjectSnapshot`, con filtrado por Project y métricas de trabajo; la UI aún consume fixture hasta cerrar el transporte Tauri.
- 2026-09-03 — desktop-read-model-cli — La CLI expone `project snapshot` como seam verificable del read model persistido; queda pendiente elegir y probar el transporte del backend TypeScript junto a Tauri.
- 2026-09-03 — documentation-sync — Se cerró la tarea de sincronización documental del módulo Project/Task; las referencias y headings del contrato implementado quedan alineados.
- 2026-09-03 — desktop-transport — Se abrió el spike 004 para decidir el transporte Tauri–TypeScript; la recomendación provisional es sidecar JSON-RPC por stdio, pendiente de validación de lifecycle y empaquetado.
- 2026-09-03 — desktop-sidecar — Se implementó el primer corte del sidecar (`project.snapshot`) con protocolo JSON-RPC stdio y errores estructurados; el gate de respuesta está cubierto por tests, quedan lifecycle Tauri y packaging.
- 2026-09-03 — roadmap-granularity — Se separaron en tareas independientes el read model, el protocolo sidecar, su lifecycle Tauri y el empaquetado macOS.
- 2026-09-03 — desktop-supervisor — Tauri incorpora supervisor de sidecar con start/status/stop idempotente y pruebas unitarias; sigue pendiente el smoke test con proceso real y el cableado de streams.
- 2026-09-03 — desktop-sidecar-smoke — Smoke test real del sidecar por stdin/stdout sobre SQLite temporal completado; la integración del proceso bajo Tauri sigue pendiente.
- 2026-09-03 — desktop-tauri-transport — Tauri ya arranca/supervisa el sidecar y expone requests/respuestas JSON-RPC mediante comandos y eventos; queda pendiente validar el lifecycle dentro de la app y el bundle.
- 2026-09-03 — desktop-sidecar-path — Se hizo obligatorio `ADE_DB_PATH` en el sidecar y en el supervisor Tauri para evitar persistencia dependiente del `cwd`; el smoke siguiente debe usar una DB explícita.
- 2026-09-03 — desktop-project-hub-live — El Project Hub solicita y renderiza `ProjectSnapshot` real mediante el sidecar; smoke Tauri de desarrollo completado con Project y DB explícitos.
- 2026-09-03 — desktop-transport-state — La shell muestra estados `ready/failed` y errores del sidecar sin perder el último snapshot; queda automatizar recuperación y empaquetado.
- 2026-09-03 — desktop-transport-recovery — Ante salida del sidecar, Tauri emite evento, la shell conserva el snapshot y realiza un único reinicio; queda el smoke automatizado y el bundle.
- 2026-09-03 — desktop-transport-failure-tests — Se automatizaron procesos sidecar reales para respuesta por stdio y fallo sin `ADE_DB_PATH`; queda validar recuperación dentro de Tauri y empaquetado.
- 2026-09-03 — desktop-sidecar-resource — El bundle Tauri incluye `sidecar-dist` y Rust resuelve el recurso empaquetado; el packaging autónomo queda pendiente porque aún requiere Node instalado.
- 2026-09-03 — desktop-sidecar-standalone — Node SEA + `postject` generan un sidecar Mach-O arm64 autocontenido; el bundle `.app` lo incluye y el smoke JSON-RPC no requiere Node externo.
- 2026-09-03 — desktop-work-create — Work permite introducir una intención y crear una Task persistida mediante el sidecar; el Project Hub se refresca con el resultado real.
- 2026-09-03 — desktop-work-advance — El sidecar expone `task.advance` con validación de transición, razón y actor; la UI aún debe ofrecer controles visuales de reanudación.
- 2026-09-03 — desktop-work-controls — Work muestra controles para transiciones permitidas y refresca el Project Hub tras avanzar una Task; queda conectar ejecución y eventos de runtime.
- 2026-09-03 — desktop-runtime-status — El sidecar expone `runtime.status` y la shell distingue sidecar listo, agente desconectado, Task activa y última evidencia; queda conectar ejecución real y streaming de eventos.
- 2026-09-03 — desktop-runtime-execution — Work inicia `task.run` de forma asíncrona, el sidecar conecta el Implementer OpenCode y retransmite `runtime.event/completed/failed`; queda smoke end-to-end con OpenCode desde Tauri y observabilidad detallada de logs.
- 2026-09-03 — desktop-runtime-evidence — Runtime muestra hasta 12 eventos recientes de Implementer con hora, tipo y Task; las suites TypeScript/Rust pasan. El smoke OpenCode desde Tauri queda pendiente porque `opencode serve` devuelve `ServeError` en este entorno.
- 2026-09-03 — desktop-runtime-recovery — `task.run` rechaza estados no ejecutables y persiste `BLOCKED` ante fallo del Implementer; el smoke real sigue pendiente por el `ServeError` de OpenCode.
- 2026-09-03 — desktop-runtime-health — Runtime incorpora `runtime.health` con versión y errores estructurados; el diagnóstico automatizado pasa y el smoke real queda reproducible cuando OpenCode pueda arrancar.
- 2026-09-03 — desktop-supervisor-hardening — El supervisor Tauri reabsorbe salidas inesperadas y evita errores de parada si el sidecar ya terminó; seis pruebas Rust pasan. La recuperación visual dentro de una ventana Tauri sigue pendiente.
- 2026-09-03 — desktop-supervisor-recovery-ui — Runtime ofrece recuperación manual del sidecar, solicita snapshot y vuelve a comprobar health; queda validar el flujo en una ventana Tauri empaquetada.
- 2026-09-03 — desktop-packaging — `desktop:package:app` genera un `.app` arm64 con sidecar Node SEA y lo valida fuera del workspace con DB externa; `ADE_SEA_NODE` hace explícita la versión Node compatible. El `.dmg` queda pendiente por fallo de `bundle_dmg.sh` del entorno.
- 2026-09-03 — desktop-vertical-context — Project Hub ofrece escape hatch a Terminal y Changes consume la Task real del snapshot, con estado vacío explícito; la vertical desktop mínima queda pendiente de validar como flujo completo empaquetado.
- 2026-09-03 — desktop-knowledge-action — Knowledge abre specs canónicas desde Tauri con una frontera segura `docu/specs`; las cinco áreas visibles ya tienen navegación y acciones locales, pendiente el recorrido completo empaquetado.
- 2026-09-03 — desktop-vertical-contract — Se añadió una prueba de contrato para proteger las cinco áreas MVP y sus acciones críticas; 35 tests TypeScript pasan. La validación funcional completa empaquetada sigue pendiente.
- 2026-09-03 — desktop-mvp-smoke — El smoke empaquetado valida sidecar incluido, arranque y parada limpia del `.app` desde un cwd externo con DB temporal; lifecycle Tauri y vertical desktop mínima quedan cerrados para el MVP local.
- 2026-09-03 — v0.2-specification — Tras cerrar v0.1 se crea `SPEC-v0.2.md` con cuatro capacidades post-MVP, contratos públicos, criterios de éxito y orden `runtime-evidence → task-detail-read-model → review-gates-ui → local-services → rehydration-smoke`; la implementación queda bloqueada hasta revisar este alcance.
- 2026-09-03 — v0.2-runtime-evidence — Se persiste evidencia Runtime acotada por Task/sesión y se exponen `task.detail`/`runtime.history`; Work rehidrata historial, ChangeSets, Reviews y número de eventos. El siguiente corte es Review/gates.
- 2026-09-03 — v0.2-review-gates — Changes consume `change.review`, muestra gates/evidencia/finding(s) y distingue gates pendientes; la mutación auditada de aprobación/re-review sigue pendiente.
- 2026-09-03 — v0.2-human-approval — `task.approve` queda conectado al sidecar y Changes, persiste actor/razón/fecha y bloquea gates incompletas; re-review y persistencia de gates siguen pendientes.
- 2026-09-03 — v0.2-local-services — `ServiceManager` inicia/detiene procesos declarados y valida healthchecks sin servidores externos; quedan smoke de rehidratación y exposición de servicios en Runtime.
- 2026-09-03 — v0.2-rehydration — El test de reinicio de store conserva Task, runtime evidence, ChangeSet y Review; 39 tests TypeScript pasan. La rehidratación de gates y el smoke final de v0.2 siguen pendientes.
- 2026-09-03 — v0.2-close-audit — Gates y re-review quedan persistidos y accionables; Runtime ofrece start/stop de un servicio local y el test de rehidratación conserva también los gates. La suite queda en 39 tests. El cierre de release sigue condicionado al smoke empaquetado en macOS y a validar OpenCode real desde la app.
- 2026-09-03 — v0.2-scope-audit — Se separan como pendientes de cierre la declaración persistida de servicios, los límites/policy configurables y la validación gráfica del bundle; no se presentan como capacidades completas antes de v0.3.
- 2026-09-03 — v0.3-foundation — Se implementan los primeros seams de Workspace Core (árbol local), Agent Providers (detección OpenCode/Codex), Native Skills (catálogo y manifests), Git Collaboration (read model de status) y Living Knowledge (impacto de referencias). 22 tests TypeScript y 9 tests Rust pasan; terminal PTY, GitHub mutations y ejecución real de skills siguen pendientes.
- 2026-09-03 — v0.3-workspace-terminal — Workspace Core añade árbol recursivo, apertura de archivos y terminal nativa con cwd/exit code/salida visibles; 10 tests Rust pasan. La ejecución de skills se conecta al runtime y el catálogo conserva ocho skills nativas; siguen pendientes las mutaciones Git/GitHub, UI completa de providers/skills y reconciliación automática.
- 2026-09-03 — v0.3-batch-foundations — Se incorporan policy por Project para gates/evidencia, límites y retención por Task, trazabilidad persistida de operaciones Git hacia Tasks y grafo documental recursivo con impacto transitivo. La reconciliación sigue siendo propuesta revisable; PR visual y smoke real del `.app` permanecen abiertos.
- 2026-09-03 — v0.3-knowledge-uml — El grafo añade UML Mermaid derivado y diagnóstico explícito de referencias rotas; 53 tests TypeScript pasan. Quedan abiertos la aplicación automática de reconciliación y la validación gráfica de release.
- 2026-09-03 — v0.3-project-skills — El catálogo incorpora carga validada de skills personalizadas desde `.ade/skills/*.json`; 54 tests TypeScript pasan. La ejecución aislada y actualización de skills siguen abiertas.
- 2026-09-03 — v0.3-codex-runner — Se añade runner CLI de Codex bajo el contrato común de runtime y se habilita la selección OpenCode/Codex en skills; siguen abiertas sesiones persistentes, streaming y smoke real.
- 2026-09-03 — v0.3-project-skill-execution — Las skills de proyecto se resuelven y ejecutan mediante el mismo contrato de runtime que las nativas; Git notifica el resultado de PR y mantiene la relación con Task. Quedan sandbox de permisos y presentación completa de ChangeSet/gates.
- 2026-09-03 — v0.3-session-persistence — Se persisten sesiones de agentes por Task y se permite reanudar skills mediante `sessionId`; 56 tests TypeScript pasan. El streaming persistente y la reanudación completa de Tasks siguen abiertos.
- 2026-09-03 — v0.3-release-and-reconciliation — El bundle macOS usa un launcher de sidecar cuando SEA no está disponible; smoke real valida app, sidecar, OpenCode 1.18.26 y una Task en repositorio efímero. La reconciliación automática genera informes de impacto, QA y estimación en Markdown. ADR-0011 registra ambas decisiones.
- 2026-09-03 — v0.3-stream-install-workflow — Las skills transmiten eventos de runtime, se instalan desde JSON local o Git, y Git admite policy `pull-request` o `direct` con push confirmado. 59 tests TypeScript pasan; el sandbox de permisos y la presentación de ChangeSets/gates siguen abiertos.
- 2026-09-03 — v0.3-resumable-permissions-gate — Codex captura y reanuda su `thread_id` real, las sesiones aparecen por Task y los manifests exigen consentimiento por ejecución para código, comandos y red. La reconciliación produce evidencia de `documentation-review`; ADR-0012 fija el contrato. 66 tests TypeScript y 10 Rust pasan; smoke real de `codex exec resume` validado.
- 2026-09-03 — v0.3-task-scoped-git-and-install — La Task seleccionada pasa a ser estado de la shell y deja de leerse del DOM, de modo que skills, reconciliación y operaciones Git se atribuyen a la misma Task visible. `commit.create` devuelve su SHA, `push` resuelve la rama actual y rechaza `HEAD` desacoplado, `github.status` es accionable desde el workspace y la instalación de skills desde red exige confirmación explícita. 70 tests TypeScript pasan. Siguen abiertos la presentación de ChangeSet/gates en el flujo Git y la UI de conversación persistente por proveedor.
- 2026-09-03 — v0.3-task-evidence-surfaces — Changes presenta ChangeSet, gates y findings de la Task seleccionada; Git conserva su panel de operaciones y Work muestra actividad persistida por sesión. Los eventos de skills se guardan como evidencia acotada por Task, sin transcribir prompts ni tokens. 71 tests TypeScript pasan.
- 2026-09-03 — v0.3-workspace-root-authorization — Workspace Core registra la raíz canónica del Project y bloquea rutas externas y symlinks que escapan en filesystem, terminal y aperturas. El árbol pasa a expansión perezosa; ADR-0013 documenta la frontera. 12 tests Rust pasan.
- 2026-09-03 — v0.3-provider-selection — La detección de Codex usa el mismo comando que ejecuta el adapter y el workbench muestra disponibilidad, capacidades y auth sin credenciales; proveedores no disponibles no se pueden seleccionar para ejecutar skills. 72 tests TypeScript pasan.
- 2026-09-03 — v0.3-project-skill-update — Las skills de Project conservan `installedFrom` e instante de instalación, se actualizan desde un origen trazable sin cambiar de id y exigen consentimiento si el origen es Git. La UI distingue native/Project, permite Update y muestra los errores del sidecar. 74 tests TypeScript pasan.
- 2026-09-03 — v0.3-git-worktree-flow — Git muestra rama activa y cambios, y la Task seleccionada puede iniciar branch, worktree, commit, push y PR confirmados. Worktree exige ruta y rama específicas; 75 tests TypeScript pasan.
- 2026-09-03 — v0.3-native-pty — Terminal Core sustituye los pipes por `portable-pty`, conserva la sesión interactiva y valida un comando real en PTY. La raíz autorizada del Project sigue aplicando; 13 tests Rust y 75 TypeScript pasan.
- 2026-09-03 — v0.3-packaged-pty-smoke — Se reempaquetó el `.app` con el PTY nativo y el smoke real pasó: sidecar `READY`, Task efímera, OpenCode 1.18.26 y arranque/parada limpia. El servidor temporal se detuvo tras validar.
- 2026-09-03 — v0.3-changed-doc-reconciliation — La reconciliación detecta por Git todas las specs/ADRs Markdown modificadas y las aplica secuencialmente, preservando las trazas Nexus y asociando evidencia a la Task. 76 tests TypeScript pasan.
- 2026-09-03 — v0.2-project-services-ui — Runtime lista los servicios declarados por Project y permite start/stop individual con estado refrescado, completando la superficie operativa de `.ade/services.json`. 76 tests TypeScript pasan.
- 2026-09-03 — v0.3-close — Smoke empaquetado macOS validado con sidecar incluido, OpenCode 1.18.26 real, Task en repositorio efímero, evidencia y gates rehidratados tras reinicio del sidecar, y `.app` arrancando/parando limpiamente. Suites: 76 tests TypeScript, 13 tests Rust; v0.3 cerrada.
- 2026-09-04 — workspace-core + desktop-shell — Se sincroniza la UX del Explorer: la navegación lateral queda etiquetada y única; el árbol conserva en modo compacto la rama del archivo activo y ofrece un modo expandido que repliega la navegación para explorar el árbol completo. Se propaga a SPEC-v0.3 y al cierre de release; 78 tests TypeScript pasan.
- 2026-09-04 — workspace-core + desktop-shell — Se documenta la baseline actual de la shell: tema claro/oscuro persistente, Explorer animado y dock PTY redimensionable con transcript único, prompt mínimo, historial y completado de rutas `cd` mediante `Tab`; 81 tests TypeScript y 13 tests Rust pasan.
- 2026-09-04 — file-workspace — Se especifica la siguiente capacidad de v0.4: selección de fichero con visor interno de solo lectura, lectura segura bajo la raíz del Project y escape hatch externo explícito; la implementación queda planificada.
- 2026-09-04 — file-workspace — La selección del Explorer abre ficheros de texto en el editor interno de ADE; Tauri clasifica texto/binario/tamaño bajo la raíz autorizada y permite guardar sólo texto UTF-8 de hasta 2 MiB dentro del Project. `Save`, `Discard` y `⌘/Ctrl+S` quedan cableados; 82 tests TypeScript y 17 tests Rust pasan.

## Automatic Reconciliation Log

<!-- reconciliation:docu/specs/SPEC-NEXUS.md -->
- 2026-09-03 — automatic-reconciliation — docu/specs/SPEC-NEXUS.md; 8 dependent document(s), 0 broken reference(s). Artifacts: ../generated/reconciliation/spec-nexus.md, ../generated/qa/spec-nexus.md, ../generated/estimates/spec-nexus.md.
<!-- reconciliation:docu/specs/SPEC-desktop-shell.md -->
- 2026-09-04 — automatic-reconciliation — docu/specs/SPEC-desktop-shell.md; 8 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/spec-desktop-shell.md, ../generated/qa/spec-desktop-shell.md, ../generated/estimates/spec-desktop-shell.md.
<!-- reconciliation:docu/specs/SPEC-v0.3.md -->
- 2026-09-04 — automatic-reconciliation — docu/specs/SPEC-v0.3.md; 11 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/spec-v0.3.md, ../generated/qa/spec-v0.3.md, ../generated/estimates/spec-v0.3.md.
<!-- reconciliation:docu/specs/SPEC-workspace-core.md -->
- 2026-09-04 — automatic-reconciliation — docu/specs/SPEC-workspace-core.md; 11 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/spec-workspace-core.md, ../generated/qa/spec-workspace-core.md, ../generated/estimates/spec-workspace-core.md.
<!-- reconciliation:docu/specs/SPEC-local-runtime.md -->
- 2026-09-04 — automatic-reconciliation — docu/specs/SPEC-local-runtime.md; 8 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/spec-local-runtime.md, ../generated/qa/spec-local-runtime.md, ../generated/estimates/spec-local-runtime.md.
<!-- reconciliation:docu/adr/0009-tauri-desktop-shell.md -->
- 2026-09-04 — automatic-reconciliation — docu/adr/0009-tauri-desktop-shell.md; 8 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/0009-tauri-desktop-shell.md, ../generated/qa/0009-tauri-desktop-shell.md, ../generated/estimates/0009-tauri-desktop-shell.md.
<!-- reconciliation:docu/adr/0014-internal-file-viewer.md -->
- 2026-09-04 — automatic-reconciliation — docu/adr/0014-internal-file-viewer.md; 2 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/0014-internal-file-viewer.md, ../generated/qa/0014-internal-file-viewer.md, ../generated/estimates/0014-internal-file-viewer.md.
<!-- reconciliation:docu/specs/SPEC-file-workspace.md -->
- 2026-09-04 — automatic-reconciliation — docu/specs/SPEC-file-workspace.md; 13 dependent document(s), 1 broken reference(s). Artifacts: ../generated/reconciliation/spec-file-workspace.md, ../generated/qa/spec-file-workspace.md, ../generated/estimates/spec-file-workspace.md.
