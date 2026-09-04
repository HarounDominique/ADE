# Plan: ADE v0.3 — Workspace agéntico local-first

<!-- Spec: docu/specs/SPEC-v0.3.md | Nexus: SPEC-NEXUS.md -->

**Estado:** completado y validado en macOS. El orden siguiente conserva la hoja de ruta ejecutada.

## Objective

Reducir el cambio de contexto diario integrando workspace local, terminal, agentes con licencia, skills, Git/GitHub y documentación viva.

## Implementation order

1. Workspace Core: árbol, visor/apertura y terminal nativa con rutas validadas. ✅
2. Agent Providers: registro, detección, selección, permisos y diagnóstico. ✅
3. Native Skills: catálogo, manifest, permisos, instalación y trazabilidad. ✅
4. Git Collaboration: branch, diff, worktree, commit y PR enlazados a Task. ✅
5. Living Knowledge: grafo de referencias, impacto, UML y reconciliación Spector. ✅
6. Desktop integration: navegación contextual, estados, errores y smoke empaquetado. ✅

## Checkpoints

- Workspace: tests Rust/TypeScript y terminal manual en macOS. ✅
- Providers: contract tests con fakes y diagnóstico sin credenciales reales. ✅
- Skills: catálogo validado y skill fixture ejecutable con permisos. ✅
- Git: fixture con branch/worktree y bloqueo de commit sin aprobación. ✅
- Knowledge: referencias rotas, impacto y sincronización Nexus cubiertos. ✅
- Release: `.app`, sidecar, OpenCode real, rehidratación y parada limpia. ✅

## Risks and delivery rule

Permisos locales, acoplamiento a proveedores, skills inseguras y deriva documental se mitigan con validación nativa, adapters, manifests y sync protocol. Scope creep queda fuera: no editor completo ni cloud. La siguiente iteración debe abrir una spec nueva; cualquier cambio de contrato exige sincronizar Nexus, citers y artefactos generados.
