# Spec: Desktop Shell and Review UX

<!-- Nexus: SPEC-NEXUS.md | Module id: desktop-shell -->

## Objective

Ofrecer una superficie desktop centrada en proyectos y Tasks, con navegación por Knowledge, Changes y Runtime, incorporando un editor interno de texto acotado sin construir todavía un editor completo.

## Shell contract

El shell es una vista local sobre los contratos de `project-task-workflow`, `development-workflow`, `agent-runtime`, `local-runtime` y `changes-review-governance`. No duplica su lógica ni permite mutar estado sin pasar por los casos de uso de aplicación.

El arranque debe:

1. Detectar o registrar un Project local.
2. Mostrar Tasks activas, fase, gates y estado Git.
3. Permitir crear o reanudar una Task.
4. Observar ejecución, logs, cambios y Review.
5. Exponer `approve` y `ship` sólo cuando las gates lo permitan.

El shell debe funcionar sin cloud y conservar la capacidad de abrir el repositorio en un IDE o terminal externo. La navegación principal debe ser una única superficie lateral etiquetada, sin duplicar una barra de iconos con otro menú de texto.

## Information architecture

Las áreas visibles son `PROJECTS`, `EDITOR`, `WORK`, `KNOWLEDGE`, `CHANGES` y `RUNTIME`. `Projects` administra el catálogo local y el Project activo; `Editor` es la superficie de ficheros. El resumen del Project comunica branch o ausencia de Git, Tasks, agentes, cambios, gates, revisiones y servicios. La pantalla de resultado debe permitir entender una Task antes de abrir el diff.

### Projects

La entrada `Projects` es una pantalla de gestión deliberadamente mínima. Muestra únicamente el catálogo de Projects registrados, `Add project` (selector nativo de carpetas), el título del Project seleccionado y un resumen de cuatro métricas: `Active tasks`, `In review`, `Services` y `Last ship`. Cada fila muestra nombre, ruta y `Git`/`No Git`, permite activar el Project y ofrece `Remove from ADE`; la retirada elimina sólo el registro de seguimiento de la base local, nunca la carpeta ni sus ficheros. El Project activo no puede retirarse si es el único registrado; si existen otros, la retirada selecciona automáticamente el siguiente. La pantalla y el selector `Current project` de la topbar consumen el mismo catálogo persistido.

### Editor

`Editor` muestra el fichero de texto activo con nombre, ruta relativa, estado dirty, `Save`, `Discard` y apertura externa explícita. Seleccionar un fichero en Explorer o encontrarlo mediante búsqueda activa esta vista automáticamente. Sin fichero activo se muestra un estado vacío accionable; cerrar el documento no abre aplicaciones externas ni cambia el Project.

### Git context bar

La topbar no duplica el buscador del Explorer. En su lugar presenta dos selectores persistentes y navegables, inspirados en los gestores Git de escritorio:

- `Current project` muestra el Project activo —Git o No Git— y abre los Projects locales previamente registrados, con nombre, ruta y tipo de control de versiones.
- `Current branch` muestra la rama activa y abre las ramas locales del Project Git activo, consultadas bajo demanda desde `git.workspace`; en un Project No Git muestra `No Git` y queda deshabilitado.

Seleccionar un Project cambia el contexto canónico de Tauri, refresca snapshot, árbol, Editor, branch, servicios, skills y estado Git, y conserva la selección de fichero sólo si sigue perteneciendo a la nueva raíz. El Project activo se mantiene como estado único del shell: cada refresh posterior de snapshot debe fusionarse sobre ese estado, nunca sobre el fixture inicial, para que nombre, ruta y tipo de control de versiones permanezcan sincronizados en topbar, breadcrumb, Projects, resumen del Project, Editor, terminal y paneles dependientes. Seleccionar una rama ejecuta `git switch` mediante el sidecar sólo si el Project es Git; no fuerza ni descarta cambios. Si Git rechaza la operación, se muestra el error y permanece visible el contexto anterior. Los menús deben exponer estados `loading`, `empty`, `failed` y `switching`, cerrar al seleccionar o pulsar fuera y ser navegables por teclado.

El Explorer mantiene el buscador como única búsqueda de ficheros. Una lupa accionable junto al título `Explorer` enfoca el filtro sin crear una segunda búsqueda.

