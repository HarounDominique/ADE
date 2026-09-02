# ADE — Agentic Development Environment

ADE es una workstation local-first para ingeniería de software agéntica: el humano define intención y restricciones, los agentes implementan, y el sistema hace visibles los cambios, la ejecución, la verificación y la revisión.

Este repositorio comienza deliberadamente por la documentación. La documentación es la fuente de intención y arquitectura; Git conserva el estado e historial del código; ADE conserva la metadata operativa del workflow.

## Documentación

- [Nexus de specs](docu/specs/SPEC-NEXUS.md)
- [Specs de módulos](docu/specs/)
- [Índice de documentación](docu/README.md)
- [ADRs](docu/adr/)

## Estado

Fase 0 — Architecture Spike. La primera slice del adapter, dominio, ChangeSet y persistencia ya está implementada y validada contra un servidor OpenCode real en un repositorio efímero.

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
