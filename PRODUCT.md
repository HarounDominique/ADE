# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop (macOS)

Assay se distribuye en esta iteración como shell desktop Tauri para macOS; la interfaz de trabajo es HTML/CSS y debe conservar affordances propias de una herramienta desktop.

La shell prioriza claridad verificable sobre ornamentación: una acción visible debe funcionar, un estado visible debe tener una fuente real y cada panel debe vivir únicamente en la vista donde el usuario puede actuar sobre él.

## Stack

Static HTML/CSS/JavaScript dentro de Tauri 2, con un sidecar TypeScript/Node para el dominio y los servicios locales.

## Users

Desarrolladores individuales avanzados que dirigen agentes de IA sobre repositorios locales y necesitan mantener contexto, cambios, verificación y documentación en el mismo espacio de trabajo.

## Product Purpose

Assay concentra Project, Task, contexto de workspace, terminal, proveedores agénticos, skills, Git/GitHub y documentación viva. El humano define intención, restricciones y aceptación; los agentes ejecutan; Assay hace observable, verificable, reversible y revisable el resultado.

## Positioning

La unidad principal no es un archivo ni una conversación aislada, sino una `Task` trazable desde la intención hasta la sesión, el ChangeSet, la evidencia, las gates y la revisión. Assay organiza runtimes y herramientas intercambiables alrededor de ese flujo.

## Operating Context

- El usuario abre un Project local y navega su árbol de archivos.
- Trabaja en paralelo con terminal PTY, proveedor agéntico, skills y Git.
- Puede aislar Tasks mediante branches/worktrees y elegir flujo con PR o push directo.
- Las specs Markdown son fuente de intención; los cambios documentales generan impacto, QA, UML y estimaciones trazables.
- El usuario revisa permisos, cambios y gates antes de aceptar el resultado.

## Capabilities and Constraints

- Workspace local con raíz canónica, árbol perezoso, apertura segura de archivos y terminal PTY persistente.
- Shell desktop con navegación lateral única, Explorer compacto/expandido animado y tema claro/oscuro persistente.
- Dock de terminal inferior redimensionable con transcript único, prompt mínimo, historial `↑`/`↓` y completado de rutas `cd` mediante `Tab`; un control centrado en el divisor alterna directamente entre sus alturas mínima y máxima sin modificar esos límites.
- Editor interno acotado para ficheros de texto, con lectura/escritura segura, estado dirty, guardado, descarte, estados de preview y apertura externa explícita. CodeMirror 6 cubre los lenguajes oficiales incorporados y Monaco Editor aporta un fallback MIT para lenguajes adicionales, sin cambiar la superficie común.
- Proveedores OpenCode, Codex y Claude Code, con sesiones reanudables por Task y sin copiar credenciales a ADE.
- La topbar mantiene Project, Task y branch como contexto transversal. `Current task`, entre Project y branch, presenta hasta 12 Tasks del Project activo por creación descendente y sincroniza Work, Changes, gates, Git y el contexto de una conversación nueva sin reasignar conversaciones existentes.
- `Agents` como workbench inline: rail de conversaciones del Project activo agrupadas por Task/General, contraíble con transición y conversación central dominante; provider y modelo dependiente viven en la cabecera contextual, mientras la Task vive en la topbar y permisos/envío junto al composer. El composer conserva un historial local por Project con `↑`/`↓`, envía con `Enter` (`Shift+Enter` añade línea) y detiene el turno activo con `Esc`, abortando el runtime del proveedor. El inspector lateral de actividad, ficheros y skills no forma parte de la vista primaria.
- Skills nativas y skills de Project instalables/actualizables con permisos explícitos por ejecución.
- Git/GitHub con status, branches, worktrees, commits, push y PRs atribuidos a Tasks; `Version control` separa Changes/History, mantiene el diff dominante, permite colapsar columnas auxiliares de History y adapta el diff al ancho disponible.
- Documentación viva con grafo de referencias, Mermaid y reconciliación de specs/ADRs.
- Evidencia, gates, reviews y servicios locales persistidos por Project/Task.
- v0.3 se valida en macOS; cloud, colaboración realtime, editor completo, `.dmg`, retrieval semántico, checkpoints automáticos y commits autónomos están fuera de alcance. La shell sí incluye un editor de texto interno acotado, con guardado y descarte bajo la raíz del Project.

## Brand Commitments

- Nombre: ADE — Agentic Development Environment.
- Voz: técnica, directa y orientada a la acción; el sistema debe comunicar control humano y estado verificable.
- Dirección activa para esta iteración: `Sala de Evidencia`, una identidad visual completa y light-first que prioriza lectura de conversaciones, evidencia de cambios, claridad de Git y navegación accesible sobre densidad de IDE o estética de dashboard genérico. Codex Desktop y GitHub Desktop son referencias de jerarquía y flujo, no copias literales.

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

La identidad exige navegación por teclado, foco visible, contraste suficiente, labels accesibles, estados no dependientes exclusivamente del color, respeto por `prefers-reduced-motion` y adaptación a distintos tamaños de ventana.