### Project summary

El resumen operativo dentro de `Projects` no es una entrada separada ni un segundo workbench. Bajo el título del Project activo presenta sólo las cuatro métricas compactas del contrato: Tasks activas, Tasks en revisión, servicios activos/declarados y último envío. El detalle de Tasks, actividad, Git, agentes, servicios y evidencia vive en `Work`, `Changes` y `Runtime`.

### Sidebar and Explorer

El lateral combina una navegación etiquetada para `Projects`, `Editor`, `Work`, `Knowledge`, `Changes` y `Runtime` con el Explorer del Project. No se muestran simultáneamente dos menús que representen las mismas vistas. Un divisor vertical visible permite redimensionar el lateral por pointer o teclado, con límites de 190–720 px (acotados responsivamente al ancho de ventana) y ancho persistido por Project. El Explorer tiene dos estados:

- **Compacto:** cuando existe un archivo activo, muestra su rama de carpetas desde la raíz del Project hasta el archivo, ocultando hermanos no relevantes y manteniendo el contexto como un breadcrumb en formato árbol. Si todavía no hay archivo activo, muestra los hijos directos de la raíz.
- **Expandido:** al pulsar el control de expansión o una carpeta de la rama compacta, oculta las opciones de navegación y convierte el árbol en la superficie principal del lateral. Los hijos se cargan perezosamente y la rama seleccionada permanece resaltada.

El control de contraer restaura la navegación y reconstruye la rama compacta del archivo activo. La transición no cambia el Project ni la Task seleccionada.

El filtro del Explorer busca recursivamente por nombre y ruta, pero muestra como resultado directo el fichero coincidente, no la carpeta contenedora. Cada resultado incluye el nombre del fichero y una ruta relativa legible, adyacente y envolvente de sus carpetas padre para distinguir ficheros homónimos; la ruta no se trunca visualmente y el tooltip conserva la ruta completa. El input permanece responsivo mientras se construye el primer índice recursivo: las pulsaciones se agrupan con un debounce corto, las búsquedas obsoletas se ignoran y un spinner visible indica que aún no están listos los resultados actuales. El índice normalizado se reutiliza durante la sesión del Project para que las siguientes búsquedas sean filtrados locales ligeros. Al seleccionar un resultado, la consulta se limpia, se abre el fichero dentro de ADE y el Explorer vuelve a la rama breadcrumb compacta del archivo activo.

### Editor

Seleccionar un fichero de texto en el Explorer abre su contenido dentro del workbench, en un editor acotado, mostrando nombre, ruta relativa y estado de carga. El documento activo se mantiene sincronizado con la rama compacta del Explorer, permite `Save`, `Discard` y `⌘/Ctrl+S`, y no altera la Task ni el dock de terminal.

