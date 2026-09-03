# Spec: Living Knowledge

<!-- Nexus: SPEC-NEXUS.md | Module id: living-knowledge -->

## Objective

Mantener código, specs, nexus, ADRs, diagramas, tareas y documentación funcional coherentes mediante un grafo de referencias y reconciliación verificable.

## Commands

`npm run build`; `npm test`; `npm run ade -- docs impact <path>`; `npm run desktop:dev`.

## Project Structure

`docu/specs/`, `docu/adr/` y `docu/diagrams/` son conocimiento versionado; `src/application/knowledge/` calcula impacto; `skills/` aporta Spector, UML, QA docs y reconciliación.

## Code Style

Las referencias usan módulo y heading estable:

```md
[SPEC-agent-providers.md#provider-contract](SPEC-agent-providers.md#provider-contract)
```

## Testing Strategy

Tests de referencias, grafo acíclico, headings rotos, impacto transitivo, diagramas y sincronización nexus/specs/tareas.

## Boundaries

- Always: detectar citers y propagar cambios antes de marcar una Task completa.
- Ask first: cambiar contratos canónicos o resolver contradicciones automáticamente.
- Never: presentar una spec desactualizada como vigente ni sobrescribir decisiones históricas.

## Success Criteria

Al cambiar una spec, ADE identifica nexus, specs dependientes, diagramas y tareas afectadas y ofrece un paquete de reconciliación revisable.

## Open Questions

- ¿Parser Markdown propio o AST de librería estable?
- ¿Mermaid primero, PlantUML después, o ambos?
