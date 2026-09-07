# Assay

Assay es una workstation local-first para ingeniería de software agéntica: el humano define intención y restricciones, los agentes implementan, y el sistema hace visibles los cambios, la ejecución, la verificación y la revisión.

El nombre nombra la postura: un *assay* es la determinación de la composición y la pureza de una muestra. Lo que un agente afirma haber hecho no es autoridad sobre lo que hizo; el código, los tests y Git lo son. El repositorio y el binario conservan `ade` como identificador técnico, y la decisión está en [ADR-0032](docu/adr/0032-product-identity.md).

Este repositorio comienza deliberadamente por la documentación. La documentación es la fuente de intención y arquitectura; Git conserva el estado e historial del código; ADE conserva la metadata operativa del workflow.

## Documentación

- [Nexus de specs](docu/specs/SPEC-NEXUS.md)
- [Specs de módulos](docu/specs/)
- [Índice de documentación](docu/README.md)
- [ADRs](docu/adr/)

## Estado

MVP CLI y vertical desktop operables: ADE puede registrar Projects, crear y avanzar Tasks, ejecutar el flujo Implementer/Reviewer con OpenCode, persistir ChangeSets/Reviews/evidencia/gates en SQLite y aplicar aprobación humana desde Changes. Runtime incluye lifecycle mínimo de servicios locales.

v0.3 quedó cerrada en macOS: incluye workspace local con terminales PTY nativas, proveedores OpenCode, Codex y Claude Code con sesiones reanudables, skills instalables con permisos por ejecución, Git/GitHub enlazado a Tasks y documentación viva con reconciliación automática. La shell actual añade navegación lateral única redimensionable (190–720 px, acotada para conservar workbench), `Projects` como catálogo mínimo con alta y retirada segura de carpetas Git/No Git, `Editor` interno, `Agents` conversacional y `Version control` con historial, cambios, diff, commit local, push y fetch. `Agents` limita conversaciones al Project activo y las agrupa por Task/General; provider, modelo y permisos se eligen junto al composer, sin inspector Git lateral. En `Version control`, `Changes` usa un split real de working tree y diff dominante; `History` permite contraer sus columnas auxiliares y restaurarlas desde cabeceras accesibles, mientras los diffs se adaptan en tiempo real al ancho disponible. La interfaz evita estados simulados: `Git workspace` aparece sólo en `Version control` y el grafo documental sólo en `Context`; Tasks, tabs y diálogos son navegables por teclado. CodeMirror sirve la ruta principal y Monaco/Prettier se cargan bajo demanda. La baseline vigente (2026-09-06) es `npm test` con 117 tests TypeScript y `cargo test` con 18 tests Rust. El estado operativo por tarea vive en [tasks/todo.md](tasks/todo.md); los límites y la evidencia de cierre están en [SPEC-v0.3](docu/specs/SPEC-v0.3.md), [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md), [SPEC-agent-providers](docu/specs/SPEC-agent-providers.md) y [v0.3-close](docu/releases/v0.3-close.md).

La lista de `Agents` incluye OpenCode, Codex y Claude Code cuando sus comandos o servicios están disponibles localmente; las sesiones se reanudan sin copiar credenciales a ADE.
El composer permite seleccionar `Provider default` o un alias compatible con el provider activo; el catálogo cambia al cambiar de conversación y la selección se transmite al runtime.

## Quick start del spike

```bash
npm install
npm run build
npm test
```

Con OpenCode instalado y sirviendo en `127.0.0.1:4096`:

```bash
npm run dev -- /ruta/al/repositorio "Inspect the repository and report its current state without editing files."
```

Ver [Spike 001](docu/spikes/001-opencode-runtime.md) y [Spike 002](docu/spikes/002-independent-review.md) para contratos, resultados y limitaciones conocidas.

El flujo integrado se ejecuta con `npm run review -- /ruta/al/repositorio "Describe the task"` cuando OpenCode está sirviendo localmente.

El Editor interno usa CodeMirror 6 (MIT) como motor principal para resaltado sintáctico, gutter de líneas, plegado, búsqueda, indentación y edición. JavaScript/TypeScript, C++, Java, PHP, Python, Rust, CSS/SCSS, HTML, JSON, Markdown, SQL, XML y YAML usan sus paquetes oficiales; Monaco Editor (MIT) se activa automáticamente como fallback para C, C#, Go, Dart, Kotlin, Ruby, Swift, Scala, Lua, Shell, PowerShell, Objective-C, F#, Elixir, Perl, R, GraphQL, Protocol Buffers y Dockerfiles. La superficie de ADE sigue siendo única aunque cambie el motor por extensión. `Format` usa Prettier (MIT) para JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown y YAML; el alcance y el inventario de licencias están en [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md) y [THIRD_PARTY_LICENSES](desktop/THIRD_PARTY_LICENSES.md).

La CLI permite registrar Projects y operar Tasks sin UI:

```bash
npm run ade -- project register ade ADE /ruta/al/repositorio
npm run ade -- project snapshot ade
npm run ade -- task create task-1 "Describe la tarea" ade /ruta/al/repositorio
npm run ade -- task advance task-1 READY "Acceptance criteria recorded"
npm run ade -- review /ruta/al/repositorio "Describe la tarea"
```

`project snapshot` es la lectura estructurada que consume la shell desktop mediante el sidecar JSON-RPC de Tauri.
