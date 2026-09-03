# Spec: ADE v0.3 — Workspace agéntico local-first

<!-- Nexus: SPEC-NEXUS.md | Follows: SPEC-v0.2.md -->

## Objective

Convertir ADE en el workspace agéntico local-first que concentra contexto, terminal, proveedores, skills, Git y documentación viva, cerrando además la release reproducible de v0.2.

## Scope

- Workspace local: [workspace-core](SPEC-workspace-core.md) define árbol, terminal y contexto.
- Proveedores: [agent-providers](SPEC-agent-providers.md) conecta Codex/OpenCode y otros adapters con licencias del usuario.
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

1. Un Project nuevo puede cargar su configuración sin depender de comandos hardcodeados en la UI.
2. Una Task conserva evidencia acotada y gates después de cerrar y reabrir la aplicación.
3. El smoke empaquetado pasa en macOS con OpenCode real, sidecar incluido y una Task real en un repositorio efímero.
4. Las specs y el Nexus reflejan el contrato implementado, sin marcar como completadas capacidades no verificadas.

## Open Questions

## Implemented contract slices

- Project policy is optionally read from `.ade/policy.json` with `requiredGates` and evidence limits (`maxItems`, `summaryLimit`, `detailsLimit`). The safe default includes `documentation-review`; invalid or missing policy falls back to it.
- Runtime evidence is bounded at ingestion and old evidence can be pruned per Task. Git mutations can carry `taskId` and are persisted as auditable Task operations.
- The living-knowledge graph scans nested Markdown and computes transitive citing impact; reconciliation writes versioned QA/estimate/UML artifacts and an idempotent Nexus trace. Its resulting evidence satisfies `documentation-review` for the linked Task.
- Native skills are loaded from the built-in catalog plus optional project manifests in `.ade/skills/*.json`; project manifests are validated and marked as `source: project`.
- Skills can select the OpenCode HTTP runtime or the Codex CLI runtime without persisting credentials; both runners preserve the common `AgentRuntimePort` contract.
- Agent sessions are persisted by Task (`runtime.sessions`) with provider, directory and status; a saved `sessionId` is selectable from Task detail to resume a skill run.
- Native and Project skills declare least-privilege manifests. `read_project` and `write_docs` are Project-scoped; `write_code`, `run_commands` and `network` need an explicit per-run grant in the workbench.
- The selected Task is shell state shared by Work, Changes, Git and the workbench, so skills, reconciliation and Git operations attribute their evidence to the same Task the user is looking at.
- Git operations return an auditable reference: `commit.create` reports its SHA and `push` resolves the current branch, refusing a detached `HEAD`. `github.status` reports GitHub CLI availability without storing credentials.
- Project skills are installable from the workbench. A network source is identified before cloning and rejected with `SKILL_INSTALL_CONFIRMATION_REQUIRED` unless the run is explicitly confirmed.
- Changes renders the selected Task's ChangeSet, gates and findings; Work renders its persisted runtime activity, agent sessions and Git trace. Skill runtime events are bounded evidence rather than stored provider transcripts.
- Workspace Core canonizes the selected Project in Tauri and rejects filesystem, terminal and external-open paths outside it, including symlinks that escape it. The file tree loads direct children and expands directories on demand; ADR-0013 records the authorization boundary.

- ¿Qué proveedores se incluyen de forma nativa en el primer paquete?
- ¿La terminal usa PTY propio o una librería Tauri estable?
- ¿GitHub se integra mediante CLI local, API oficial o ambos?
- ¿Mermaid es suficiente para UML inicial?
