# TODO: Java LSP MVP

- [x] Revisar y aprobar `SPEC-java-lsp.md` y `ADR-0062`.
- [x] Implementar transporte JSON-RPC/LSP testeable con un servidor falso.
- [x] Implementar lifecycle de JDTLS por Project y limpieza de procesos.
- [x] Añadir sincronización de documentos y protección de rutas del Project.
- [x] Exponer RPC/eventos del sidecar para estados, sincronización y requests LSP.
- [x] Integrar CodeMirror Java con fallback local, autocompletado, diagnósticos y navegación a definición (`Mod-Alt-Enter`).
- [x] Añadir hover contextual con tooltip nativo de CodeMirror.
- [ ] Añadir límites de URI, tamaño de mensajes, stderr y diagnósticos.
- [ ] Ejecutar build, tests y smoke test con JDTLS real si está disponible.
- [ ] Actualizar Nexus, documentación de instalación/configuración y changelog.
