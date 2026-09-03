# ADR-0011: Sidecar portable y reconciliación automática

## Status

Accepted

## Date

2026-09-03

## Context

El Node distribuido por Homebrew en esta máquina no incorpora el sentinel SEA necesario para inyectar el sidecar en un único ejecutable. A la vez, el flujo de documentación acordado requiere que un cambio de spec produzca artefactos de reconciliación, QA y estimación sin una confirmación adicional.

## Decision

Cuando SEA no está disponible, el bundle incluye un launcher `ade-sidecar` que resuelve un runtime explícito (`ADE_SIDECAR_NODE`), el Node de Homebrew de desarrollo o `node` en `PATH`. La reconciliación automática genera Markdown versionable bajo `docu/generated/` con informe de impacto, checklist QA y estimación inicial.

## Consequences

El `.app` puede ejecutar el sidecar en esta plataforma y el smoke de bundle cubre sidecar, app, health de OpenCode y una Task real en un repositorio efímero. El runtime totalmente autónomo sigue siendo una futura mejora de distribución. Los artefactos generados son trazables y revisables, pero no sustituyen una modificación semántica de los contratos canónicos cuando el cambio exige juicio de producto.
