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

v0.3 quedó cerrada en macOS: incluye workspace local con terminales PTY nativas, proveedores OpenCode, Codex y Claude Code con sesiones reanudables, skills instalables con permisos por ejecución, Git/GitHub enlazado a Tasks y documentación viva con reconciliación automática. La shell actual añade navegación lateral única redimensionable (190–720 px, acotada para conservar workbench), `Projects` como catálogo mínimo con alta y retirada segura de carpetas Git/No Git, `Editor` interno, `Agents` conversacional y `Version control` con historial, cambios, diff, commit local, push y fetch. `Agents` limita conversaciones al Project activo y las agrupa por Task/General; provider, modelo y permisos se eligen junto al composer, sin inspector Git lateral. En `Version control`, `Changes` usa un split real de working tree y diff dominante; `History` permite contraer sus columnas auxiliares y restaurarlas desde cabeceras accesibles, mientras los diffs se adaptan en tiempo real al ancho disponible. La interfaz evita estados simulados: `Git workspace` aparece sólo en `Version control` y el grafo documental sólo en `Context`; Tasks, tabs y diálogos son navegables por teclado. CodeMirror sirve la ruta principal y Monaco/Prettier se cargan bajo demanda. La baseline vigente (2026-09-06) es `npm test` con 117 tests TypeScript y `cargo test` con 19 tests Rust. El estado operativo por tarea vive en [tasks/todo.md](tasks/todo.md); los límites y la evidencia de cierre están en [SPEC-v0.3](docu/specs/SPEC-v0.3.md), [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md), [SPEC-agent-providers](docu/specs/SPEC-agent-providers.md) y [v0.3-close](docu/releases/v0.3-close.md).

La lista de `Agents` incluye OpenCode, Codex y Claude Code cuando sus comandos o servicios están disponibles localmente; las sesiones se reanudan sin copiar credenciales a ADE.
La cabecera de la conversación permite seleccionar `Provider default` o un alias compatible con el provider activo, y marcar con una estrella el modelo por defecto de ese agente; el catálogo cambia al cambiar de conversación, el default sólo siembra las conversaciones nuevas y la selección se transmite al runtime.

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

El control de ejecución también inspecciona de forma no destructiva los manifiestos del Project y propone configuraciones de build, test y lint para Node, Python, Maven/Gradle, Rust, Go y .NET. ADE delega en los toolchains instalados por el repositorio —no empaqueta compiladores—, muestra su disponibilidad y versión, y no ejecuta ni guarda una propuesta hasta que el operador la acepta. El contrato y sus límites están en [SPEC-run-configurations](docu/specs/SPEC-run-configurations.md) y la decisión en [ADR-0038](docu/adr/0038-external-project-toolchains.md).

La CLI permite registrar Projects y operar Tasks sin UI:

```bash
npm run ade -- project register ade ADE /ruta/al/repositorio
npm run ade -- project snapshot ade
npm run ade -- task create task-1 "Describe la tarea" ade /ruta/al/repositorio
npm run ade -- task advance task-1 READY "Acceptance criteria recorded"
npm run ade -- review /ruta/al/repositorio "Describe la tarea"
```

`project snapshot` es la lectura estructurada que consume la shell desktop mediante el sidecar JSON-RPC de Tauri.

## Gate estructural con ASK

Assay no analiza código: consume evidencia estructural de [ASK Engine](https://github.com/HarounDominique/sourcecode) por contrato y la publica como la gate `structural-gate` de una Task. El diseño está en [SPEC-structural-gate](docu/specs/SPEC-structural-gate.md) y la decisión en [ADR-0037](docu/adr/0037-structural-gate-from-ask.md).

Requisitos: ASK instalado (`pip install sourcecode`, comando `ask`) y la skill de Project instalada. `ADE_ASK_COMMAND` fuerza un ejecutable concreto cuando conviven varios entornos.

```bash
# 1. instalar la skill en el Project (una vez)
#    equivale a skills.install con source ./skills/ask-gate.json
```

```json
{"id":"i1","method":"skills.install","params":{"repositoryPath":"/ruta/al/proyecto","source":"/ruta/a/ADE/skills/ask-gate.json"}}
```

```json
{"id":"g1","method":"gate.ask","params":{"repositoryPath":"/ruta/al/proyecto","since":"origin/main","taskId":"task-1","grantedPermissions":["run_commands"]}}
```

La respuesta trae el veredicto, los componentes implicados, la versión de ASK y el comando exacto que se ejecutó:

```json
{"gate":{"id":"structural-gate","status":"pending","evidenceIds":["structural-gate-task-1-..."],"failureReason":"ASK could not decide: verify"},
 "verdict":"UNVERIFIED","exitCode":2,"since":"origin/main","unverifiedComponents":["verify"],
 "tool":{"name":"ask","version":"5.9.30","buildCommit":"793177c"},
 "command":["pack","gate","/ruta/al/proyecto","--format","json","--compact","--since","origin/main"]}
```

| Veredicto ASK | Gate de Assay | Significado |
|---|---|---|
| `PASS` | `passed` | ningún componente estableció bloqueo y todos pudieron decidir |
| `BLOCK` | `failed` | un componente estableció un cambio bloqueante |
| `UNVERIFIED` | `pending` | no se probó nada en ninguna dirección — nunca se convierte en `passed` |

Sin `taskId` la llamada es una lectura. Con `taskId` el veredicto se persiste como evidencia `structural.gate.*` y aparece en `change.review`. La gate es **opt-in**: un Project la exige declarándola en `.ade/policy.json`.

```json
{"requiredGates":["build","tests","agent-review","documentation-review","structural-gate","human-approval"]}
```

### El agente usa ASK por su cuenta

Cuando el Project es Java y `ask` está instalado, el turno del agente empieza con un briefing corto de capacidades — qué es ASK, los comandos que pagan y su frontera — y el agente decide si lo usa. Nada se ejecuta en su nombre.

```
[ADE] This repository is Java/Spring (pom.xml, …). ASK Engine is installed as `ask`: it answers
structural questions deterministically from a cached model of the repository, so reach for it
before re-reading the tree file by file.
- `ask . --compact` — repository shape and where to start
- `ask endpoints .` — REST surface with effective paths and security policy
- `ask impact <Type> .` — what breaks if that type changes
…
```

Un repositorio sin Java no recibe briefing, y Java que sólo vive en un fixture de tests no cuenta como repositorio Java. Se desactiva con `"structuralBriefing": false` en `.ade/policy.json`. El briefing no se persiste en la conversación: se guarda el prompt del operador.

Sin ASK instalado, `gate.ask` responde `ASK_UNAVAILABLE` con la instrucción de instalación; nunca una gate aprobada. ASK responde con solvencia en repositorios Java/Spring: en otros lenguajes el veredicto habitual es `UNVERIFIED`, que es exactamente lo que la gate publica.
