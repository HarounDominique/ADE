# ADE — Documentación

Esta es la única jerarquía normativa de documentación del proyecto.

La release v0.3 está cerrada y validada en macOS. La aplicación actual combina Project/Task, Explorer local, terminal PTY, proveedores agénticos, skills, Git/GitHub y documentación viva. La slice v0.4 de editor interno multimotor y los refinamientos posteriores del shell también están implementados y descritos en sus specs; CodeMirror 6 cubre los lenguajes oficiales incorporados y Monaco Editor amplía el resaltado para los lenguajes fallback con licencia MIT. `Agents` es una superficie inline con rail de conversaciones del Project activo agrupado por Task/General y conversación central, sin inspector lateral de actividad, ficheros o skills. El Project activo se mantiene sincronizado en todas las superficies aunque lleguen respuestas asíncronas; la única validación pendiente del recorrido visual es el smoke gráfico automatizado.

## Organización

- `specs/`: nexus y specs funcionales/técnicas. El nexus es el índice único y contiene el brief de producto, fundamentos, contratos, decisiones diferidas y change log.
- `adr/`: decisiones arquitectónicas con contexto, alternativas, decisión y consecuencias.
- `releases/`: evidencias y límites de cada release cerrada.
- `knowledge/`: documentación canónica, operativa y orientada a agentes que no pertenece directamente a una spec ni a un ADR.
- `generated/`: artefactos derivados de reconciliación (QA, estimación, UML e informes); no son fuente normativa, pueden regenerarse y no deben editarse a mano como contrato.

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

La baseline técnica vigente (2026-09-06) es `npm test` con 117 tests TypeScript y `cargo test --manifest-path desktop/src-tauri/Cargo.toml` con 18 tests Rust. La compilación estática usa `npm run build`; el bundle se verifica con `npm run desktop:package:app`. El smoke gráfico automatizado sigue pendiente. La shell no conserva chrome simulado: `Git workspace` solo aparece dentro de `Version control`, el grafo documental solo dentro de `Project context` y el runtime/servicios son infraestructura transversal. Los runtimes locales disponibles para Agents son OpenCode HTTP, Codex CLI y Claude Code CLI; el composer ofrece un catálogo de modelos dependiente del provider, con `Provider default` como opción sin override. CodeMirror carga en la ruta principal del Editor; Monaco y Prettier se resuelven bajo demanda. La selección del modelo pertenece a la conversación y se persiste con ella en `agent_sessions`; cada agente admite además un modelo por defecto, guardado localmente por la shell, que sólo decide en qué modelo arranca una conversación nueva. La topbar conserva el contexto global de Project, Task y branch: `Current task` muestra hasta 12 tareas por creación descendente y fija el contexto de las conversaciones nuevas sin reasignar las ya guardadas. `Version control` mantiene la distribución de lectura de GitHub Desktop: Changes separa working tree y diff, History permite colapsar sus columnas auxiliares y los diffs reenvuelven líneas largas al ancho disponible. Las cifras de cortes anteriores se conservan únicamente como evidencia histórica en sus respectivos documentos de release.
