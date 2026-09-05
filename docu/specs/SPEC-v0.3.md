# Spec: ADE v0.3 — Workspace agéntico local-first

<!-- Nexus: SPEC-NEXUS.md | Follows: SPEC-v0.2.md -->

**Estado de release:** CERRADA — validada en macOS el 2026-09-03.

## Objective

Convertir ADE en el workspace agéntico local-first que concentra contexto, terminal, proveedores, skills, Git y documentación viva, cerrando además la release reproducible de v0.2.

## Scope

- Workspace local: [workspace-core](SPEC-workspace-core.md) define árbol, terminal y contexto.
- Proveedores: [agent-providers](SPEC-agent-providers.md) conecta Codex, Claude Code, OpenCode y otros adapters con licencias del usuario.
- Skills: [native-skills](SPEC-native-skills.md) distribuye el catálogo nativo y skills personalizadas.
- Código remoto: [git-collaboration](SPEC-git-collaboration.md) une Git/GitHub con Tasks y gates.
- Conocimiento vivo: [living-knowledge](SPEC-living-knowledge.md) mantiene referencias, diagramas y reconciliación.

La integración visual se realiza en `desktop-shell` después de validar `workspace-core`; el nexus fija dependencias y orden.

## Product workflow

```text
abrir Project → navegar contexto → abrir terminal/agente → ejecutar skill
    → cambiar código/docs → revisar Git y gates → reconciliar conocimiento → aprobar
```

