# Nexus: ADE — Agentic Development Environment

**Estado:** draft  
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
- No se elige aún Tauri/Electron, esquema definitivo, retrieval semántico ni formato final de `.ade/`.

## Modules

| Module id | Spec file | Responsibility | Depends on | Status | Blocked by |
|---|---|---|---|---|---|
| project-task-workflow | [SPEC-project-task-workflow.md](SPEC-project-task-workflow.md) | Projects, Tasks, conversaciones y estados | — | ready | — |
| development-workflow | [SPEC-development-workflow.md](SPEC-development-workflow.md) | Transiciones adaptativas, skills de workflow y modos de ejecución | project-task-workflow | ready | — |
| agent-runtime | [SPEC-agent-runtime.md](SPEC-agent-runtime.md) | Sesiones, implementer, reviewer y adapter | project-task-workflow | ready | — |
| knowledge-docs | [SPEC-knowledge-docs.md](SPEC-knowledge-docs.md) | Documentación, skills, contexto y drift | project-task-workflow | ready | — |
| changes-review-governance | [SPEC-changes-review-governance.md](SPEC-changes-review-governance.md) | ChangeSets, Git, gates, findings y aprobación | agent-runtime, knowledge-docs | draft | agent-runtime; knowledge-docs |
| local-runtime | [SPEC-local-runtime.md](SPEC-local-runtime.md) | Servicios, procesos, terminal, logs y tests | project-task-workflow | draft | project-task-workflow |
| desktop-shell | [SPEC-desktop-shell.md](SPEC-desktop-shell.md) | Project Hub, navegación, visor y escape hatch | project-task-workflow, changes-review-governance, local-runtime | draft | upstream modules |

**Build order:** `project-task-workflow → development-workflow → agent-runtime + knowledge-docs + local-runtime → changes-review-governance → desktop-shell`.

Las ramas paralelas sólo pueden comenzar cuando `project-task-workflow` haya definido el contrato de Task y sus eventos mínimos. `development-workflow` define las transiciones que coordinan las ramas, pero no convierte cada fase en una obligación.

## Scope boundary

Este nexus cubre el MVP y sus spikes. Quedan fuera del build order inicial: AgentMemory, ASK como dependencia, multiagente complejo, worktrees paralelos, browser automation, cloud, sync, realtime collaboration y productización.

## MVP contract

El modo `standard` cubre: abrir repositorio, crear Task, resolver contexto, ejecutar Implementer, capturar ChangeSet, build/tests, resumen, Reviewer independiente, findings, re-review, reconciliación documental, aprobación humana y commit. El modo `quick` sirve para cambios pequeños; `recovery` permite reentrar tras nueva evidencia o un fallo. Ningún modo puede omitir los invariantes definidos en [SPEC-development-workflow.md#gates-and-invariants](SPEC-development-workflow.md#gates-and-invariants).

Los cuatro spikes previos a UI significativa son: integración OpenCode y eventos; Implementer/Reviewer; resolución e impacto documental; y runtime local con logs y verificación.

## Open decisions

Siguen deliberadamente abiertas hasta obtener evidencia: Tauri frente a Electron; integración concreta con OpenCode; esquema SQLite; retrieval y embeddings; relación Task/branch; checkpoints; automatización de commits; esquema `.ade/`; enforcement de taxonomía documental; memoria/equipos; licensing y pricing.

## Change Log

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
