# Spec: Living Knowledge

<!-- Nexus: SPEC-NEXUS.md | Module id: living-knowledge -->

## Objective

Mantener código, specs, nexus, ADRs, diagramas, tareas y documentación funcional coherentes mediante un grafo de referencias y reconciliación verificable.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`. El análisis y la reconciliación se exponen mediante las operaciones de sidecar `knowledge.graph`, `knowledge.impact`, `knowledge.reconcile`, `knowledge.reconcile.apply` y `knowledge.reconcile.changed`; `npm run ade` no tiene todavía un subcomando `docs`.

## Project Structure

`docu/specs/` y `docu/adr/` son conocimiento normativo versionado; `docu/generated/` contiene reconciliación, QA, estimaciones y Mermaid derivados; `src/application/knowledge/` calcula impacto; las skills aportan Spector, UML, QA docs y reconciliación. El grafo excluye documentación instalada de herramientas (`.agents/`, `.codex/`, `.impeccable/`), además de dependencias, artefactos generados y metadatos locales, para no tratar enlaces externos de esas herramientas como referencias del proyecto.

## Code Style

Las referencias usan módulo y heading estable:

```md
[SPEC-agent-providers.md#agents-surface](SPEC-agent-providers.md#agents-surface)
```

## Testing Strategy

Tests de referencias, grafo acíclico, headings rotos, impacto transitivo, diagramas y sincronización nexus/specs/tareas.

## Boundaries

- Always: detectar citers y propagar cambios antes de marcar una Task completa; generar el paquete de reconciliación y registrar su traza canónica en el Nexus sin confirmación adicional.
- Ask first: resolver una contradicción semántica que el grafo no pueda deducir de las referencias y los contratos existentes.
- Never: presentar una spec desactualizada como vigente ni sobrescribir decisiones históricas.

## Automatic reconciliation

`knowledge.reconcile.apply` escribe tres artefactos versionables por spec afectada: `docu/generated/reconciliation/`, `docu/generated/qa/` y `docu/generated/estimates/`. Incluyen dependencias transitivas, enlaces rotos, UML Mermaid, checklist funcional y una estimación inicial. Cuando existe, `docu/specs/SPEC-NEXUS.md` recibe una entrada idempotente con la evidencia y los artefactos generados.

`knowledge.reconcile.changed` consulta `git status --porcelain`, selecciona specs y ADRs Markdown modificados (excluyendo Nexus y los artefactos generados) y ejecuta la reconciliación de cada uno en secuencia. La secuencia evita carreras al actualizar el Nexus; su resumen y evidencia se vinculan a la Task seleccionada desde el workbench.

## Success Criteria

Al cambiar una o varias specs/ADRs, ADE identifica nexus, dependientes, diagramas y tareas afectadas y genera un paquete de reconciliación trazable para cada cambio.

## Open Questions

- ¿Parser Markdown propio o AST de librería estable?
- ¿Mermaid primero, PlantUML después, o ambos?
