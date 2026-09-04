# ADR-0023: Editor multimotor con CodeMirror 6 y Monaco, y Prettier como formatter acotado

## Status

Accepted

## Date

2026-09-05

## Context

El visor interno basado en `textarea` permitía editar y guardar, pero presentaba el código como texto plano: no había colores sintácticos, números de línea, plegado, búsqueda ni una lectura cómoda de estructuras. ADE necesita cubrir los lenguajes más usados sin asumir todavía el alcance de un IDE completo ni depender de servicios externos.

## Decision

Se adopta una interfaz común de editor con dos motores. CodeMirror 6 es el motor principal y sus paquetes oficiales cubren JavaScript/TypeScript, C++, Java, PHP, JSON, CSS/SCSS, HTML, Markdown, Python, Rust, SQL, XML y YAML. Monaco Editor se carga en la misma superficie como fallback para C, C#, Go, Dart, Dockerfiles, Elixir, F#, GraphQL, Kotlin, Lua, Objective-C, Perl, PowerShell, Protocol Buffers, R, Ruby, Scala, Shell y Swift. El lenguaje se detecta por extensión y el cambio de motor es transparente para el usuario: modelo de documento, guardado, descarte, dirty state, tema y atajos permanecen en el shell.

Se incorpora Prettier como formatter explícito para JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown y YAML. El botón `Format` sólo se habilita cuando existe un parser compatible; no se presenta como formatter universal. Python, Rust, SQL y XML mantienen resaltado e indentación de CodeMirror hasta que ADE defina una ejecución local segura y trazable para sus formatters específicos.

CodeMirror, sus paquetes oficiales, Monaco y Prettier se aceptan por sus licencias MIT. Las dependencias directas quedan inventariadas en [THIRD_PARTY_LICENSES.md](../../desktop/THIRD_PARTY_LICENSES.md); el lockfile es la fuente de versiones concretas y debe usarse para generar el aviso transitivo en cada release empaquetada.

## Alternatives considered

### Monaco Editor como único motor

Descartado como motor único: aunque es MIT y cubre una superficie amplia de definiciones, su runtime es más pesado para los lenguajes que CodeMirror ya atiende con una integración ligera. Se adopta de forma selectiva como fallback; la carga de workers, IntelliSense y LSP quedan fuera de esta slice.

### Monaco Editor como fallback selectivo

Aceptado: ofrece definiciones básicas MIT para una lista amplia de lenguajes y permite que ADE cubra C, C#, Go, Dart, Kotlin, Ruby, Swift y otros sin introducir paquetes de gramática no auditados. La integración se mantiene detrás de la interfaz común del Editor y no cambia la navegación ni el contrato de guardado.

### Shiki o highlight.js como visor principal

Rechazados como editor principal: resuelven muy bien el resaltado de lectura, pero no proporcionan por sí solos edición estructurada, selección, undo/redo, indentación y navegación que ADE necesita. Pueden evaluarse más adelante para previews de solo lectura o documentación.

### Formatter propio o formatter para cada lenguaje desde el inicio

Rechazado: aumenta la superficie de mantenimiento y obliga a ejecutar herramientas con políticas distintas. La primera slice ofrece Prettier donde su soporte es oficial y deja los demás lenguajes en un estado honesto de resaltado e indentación.

## Consequences

- El fichero deja de renderizarse como `textarea` plano y pasa a un modelo de documento mantenido por la interfaz común, con CodeMirror o Monaco según el lenguaje.
- El guardado, descarte, estado dirty y atajo `⌘/Ctrl+S` siguen perteneciendo al contrato existente de ADE.
- La edición obtiene una base extensible para búsqueda, plegado, navegación y futuras integraciones LSP sin introducirlas ahora.
- La aplicación incorpora Monaco y sus definiciones fallback, aumentando el bundle; la lista de contribuciones se mantiene explícita para evitar cargar el catálogo completo innecesariamente.
- El resaltado no equivale a IntelliSense ni a un formatter. Cada formatter futuro debe evaluarse por lenguaje, ejecución local, permisos y licencia.
- `Format` puede modificar el documento y por ello sólo actúa de forma explícita; el usuario conserva el control mediante `Discard` antes de guardar.
