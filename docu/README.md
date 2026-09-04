# ADE — Documentación

Esta es la única jerarquía normativa de documentación del proyecto.

La release v0.3 está cerrada y validada en macOS. La aplicación actual combina Project/Task, Explorer local, terminal PTY, proveedores agénticos, skills, Git/GitHub y documentación viva. La slice v0.4 de editor interno y los refinamientos posteriores del shell también están implementados y descritos en sus specs; la única validación pendiente del recorrido visual es el smoke gráfico automatizado.

## Organización

- `specs/`: nexus y specs funcionales/técnicas. El nexus es el índice único y contiene el brief de producto, fundamentos, contratos, decisiones diferidas y change log.
- `adr/`: decisiones arquitectónicas con contexto, alternativas, decisión y consecuencias.
- `releases/`: evidencias y límites de cada release cerrada.
- `knowledge/`: documentación canónica, operativa y orientada a agentes cuando el proyecto empiece a producirla.
- `generated/`: artefactos derivados de reconciliación (QA, estimación, UML e informes); no son fuente normativa y pueden regenerarse.

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

La baseline técnica vigente es `npm test` con 93 tests TypeScript y `cargo test --manifest-path desktop/src-tauri/Cargo.toml` con 18 tests Rust. Las cifras de cortes anteriores se conservan únicamente como evidencia histórica en sus respectivos documentos de release.
