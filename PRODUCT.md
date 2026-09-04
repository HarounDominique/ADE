# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

ADE se distribuye en esta iteración como shell desktop Tauri para macOS; la interfaz de trabajo es HTML/CSS y debe conservar affordances propias de una herramienta desktop.

## Stack

Static HTML/CSS/JavaScript dentro de Tauri 2, con un sidecar TypeScript/Node para el dominio y los servicios locales.

## Users

Desarrolladores individuales avanzados que dirigen agentes de IA sobre repositorios locales y necesitan mantener contexto, cambios, verificación y documentación en el mismo espacio de trabajo.

## Product Purpose

ADE concentra Project, Task, contexto de workspace, terminal, proveedores agénticos, skills, Git/GitHub y documentación viva. El humano define intención, restricciones y aceptación; los agentes ejecutan; ADE hace observable, verificable, reversible y revisable el resultado.

## Positioning

La unidad principal no es un archivo ni una conversación aislada, sino una `Task` trazable desde la intención hasta la sesión, el ChangeSet, la evidencia, las gates y la revisión. ADE organiza runtimes y herramientas intercambiables alrededor de ese flujo.

## Operating Context

- El usuario abre un Project local y navega su árbol de archivos.
- Trabaja en paralelo con terminal PTY, proveedor agéntico, skills y Git.
- Puede aislar Tasks mediante branches/worktrees y elegir flujo con PR o push directo.
- Las specs Markdown son fuente de intención; los cambios documentales generan impacto, QA, UML y estimaciones trazables.
- El usuario revisa permisos, cambios y gates antes de aceptar el resultado.

## Capabilities and Constraints

- Workspace local con raíz canónica, árbol perezoso, apertura segura de archivos y terminal PTY persistente.
- Shell desktop con navegación lateral única, Explorer compacto/expandido animado y tema claro/oscuro persistente.
- Dock de terminal inferior redimensionable con transcript único, prompt mínimo, historial `↑`/`↓` y completado de rutas `cd` mediante `Tab`.
- Editor interno acotado para ficheros de texto, con lectura/escritura segura, estado dirty, guardado, descarte, estados de preview y apertura externa explícita. CodeMirror 6 cubre los lenguajes oficiales incorporados y Monaco Editor aporta un fallback MIT para lenguajes adicionales, sin cambiar la superficie común.
- Proveedores OpenCode y Codex, con sesiones reanudables por Task y sin copiar credenciales a ADE.
- Skills nativas y skills de Project instalables/actualizables con permisos explícitos por ejecución.
- Git/GitHub con status, branches, worktrees, commits, push y PRs atribuidos a Tasks.
- Documentación viva con grafo de referencias, Mermaid y reconciliación de specs/ADRs.
- Evidencia, gates, reviews y servicios locales persistidos por Project/Task.
- v0.3 se valida en macOS; cloud, colaboración realtime, editor completo, `.dmg`, retrieval semántico, checkpoints automáticos y commits autónomos están fuera de alcance. La shell sí incluye un editor de texto interno acotado, con guardado y descarte bajo la raíz del Project.

## Brand Commitments

- Nombre: ADE — Agentic Development Environment.
- Voz: técnica, directa y orientada a la acción; el sistema debe comunicar control humano y estado verificable.
- Dirección solicitada para esta iteración: inspirarse en IDEs punteros, priorizando familiaridad operativa, densidad útil y navegación clara sobre una apariencia de dashboard genérico.

## Evidence on Hand

- Shell funcional en `desktop/src/index.html`, `desktop/src/main.js` y `desktop/src/styles.css`.
- Contratos y alcance en `docu/specs/SPEC-NEXUS.md` y las specs de módulos.
- Bundle macOS y smoke real documentados en `docu/releases/v0.3-close.md`.
- No hay assets de marca externos ni claims comerciales aprobados; no deben inventarse.

## Product Principles

- Human-in-command: toda operación de riesgo debe ser visible y atribuible.
- Context-first: Project y Task deben permanecer presentes mientras el usuario trabaja.
- Provider-agnostic: el workflow no depende de un único agente.
- Verification-first: la finalización del agente no equivale a aceptación.
- Observable and reversible: cambios, evidencia y estado deben poder rastrearse.

## Accessibility & Inclusion

No se ha fijado todavía un estándar específico de producto. Se preservarán navegación por teclado, foco visible, contraste suficiente, labels accesibles y estados no dependientes exclusivamente del color.
