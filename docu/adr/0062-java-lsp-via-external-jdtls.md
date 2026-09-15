# ADR-0062: Java LSP mediante JDTLS externo

- Estado: Propuesto
- Fecha: 2026-09-15
- Módulo: `java-lsp`

## Contexto

ADE ya permite editar Java con CodeMirror y resaltado sintáctico, pero todavía no ofrece inteligencia semántica. LSP permite separar el editor del conocimiento del lenguaje, y Eclipse JDT Language Server aporta una implementación Java madura. Su ejecución local encaja con el enfoque local-first de ADE, aunque introduce un proceso externo y una dependencia de Java 21+.

## Decisión

El MVP usará JDTLS externo sobre stdio, iniciado y detenido por el sidecar de ADE. El frontend conservará CodeMirror y recibirá una API tipada de alto nivel. La primera entrega cubrirá completion, hover, diagnostics y definition, con lifecycle, sincronización de documentos, negociación de capacidades, cancelación y fallback transparente si el servidor no está disponible.

ADE no incluirá ni descargará JDTLS todavía. La ruta o comando del servidor será una configuración explícita y validada por Project.

## Alternativas consideradas

- Implementar inteligencia Java propia: demasiado costoso y difícil de mantener.
- Cambiar el editor a Monaco: no resuelve por sí solo el lifecycle de Java y supondría una migración mayor.
- Incluir JDTLS en el bundle: simplifica el onboarding, pero aumenta tamaño, licencias, actualizaciones y superficie operativa.
- Ejecutarlo desde el terminal: no permite integrar respuestas con el editor ni controlar bien el lifecycle.

## Consecuencias

Se obtiene una base extensible para otros lenguajes y una mejora notable del editor Java sin acoplar el dominio a JDTLS. A cambio, la experiencia completa depende de que el usuario tenga Java/JDTLS configurados, y habrá que probar procesos, streams, rutas, rendimiento y diferencias entre macOS, Linux y Windows.

## Referencias

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Eclipse JDT Language Server](https://github.com/eclipse-jdtls/eclipse.jdt.ls)
- [Spec: Java LSP](../specs/SPEC-java-lsp.md)
