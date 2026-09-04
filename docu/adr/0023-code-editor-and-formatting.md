# ADR-0023: CodeMirror 6 como editor de código y Prettier como formatter acotado

## Status

Accepted

## Date

2026-09-05

## Context

El visor interno basado en `textarea` permitía editar y guardar, pero presentaba el código como texto plano: no había colores sintácticos, números de línea, plegado, búsqueda ni una lectura cómoda de estructuras. ADE necesita atender ficheros de varios lenguajes sin asumir todavía el alcance de un IDE completo ni depender de servicios externos.

## Decision

Se adopta CodeMirror 6 para la superficie de edición y lectura de código. Se incorporan sus paquetes oficiales de lenguaje para JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown, Python, Rust, SQL, XML y YAML. El lenguaje se detecta por extensión y la configuración se reutiliza en la misma instancia del editor.

Se incorpora Prettier como formatter explícito para JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown y YAML. El botón `Format` sólo se habilita cuando existe un parser compatible; no se presenta como formatter universal. Python, Rust, SQL y XML mantienen resaltado e indentación de CodeMirror hasta que ADE defina una ejecución local segura y trazable para sus formatters específicos.

CodeMirror, sus paquetes oficiales y Prettier se aceptan por sus licencias MIT. Las dependencias directas quedan inventariadas en [THIRD_PARTY_LICENSES.md](../../desktop/THIRD_PARTY_LICENSES.md); el lockfile es la fuente de versiones concretas y debe usarse para generar el aviso transitivo en cada release empaquetada.

## Alternatives considered

### Monaco Editor

Rechazado para esta iteración: también es MIT y ofrece una experiencia cercana a VS Code, pero su runtime y carga de workers son más pesados para la shell estática Tauri actual. Se podrá reevaluar cuando ADE necesite IntelliSense, LSP o modelos de documento más completos.

### Shiki o highlight.js como visor principal

Rechazados como editor principal: resuelven muy bien el resaltado de lectura, pero no proporcionan por sí solos edición estructurada, selección, undo/redo, indentación y navegación que ADE necesita. Pueden evaluarse más adelante para previews de solo lectura o documentación.

### Formatter propio o formatter para cada lenguaje desde el inicio

Rechazado: aumenta la superficie de mantenimiento y obliga a ejecutar herramientas con políticas distintas. La primera slice ofrece Prettier donde su soporte es oficial y deja los demás lenguajes en un estado honesto de resaltado e indentación.

## Consequences

- El fichero deja de renderizarse como `textarea` plano y pasa a un modelo de documento CodeMirror.
- El guardado, descarte, estado dirty y atajo `⌘/Ctrl+S` siguen perteneciendo al contrato existente de ADE.
- La edición obtiene una base extensible para búsqueda, plegado, navegación y futuras integraciones LSP sin introducirlas ahora.
- `Format` puede modificar el documento y por ello sólo actúa de forma explícita; el usuario conserva el control mediante `Discard` antes de guardar.