El usuario conserva autoridad sobre permisos, proveedor, cambios Git y decisiones de riesgo. Las fases del workflow siguen siendo adaptativas según [development-workflow](SPEC-development-workflow.md#adaptive-modes), no una secuencia rígida.

## Scope details

- Declaración versionada de servicios locales, sin secretos, con comando, cwd, healthcheck, puertos y política de parada.
- Retención y truncamiento configurables para evidencia Runtime.
- Policy mínima de gates por Project, incluyendo documentación y waivers auditables.
- Smoke de `.app` con sidecar, Task, OpenCode real, rehidratación y parada limpia.
- Diagnóstico claro cuando el entorno no puede iniciar WebKit/Tauri u OpenCode.

## Out of scope

Cloud, colaboración realtime, worktrees remotos, editor completo, commits autónomos y restauración automática de checkpoints. Los worktrees locales sólo entran como aislamiento de Tasks.

## Exit criteria

1. ✅ Un Project nuevo carga su configuración sin depender de comandos hardcodeados en la UI.
2. ✅ Una Task conserva evidencia acotada y gates después de reiniciar el sidecar que sirve la aplicación.
3. ✅ El smoke empaquetado pasa en macOS con OpenCode 1.18.26 real, sidecar incluido y una Task real en un repositorio efímero.
4. ✅ Las specs, tareas y el Nexus reflejan el contrato implementado y sus límites explícitos.

La matriz reproducible de evidencias está en [v0.3-close.md](../releases/v0.3-close.md).

## Open Questions

No quedan preguntas que bloqueen la release 0.3. Las decisiones de producto no necesarias para este corte —editor completo, `.dmg`, cloud, colaboración realtime, retrieval semántico, checkpoints y sandbox OS-level— quedan diferidas a iteraciones posteriores y no se presentan como capacidades de esta versión.

## Implemented contract slices

- Project policy is optionally read from `.ade/policy.json` with `requiredGates` and evidence limits (`maxItems`, `summaryLimit`, `detailsLimit`). The safe default includes `documentation-review`; invalid or missing policy falls back to it.
- Runtime evidence is bounded at ingestion and old evidence can be pruned per Task. Git mutations can carry `taskId` and are persisted as auditable Task operations.
- The living-knowledge graph scans nested Markdown and computes transitive citing impact; reconciliation writes versioned QA/estimate/UML artifacts and an idempotent Nexus trace. Its resulting evidence satisfies `documentation-review` for the linked Task.
- Native skills are loaded from the built-in catalog plus optional project manifests in `.ade/skills/*.json`; project manifests are validated and marked as `source: project`.
- Skills can select the OpenCode HTTP runtime, Codex CLI runtime or Claude Code CLI runtime without persisting credentials; all runners preserve the common `AgentRuntimePort` contract.
- Agent sessions are persisted by Task (`runtime.sessions`) with provider, directory and status; a saved `sessionId` is selectable from Task detail to resume a skill run. `Agents` offers a provider-scoped model selector, forwards non-default aliases to the selected runtime and resets the list when switching conversations.
- Native and Project skills declare least-privilege manifests. `read_project` and `write_docs` are Project-scoped; `write_code`, `run_commands` and `network` need an explicit per-run grant in the workbench.
- The selected Task is shell state shared by Work, Changes, Git and the workbench, so skills, reconciliation and Git operations attribute their evidence to the same Task the user is looking at.
- Git operations return an auditable reference: `commit.create` reports its SHA and `push` resolves the current branch, refusing a detached `HEAD`. `github.status` reports GitHub CLI availability without storing credentials.
- Project skills are installable from the workbench. A network source is identified before cloning and rejected with `SKILL_INSTALL_CONFIRMATION_REQUIRED` unless the run is explicitly confirmed.
- Changes renders the selected Task's ChangeSet, gates and findings; Work renders its persisted runtime activity, agent sessions and Git trace. Skill runtime events are bounded evidence rather than stored provider transcripts.
- Workspace Core canonizes the selected Project in Tauri and rejects filesystem, terminal and external-open paths outside it, including symlinks that escape it. The file tree loads direct children and expands directories on demand. Its compact mode keeps the active file's ancestor branch visible; its expanded mode hides duplicate view navigation and exposes the full lazy tree. ADR-0013 records the authorization boundary.
- Provider inspection uses the same Codex and Claude Code commands as their runtimes, while the workbench renders availability, transport, auth mode and capabilities. Unavailable providers are disabled before a skill can run; no credential is copied into ADE.
- Installed Project skills persist their canonical local or Git source and install time. The workbench can update a selected traceable Project skill, retaining its id and requiring explicit consent before a remote update; sidecar errors are rendered as user feedback.
- The `Version control` view is the only surface that renders `Git workspace`: it reports the active branch and changed files as well as branches, worktrees and remotes. The Task-scoped UI exposes confirmed branch/worktree/commit/push/PR operations, with explicit worktree path and branch inputs; the topbar keeps only global Project and branch selectors.
- Workspace terminal uses a persistent native PTY (`portable-pty`) rather than split shell pipes. It is tested with an interactive command and remains constrained to the canonical Project root.
- The packaged macOS smoke was repeated after the PTY integration: included sidecar `READY`, a real OpenCode 1.18.26 Task in an ephemeral repository, persisted evidence and gates, sidecar restart with successful Task rehydration, and clean `.app` startup/shutdown all passed. The temporary OpenCode server is stopped after the smoke.
- Living documentation now reconciles all changed specs and ADRs reported by Git in one sequential run, generating their reports and recording bounded Task evidence. The workbench action targets the changed-document set rather than a hardcoded Nexus file.
- Runtime reads the Project-local service manifest and renders every declared service with command, cwd, healthcheck, status and individual start/stop actions instead of controlling an implicit first service.

## Post-release maintenance

Tras cerrar v0.3, la shell recibió refinamientos de interacción que forman parte del comportamiento actual de la aplicación: selector persistente claro/oscuro en la esquina superior derecha, barra superior de contexto Git con cambio de Project y branch local, identidad activa mantenida en un único estado frente a refreshes asíncronos, transición fluida y respeto de `prefers-reduced-motion` al cambiar el Explorer, hover legible en ambos temas y dock de terminal inferior redimensionable.

La terminal actual presenta tabs de sesiones `portable-pty` independientes con prompt mínimo, sin bienvenida ni eco duplicados. Cada tab conserva su proceso y superficie `xterm.js`; `Terminal.onData` reenvía directamente al PTY todas las secuencias de teclado y `Terminal.onResize` sincroniza sus filas y columnas. El shell real conserva historial y completado, y xterm.js interpreta ANSI, cursor, borrado, color y pantalla alternativa; por ello Claude y otras TUIs reciben flechas, espacio, Enter, Escape, Tab, borrado, caracteres imprimibles y controles `Ctrl` sin heurísticas ni modo especial de ADE. La slice posterior v0.4 abre ficheros de texto dentro de ADE, permite edición, guardado y descarte, mantiene la apertura externa como acción explícita y presenta un Editor fijo y exclusivo para código, sin paneles auxiliares ni CTA de búsqueda duplicada; su contrato está en [SPEC-file-workspace](SPEC-file-workspace.md). Los refinamientos recientes del Explorer añaden búsqueda file-first con rutas contextuales, índice reutilizable, debounce y spinner transitorio. Estas mejoras no reabren la release ni amplían su alcance: editor completo, language server, autocompletado general de comandos, `.dmg`, cloud y colaboración realtime siguen fuera.

## Resolved decisions

- Los proveedores nativos iniciales son Codex CLI, Claude Code CLI y OpenCode HTTP, con sesiones persistentes por Task y sin copiar credenciales a ADE.
- La terminal usa un PTY persistente basado en `portable-pty`, confinado a la raíz canónica del Project.
- GitHub se integra mediante la CLI local `gh`, manteniendo las credenciales fuera de la metadata de ADE.
- Mermaid es suficiente para el UML inicial y sus artefactos quedan bajo `docu/generated/` junto con QA y estimaciones.
