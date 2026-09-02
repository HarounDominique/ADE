# ADE — Documentación

Esta es la única jerarquía normativa de documentación del proyecto.

## Organización

- `specs/`: nexus y specs funcionales/técnicas. El nexus es el índice único y contiene el brief de producto, fundamentos, contrato del MVP, decisiones abiertas y change log.
- `adr/`: decisiones arquitectónicas con contexto, alternativas, decisión y consecuencias.
- `knowledge/`: documentación canónica, operativa y orientada a agentes cuando el proyecto empiece a producirla.

## Regla de mantenimiento

No crear specs paralelas en otra carpeta. Cuando cambie una spec, actualizar sus citers, la tabla de módulos y el change log del nexus. Cuando cambie una decisión costosa de revertir, crear un nuevo ADR en vez de editar o borrar el histórico.

## Fuente de verdad

```text
docu/specs/     → intención, requisitos, workflow y arquitectura
docu/adr/       → decisiones y su razonamiento
docu/knowledge/ → conocimiento del proyecto
Git             → código, documentos versionados e historial
ADE DB          → metadata operativa futura
```

Para empezar, consultar [SPEC-NEXUS.md](specs/SPEC-NEXUS.md).
