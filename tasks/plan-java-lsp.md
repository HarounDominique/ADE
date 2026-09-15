# Plan: Java LSP MVP

## Objetivo

Implementar la vertical `java-lsp` según [SPEC-java-lsp](../docu/specs/SPEC-java-lsp.md), manteniendo el editor operativo sin JDTLS.

## Secuencia

1. Revisar y aprobar la spec y el ADR.
2. Crear el seam de transporte LSP: framing, ids, requests, notifications, errores y cancelación.
3. Implementar lifecycle por Project: detección/configuración, arranque, initialize, sincronización, shutdown y limpieza.
4. Exponer desde el sidecar estados y operaciones tipadas para completion, hover, diagnostics y definition.
5. Integrar el adapter con CodeMirror Java y conservar el fallback local.
6. Probar con fake server y, como smoke test, con una instalación real de JDTLS.
7. Reconciliar documentación, Nexus, changelog y criterios multiplataforma.

## Riesgos

- Procesos huérfanos o eventos tardíos al cambiar de Project.
- Diferencias de rutas/quoting y disponibilidad de Java entre plataformas.
- Latencia o volumen de diagnósticos que degrade la edición.
- Configuraciones Maven/Gradle que requieran más tiempo del esperado para indexar.

## Gate de verificación

No se considerará terminado hasta pasar build, tests deterministas, prueba manual de fallback y smoke test real documentado cuando el entorno lo permita.
