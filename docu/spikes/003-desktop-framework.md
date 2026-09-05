# Spike 003 — Framework del shell desktop

**Estado:** Tauri validado en macOS, listo para shell ADE
**Fecha:** 2026-09-02  
**Spec:** [SPEC-desktop-shell.md](../specs/SPEC-desktop-shell.md#shell-contract)  
**Nexus:** [SPEC-NEXUS.md](../specs/SPEC-NEXUS.md#deferred-decisions)

## Objetivo

Elegir la base del shell desktop para la vertical visual de ADE sin adelantar la implementación de pantallas. Los criterios son: integración con procesos/filesystem locales, seguridad, tamaño y distribución, ergonomía TypeScript, macOS como primera plataforma y capacidad de mantener el dominio fuera de la UI.

## Evidencia

- El entorno actual es macOS con Xcode Command Line Tools y Node.js `v24.13.1`; `rustc` y `cargo` no están instalados.
- [Tauri v2](https://v2.tauri.app/concept/architecture/) combina un frontend web con un backend Rust y el WebView del sistema. Su desarrollo requiere Rust y dependencias del sistema ([prerequisites](https://v2.tauri.app/start/prerequisites/)).
- Tauri limita capacidades mediante permisos por ventana/webview ([capabilities](https://v2.tauri.app/security/capabilities/)), una propiedad útil para filesystem y procesos locales.
- [Electron](https://www.electronjs.org/docs/latest/tutorial/process-model) separa un proceso principal Node y procesos renderer basados en Chromium. Su guía de seguridad exige context isolation, sandboxing, IPC validado y no habilitar Node integration en contenido remoto ([security](https://www.electronjs.org/docs/latest/tutorial/security)).

## Comparativa

| Criterio | Tauri | Electron |
|---|---|---|
| Procesos/filesystem | Commands Rust y permisos explícitos | APIs Node en main + IPC/preload |
| Seguridad por defecto | Capabilities/scopes a delimitar | Context isolation, sandbox e IPC a configurar |
| Distribución | Binario pequeño y WebView del sistema | Incluye Chromium y Node |
| Coste inicial | Requiere Rust/toolchain nativo | Encaja directamente con TypeScript/Node actuales |
| Riesgo para ADE | Aprendizaje Rust y diferencias WebView | Mayor superficie y disciplina de seguridad |
| Encaje local-first | Alto | Alto |

## Recomendación

Recomendar Tauri para el shell de ADE, condicionado a validar en un spike de 30–60 minutos: arranque en macOS, acceso acotado a la raíz del Project, invocación de un caso de uso TypeScript, lectura de SQLite y apertura de terminal/IDE. La recomendación se basa en el principio local-first y en que las capacidades explícitas encajan con operaciones sensibles de ADE.

Electron queda como fallback si Rust/toolchain o las diferencias del WebView bloquean la primera vertical. No se debe instalar todavía como efecto de este spike: la decisión de framework y la autorización de nuevas dependencias preceden al scaffolding.

## Gate de decisión

La decisión queda lista para implementación cuando:

- `rustc`, `cargo` y Xcode CLT estén disponibles si se elige Tauri.
- Un prototipo vacío abre una ventana y ejecuta un comando local permitido.
- La UI sólo accede a casos de uso de ADE, nunca directamente a SQLite/Git.
- La configuración de permisos y el escape hatch tienen tests básicos.
- Se registra ADR aceptando Tauri o Electron y se actualiza `SPEC-desktop-shell`.

## Resultado

El prototipo Tauri se generó en `desktop/`, compiló en modo release y produjo `.app` y `.dmg` para macOS. `npm run tauri dev` también arrancó la ventana en modo desarrollo. El siguiente paso del proceso es generar el shell mínimo definido en `tasks/desktop-shell-plan.md`, sin ampliar todavía el alcance a un editor.
