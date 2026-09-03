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
3. El smoke empaquetado pasa en macOS con OpenCode real o informa un diagnóstico reproducible y accionable.
4. Las specs y el Nexus reflejan el contrato implementado, sin marcar como completadas capacidades no verificadas.

## Open Questions

## Implemented contract slices

- Project policy is optionally read from `.ade/policy.json` with `requiredGates` and evidence limits (`maxItems`, `summaryLimit`, `detailsLimit`). Invalid or missing policy falls back to safe defaults.
- Runtime evidence is bounded at ingestion and old evidence can be pruned per Task. Git mutations can carry `taskId` and are persisted as auditable Task operations.
- The living-knowledge graph scans nested Markdown and computes transitive citing impact; reconciliation remains a reviewable proposal and does not mutate documentation automatically.
- Native skills are loaded from the built-in catalog plus optional project manifests in `.ade/skills/*.json`; project manifests are validated and marked as `source: project`.

- ¿Qué proveedores se incluyen de forma nativa en el primer paquete?
- ¿La terminal usa PTY propio o una librería Tauri estable?
- ¿GitHub se integra mediante CLI local, API oficial o ambos?
- ¿Mermaid es suficiente para UML inicial?