El Editor trata binarios, ficheros ilegibles y previews demasiado grandes con estados explicativos. `Open externally` es una acción separada y explícita; seleccionar un fichero nunca debe lanzar automáticamente una aplicación del sistema. La lectura se solicita al backend Tauri y queda sometida a la autorización de la raíz del Project. El alcance completo está en [file-workspace](SPEC-file-workspace.md#product-contract).

### Terminal dock

La terminal nativa ocupa un dock inferior redimensionable: el usuario puede aumentar o reducir su altura mediante un divisor visible. El dock presenta tabs de terminal y una acción explícita para crear una nueva sesión; cada tab representa un PTY independiente con transcript, cwd, historial y estado de completado propios. Cambiar de tab conserva la sesión anterior sin reiniciarla ni mezclar su salida. Cerrar un tab detiene únicamente su PTY y, si era el último, crea o conserva una sesión activa para que el dock nunca quede sin terminal.

Cada tab presenta una única superficie de consola familiar, compuesta por un transcript PTY desplazable y una línea de prompt integrada. El shell conserva el cwd del Project, posee el eco y el prompt mínimos y la UI no añade una bienvenida ni repite la salida del proceso. El transcript interpreta ANSI para que el cursor, el borrado y la pantalla alternativa de una TUI como Claude se rendericen correctamente.

La interacción mínima es la esperada en una terminal: `Enter` ejecuta el comando, `↑`/`↓` recorren el historial del tab activo y `cd <ruta>` admite completado de directorios con `Tab`. Cuando existen varias coincidencias, el dock muestra una lista de sugerencias accesible que puede recorrerse con `↑`/`↓`; `Esc` la cierra. El completado es deliberadamente acotado a rutas de `cd`, no sustituye un shell completo ni un language server.

### Work

Permite crear, reanudar y observar Tasks y sus conversaciones. La creación y las transiciones seguras atraviesan `task.create`/`task.advance` por el sidecar, exigen transición válida, razón y actor, y refrescan el resumen de `Projects`. Una Task en `READY`, `CHANGES_REQUESTED` o `BLOCKED` puede iniciar `task.run`; la shell recibe aceptación inmediata y eventos de Implementer, mientras el sidecar persiste la transición, diff y ChangeSet. La conversación es una vista auxiliar: la identidad, estado y resultado se leen del agregado Task y sus registros relacionados.

### Knowledge

Muestra documentos seleccionados, motivo de inclusión, clase (`canonical`, `operational`, `agent`) e impacto pendiente. Los documentos canónicos se abren para consulta mediante Tauri, limitado a `docu/specs`, y sus cambios pasan por la gate documental.

### Changes

Presenta resumen semántico, impacto, findings, archivos, diff, ChangeSets y checkpoints en ese orden. La primera slice selecciona la Task real del `ProjectSnapshot`, priorizando `UNDER_REVIEW` y `READY_FOR_HUMAN`, y muestra un estado vacío explícito si no existe. Las acciones de corregir, aceptar riesgo, descartar y re-review deben mostrar actor, razón y evidencia.

### Runtime

Muestra sesiones, servicios, procesos, puertos, healthchecks, terminal, stdout/stderr y tests. Expone `runtime.status` y `runtime.health` por el sidecar; Runtime puede comprobar OpenCode y presenta versión o `RUNTIME_UNAVAILABLE` como evidencia. También muestra por separado `sidecar: READY`, `agentRuntime`, Task activa, último evento y último error. `task.run` sólo acepta `READY`, `CHANGES_REQUESTED` o `BLOCKED`, emite `runtime.event`, `runtime.completed` o `runtime.failed`; si falla durante la ejecución, la Task queda en `BLOCKED`. La UI conserva hasta 12 eventos recientes con hora, tipo y Task, y refresca el resumen de `Projects` al finalizar. Un estado `RUNNING` debe provenir de evidencia de runtime, no de una inferencia visual; `DISCONNECTED` no implica fallo del proyecto ni ejecución cancelada.

## Interaction states

Toda vista relevante debe representar explícitamente `loading`, `ready`, `empty`, `blocked`, `failed` y `stale`. El Explorer añade estados `compact` y `expanded`; el botón de expansión expone `aria-expanded` y el foco por teclado. Los fallos muestran causa, evidencia y punto de reentrada recomendado. Las operaciones largas ofrecen cancelación y mantienen visible el último estado confirmado.

Las acciones peligrosas requieren confirmación contextual con comando, directorio, impacto y posibilidad de cancelación. El shell no oculta stdout/stderr ni reemplaza el diff por un resumen del agente.

## Project Structure

```text
desktop/src/index.html   → Shell, Projects, Editor y paneles visibles
desktop/src/main.js      → Estado, navegación y orquestación Tauri/sidecar
desktop/src/styles.css   → Temas, layout y estados visuales
desktop/src-tauri/       → Commands nativos, raíz del Project y PTY
src/                     → Dominio, casos de uso, adapters y sidecar
tests/                   → Tests de dominio, integración, contrato y UI
```

## Commands

El shell usa Tauri 2 y proporciona estos comandos desde la raíz del repositorio:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:package:app
```

La shell actual se verifica con `npm run build`, `npm test` (94 tests TypeScript), `cargo test --manifest-path desktop/src-tauri/Cargo.toml` (18 tests Rust), `npm run desktop:package:app` y smoke macOS; el smoke gráfico automatizado continúa pendiente.

El shell visual vive en `desktop/src/`. `project-snapshot.js` define el boundary de arranque y `project-context.js` conserva la fusión del Project activo. El comando Tauri `project_context` aporta contexto local y selecciona la raíz canónica. La UI no accede directamente a SQLite, Git ni procesos: Projects y ramas se obtienen mediante el sidecar y el cambio de raíz pasa por Tauri.

El read model de aplicación `ProjectSnapshot` compone el Project seleccionado, sus Tasks, el último evento de cada Task y las métricas `activeTasks`/`inReview`. La shell debe consumir este modelo y no consultar tablas de SQLite directamente.

La CLI expone el mismo contrato mediante `npm run ade -- project snapshot <project-id>`, usando `ADE_DB_PATH` para localizar la metadata. El sidecar también exige `ADE_DB_PATH`; la shell no debe depender del `cwd` para decidir dónde persistir. Esta salida es el seam de verificación; el transporte Tauri debe reutilizar el caso de uso, no parsear la salida humana de otros comandos.

## Code Style

La revisión se presenta de mayor a menor nivel de detalle: resumen semántico, impacto, findings, archivos, diff. El editor interno debe priorizar edición pragmática, legibilidad y trazabilidad de ruta; syntax highlighting, búsqueda y navegación pueden incorporarse de forma incremental. La shell incluye únicamente el completado pragmático de rutas de `cd` en la terminal; no incluye autocompletado general de comandos ni language server propio.

## Testing Strategy

Tests de componentes para estados de Task y gates; tests de integración para crear Project, crear/reanudar Task, observar ChangeSet y revisar; test end-to-end del flujo principal con adapters fake; smoke test del shell en el sistema operativo objetivo; y test de escape hatch para IDE/terminal.

La primera vertical de UI debe probar: abrir `Projects` → seleccionar fichero → editarlo y guardarlo dentro de ADE → crear Task → observar Implementer → consultar Review → reconciliar documentación → aprobar → preparar commit. No se exige editor completo, autocompletado general de comandos, language server ni colaboración realtime; el completado de rutas de `cd` forma parte del contrato de terminal.

## Boundaries

- **Always:** `Projects` primero; mantener visible el Project activo, estado Git/No Git, Task, agentes, gates y runtime; ofrecer escape hatch a IDE/terminal.
- **Ask first:** adoptar editor completo, soporte cloud, cuentas, sync o colaboración realtime.
- **Never:** abrir un fichero seleccionado automáticamente fuera de ADE; esconder operaciones peligrosas detrás de una acción ambigua; convertir la conversación en única representación del trabajo; duplicar el buscador del Explorer o forzar un cambio de branch que pueda descartar cambios locales.

## Success Criteria

Un usuario puede abrir un repositorio, crear una Task, observar la implementación, revisar el resumen y diff, consultar logs/tests y aprobar un commit sin abandonar ADE para el flujo normal.

## v0.1 decisions

- El shell es deliberadamente fino: presenta estado y orquesta casos de uso, pero no contiene un editor completo ni lógica de dominio duplicada.
- Tauri 2 es el framework adoptado para el MVP desktop tras el spike 003; el frontend se mantiene desacoplado del dominio y las capacidades nativas se restringen mediante permisos.
- La primera plataforma objetivo será macOS, por ser el entorno validado del proyecto; la abstracción debe dejar abierta la portabilidad posterior.
- El escape hatch mínimo abre la raíz del Project en Terminal mediante Tauri y permite configurar un comando externo de IDE; la integración profunda con IntelliJ/VS Code queda fuera.
- El spike 003 validó Tauri 2 en macOS y ADR-0009 registra la adopción. Una reevaluación futura sólo se hará si cambia el alcance o aparece evidencia de que Tauri incumple el contrato.

## Open Questions

- El transporte actual usa eventos Tauri para respuestas del sidecar y `terminal:output`; queda abierta una evolución a un event bus más rico si aumenta la concurrencia.
- Queda abierta una navegación especializada para observar varias Tasks simultáneas sin perder la Task activa; la shell actual mantiene una Task seleccionada compartida.

La evidencia de adopción está documentada en [003-desktop-framework](../spikes/003-desktop-framework.md#resultado) y [ADR-0009](../adr/0009-tauri-desktop-shell.md).

El transporte backend se investiga en [004-desktop-transport](../spikes/004-desktop-transport.md#recomendación-provisional); el sidecar implementa `project.snapshot`, `runtime.status` y las mutaciones acotadas `task.create`/`task.advance`. La ejecución del agente y el streaming de eventos siguen separados de este primer contrato de observabilidad.
