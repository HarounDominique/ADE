# ADE — Agentic Development Environment

ADE es una workstation local-first para ingeniería de software agéntica: el humano define intención y restricciones, los agentes implementan, y el sistema hace visibles los cambios, la ejecución, la verificación y la revisión.

Este repositorio comienza deliberadamente por la documentación. La documentación es la fuente de intención y arquitectura; Git conserva el estado e historial del código; ADE conserva la metadata operativa del workflow.

## Documentación

- [Nexus de specs](docu/specs/SPEC-NEXUS.md)
- [Specs de módulos](docu/specs/)
- [Índice de documentación](docu/README.md)
- [ADRs](docu/adr/)

## Estado

MVP CLI operable: las specs del MVP están en estado `ready`, con ADRs y plan de tareas versionados. ADE puede registrar Projects, crear y avanzar Tasks, ejecutar el flujo Implementer/Reviewer con OpenCode, persistir ChangeSets/Reviews en SQLite y aplicar gates de aprobación. La vertical desktop queda como siguiente hito de producto.

## Quick start del spike

```bash
npm install
npm run build
npm test
```

Con OpenCode instalado y sirviendo en `127.0.0.1:4096`:

```bash
npm run dev -- /ruta/al/repositorio "Inspect the repository and report its current state without editing files."
```

Ver [Spike 001](docu/spikes/001-opencode-runtime.md) y [Spike 002](docu/spikes/002-independent-review.md) para contratos, resultados y limitaciones conocidas.

El flujo integrado se ejecuta con `npm run review -- /ruta/al/repositorio "Describe the task"` cuando OpenCode está sirviendo localmente.

La CLI permite registrar Projects y operar Tasks sin UI:

```bash
npm run ade -- project register ade ADE /ruta/al/repositorio
npm run ade -- task create task-1 "Describe la tarea" ade /ruta/al/repositorio
npm run ade -- task advance task-1 READY "Acceptance criteria recorded"
npm run ade -- review /ruta/al/repositorio "Describe la tarea"
```
