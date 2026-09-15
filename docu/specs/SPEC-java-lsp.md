# Spec: Java LSP

> Nexus: [SPEC-NEXUS.md](SPEC-NEXUS.md) · Module id: `java-lsp`

## Objetivo

Incorporar un MVP de Language Server Protocol (LSP) para Java en Assay/ADE. El editor conservará su funcionamiento actual y, cuando exista un servidor compatible, ofrecerá inteligencia semántica básica: autocompletado, hover, diagnósticos y navegación a definición.

El MVP no pretende convertir ADE en un IDE Java completo ni resolver refactors, debugging, test runners o gestión de dependencias.

## Decisiones de alcance

- Usar Eclipse JDT Language Server (JDTLS) como proceso externo local, comunicado por JSON-RPC/LSP sobre stdio.
- Requerir Java 21 o superior para JDTLS; ADE no descargará ni incluirá el servidor en esta primera iteración.
- Asociar una sesión LSP al Project activo y, inicialmente, a un único editor Java activo.
- Mantener CodeMirror como editor Java y adaptar sus eventos al cliente LSP.
- Si Java o JDTLS no están disponibles, el editor seguirá funcionando con resaltado y completados locales.

## Experiencia de usuario

El usuario podrá ver un estado claro: `starting`, `ready`, `unavailable` o `failed`. Los errores serán accionables y no bloquearán la edición. La activación será explícita o configurable por Project, nunca una descarga o ejecución silenciosa.

## Arquitectura

```text
CodeMirror Java
    ↕ editor adapter
Cliente LSP de ADE
    ↕ RPC interno / eventos
Sidecar Tauri
    ↕ JSON-RPC LSP sobre stdio
Eclipse JDTLS externo
```

El lifecycle se gestionará desde el sidecar para controlar proceso, streams, cancelación, cierre y diagnóstico. El frontend recibirá estados y respuestas tipadas, sin conocer detalles del proceso hijo.

## Protocolo MVP

Soportar, negociando capacidades durante `initialize`:

- lifecycle: `initialize`, `initialized`, `shutdown`, `exit`;
- sincronización: `textDocument/didOpen`, `didChange`, `didClose`;
- editor: `textDocument/completion`, `textDocument/hover`, `textDocument/definition`;
- diagnóstico: `textDocument/publishDiagnostics`;
- robustez: ids correlacionados, notificaciones, errores, cancelación y rechazo de eventos de sesiones antiguas.

La sincronización será incremental si el cliente y el servidor lo permiten; de lo contrario se podrá usar texto completo como fallback del MVP.

## Seguridad y límites

- Las URI de documentos se limitarán al Project canónico activo.
- No se enviarán secretos, tokens ni contenido ajeno al Project sin una acción explícita.
- Se limitarán tamaño de mensajes, stderr y volumen de diagnósticos para evitar bloqueos del sidecar.
- JDTLS no podrá modificar Tasks, Git, agentes ni permisos de herramientas a través de esta integración.
- Descargar, instalar automáticamente o persistir JDTLS queda fuera del MVP y requiere una decisión posterior.

## Verificación

- Tests unitarios del framing JSON-RPC, correlación de respuestas, errores y cancelación.
- Fake language server para probar lifecycle, sincronización, estados y eventos tardíos.
- Tests de integración del adapter CodeMirror con completion, hover, diagnostics y definition.
- Smoke test opcional con JDTLS real cuando el entorno tenga Java 21+ y JDTLS instalado.
- `npm run build`, tests del proyecto y comprobación manual de que Java sigue siendo editable sin servidor.

## Criterios de aceptación

1. Un Project Java puede iniciar y detener una sesión JDTLS sin dejar procesos huérfanos.
2. Un archivo Java abierto recibe al menos completion, hover, diagnostics y definition cuando el servidor está disponible.
3. El estado y el error de la integración son visibles y comprensibles.
4. La ausencia o caída de JDTLS no impide editar, guardar ni usar el resto de ADE.
5. La implementación queda cubierta por tests deterministas sin depender de una instalación local de Java.

## Preguntas abiertas

- ¿La activación inicial será manual desde el editor o automática al detectar un Project Java?
- ¿Dónde se declarará la ruta al binario/configuración de JDTLS por Project?
- ¿Qué política de exclusión se aplicará a `target/`, `build/` y otros artefactos grandes?
