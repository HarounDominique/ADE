# Spec: ADE v0.3 — Configuración y release reproducible

<!-- Nexus: SPEC-NEXUS.md | Follows: SPEC-v0.2.md -->

## Objective

Convertir el corte operativo de v0.2 en una release reproducible: configuración de servicios por Project, policies de gates explícitas y smoke empaquetado ejecutable en un entorno macOS gráfico.

## Scope

- Declaración versionada de servicios locales, sin secretos, con comando, cwd, healthcheck, puertos y política de parada.
- Retención y truncamiento configurables para evidencia Runtime.
- Policy mínima de gates por Project, incluyendo documentación y waivers auditables.
- Smoke de `.app` con sidecar, Task, OpenCode real, rehidratación y parada limpia.
- Diagnóstico claro cuando el entorno no puede iniciar WebKit/Tauri u OpenCode.

## Out of scope

Cloud, colaboración, worktrees paralelos, editor completo, commits autónomos y restauración automática de checkpoints.

## Exit criteria

1. Un Project nuevo puede cargar su configuración sin depender de comandos hardcodeados en la UI.
2. Una Task conserva evidencia acotada y gates después de cerrar y reabrir la aplicación.
3. El smoke empaquetado pasa en macOS con OpenCode real o informa un diagnóstico reproducible y accionable.
4. Las specs y el Nexus reflejan el contrato implementado, sin marcar como completadas capacidades no verificadas.
