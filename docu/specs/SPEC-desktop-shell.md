# Spec: Desktop Shell and Review UX

<!-- Nexus: SPEC-NEXUS.md | Module id: desktop-shell -->

## Objective

Ofrecer una superficie desktop centrada en proyectos, Tasks y agentes, con navegación por Knowledge y Version control, incorporando un editor interno de texto acotado sin construir todavía un editor completo. El runtime y los servicios son infraestructura transversal del shell, no una vista de navegación independiente.

## Shell contract

El shell es una vista local sobre los contratos de `project-task-workflow`, `development-workflow`, `agent-runtime`, `local-runtime` y `changes-review-governance`. No duplica su lógica ni permite mutar estado sin pasar por los casos de uso de aplicación.

El arranque debe:

1. Detectar o registrar un Project local.
2. Mostrar Tasks activas, fase, gates y estado Git.
3. Permitir crear o reanudar una Task.
4. Observar ejecución, logs, cambios y Review.
5. Exponer `approve` y `ship` sólo cuando las gates lo permitan.

El shell debe funcionar sin cloud y conservar la capacidad de abrir el repositorio en un IDE o terminal externo. La navegación principal debe ser una única superficie lateral etiquetada, sin duplicar una barra de iconos con otro menú de texto.

La shell no puede presentar controles decorativos o estados inventados. Indicadores de salud, notificaciones, identidad de operador, tareas de ejemplo o selectores aparentes sólo se muestran si tienen una fuente y una acción reales. El panel documental vive únicamente en `Project context`; `Git workspace` vive únicamente en `Version control`.

## Information architecture

Las áreas visibles son `PROJECTS`, `EDITOR`, `AGENTS`, `WORK`, `KNOWLEDGE` y `VERSION CONTROL`. `Projects` administra el catálogo local y el Project activo; `Editor` es la superficie de ficheros; `Agents` es la superficie conversacional para runtimes locales. `Version control` es la superficie Git operativa; el resumen de Project se mantiene deliberadamente compacto y el detalle de Tasks, revisiones y evidencia de runtime se consume desde sus superficies respectivas sin exponer un menú Runtime independiente.

### Projects

La entrada `Projects` es una pantalla de gestión deliberadamente mínima. Muestra únicamente el catálogo de Projects registrados, `Add project` (selector nativo de carpetas), el título del Project seleccionado y un resumen de cuatro métricas: `Active tasks`, `In review`, `Services` y `Last ship`. Cada fila muestra nombre, ruta y `Git`/`No Git`, permite activar el Project y ofrece `Remove from ADE`; la retirada elimina sólo el registro de seguimiento de la base local, nunca la carpeta ni sus ficheros. El Project activo no puede retirarse si es el único registrado; si existen otros, la retirada selecciona automáticamente el siguiente. La pantalla y el selector `Current project` de la topbar consumen el mismo catálogo persistido.

### Editor

`Editor` es una superficie fija y exclusiva para editar el fichero activo: muestra nombre, ruta relativa, estado dirty, `Save`, `Discard` y apertura externa explícita. Seleccionar un fichero en Explorer o encontrarlo mediante búsqueda activa esta vista automáticamente. Sin fichero activo conserva el editor vacío, listo para recibir la siguiente selección, sin CTA de búsqueda duplicada. Los paneles auxiliares de Git, agentes y documentación no se muestran en esta vista; la terminal nativa permanece como dock transversal. Cerrar el documento no abre aplicaciones externas ni cambia el Project.

### Git context bar

La topbar no duplica el buscador del Explorer. En su lugar presenta dos selectores persistentes y navegables, inspirados en los gestores Git de escritorio:

- `Current project` muestra el Project activo —Git o No Git— y abre los Projects locales previamente registrados, con nombre, ruta y tipo de control de versiones.
- `Current branch` muestra la rama activa y abre las ramas locales del Project Git activo, consultadas bajo demanda desde `git.workspace`; en un Project No Git muestra `No Git` y queda deshabilitado.

Seleccionar un Project cambia el contexto canónico de Tauri, refresca snapshot, árbol, Editor, branch, servicios, skills y estado Git, y conserva la selección de fichero sólo si sigue perteneciendo a la nueva raíz. El Project activo se mantiene como estado único del shell: cada refresh posterior de snapshot debe fusionarse sobre ese estado, nunca sobre el fixture inicial, para que nombre, ruta y tipo de control de versiones permanezcan sincronizados en topbar, breadcrumb, Projects, resumen del Project, Editor, terminal y paneles dependientes. Seleccionar una rama ejecuta `git switch` mediante el sidecar sólo si el Project es Git; no fuerza ni descarta cambios. Si Git rechaza la operación, se muestra el error y permanece visible el contexto anterior. Los menús deben exponer estados `loading`, `empty`, `failed` y `switching`, cerrar al seleccionar o pulsar fuera y ser navegables por teclado.

El Explorer mantiene el buscador como única búsqueda de ficheros. Una lupa accionable junto al título `Explorer` enfoca el filtro sin crear una segunda búsqueda.

### Project summary

El resumen operativo dentro de `Projects` no es una entrada separada ni un segundo workbench. Bajo el título del Project activo presenta sólo las cuatro métricas compactas del contrato: Tasks activas, Tasks en revisión, servicios activos/declarados y último envío. El detalle de Tasks, actividad, Git, agentes, servicios y evidencia vive en `Work`, `Changes` y en las superficies que consumen el runtime.

### Sidebar and Explorer

El lateral combina una navegación etiquetada para `Projects`, `Editor`, `Work`, `Knowledge` y `Changes` con el Explorer del Project. No se muestran simultáneamente dos menús que representen las mismas vistas. Un divisor vertical visible permite redimensionar el lateral por pointer o teclado, con límites de 190–720 px (acotados responsivamente para reservar al menos 580 px al workbench) y ancho persistido por Project. El Explorer tiene dos estados:

- **Compacto:** cuando existe un archivo activo, muestra su rama de carpetas desde la raíz del Project hasta el archivo, ocultando hermanos no relevantes y manteniendo el contexto como un breadcrumb en formato árbol. Si todavía no hay archivo activo, muestra los hijos directos de la raíz.
- **Expandido:** al pulsar el control de expansión o una carpeta de la rama compacta, oculta las opciones de navegación no activas y convierte el árbol en la superficie principal del lateral. La entrada de la vista activa permanece visible y seleccionada como ancla de contexto (`Agents`, `Version control`, etc.). Los hijos se cargan perezosamente y la rama seleccionada permanece resaltada.

El control de contraer restaura la navegación y reconstruye la rama compacta del archivo activo. La transición no cambia el Project ni la Task seleccionada.

El filtro del Explorer busca recursivamente por nombre y ruta, pero muestra como resultado directo el fichero coincidente, no la carpeta contenedora. Cada resultado incluye el nombre del fichero y una ruta relativa legible, adyacente y envolvente de sus carpetas padre para distinguir ficheros homónimos; la ruta no se trunca visualmente y el tooltip conserva la ruta completa. El input permanece responsivo mientras se construye el primer índice recursivo: las pulsaciones se agrupan con un debounce corto, las búsquedas obsoletas se ignoran y un spinner visible indica que aún no están listos los resultados actuales. El índice normalizado se reutiliza durante la sesión del Project para que las siguientes búsquedas sean filtrados locales ligeros. Al seleccionar un resultado, la consulta se limpia, se abre el fichero dentro de ADE y el Explorer vuelve a la rama breadcrumb compacta del archivo activo.

### Editor

Seleccionar un fichero de texto en el Explorer abre su contenido dentro del workbench, en un editor interno con motor seleccionable por lenguaje: CodeMirror para los paquetes oficiales de ADE y Monaco como fallback para lenguajes adicionales. El documento muestra nombre, ruta relativa, lenguaje detectado y estado de carga. El documento activo se mantiene sincronizado con la rama compacta del Explorer, permite resaltado sintáctico, navegación estructural básica, `Format` cuando el lenguaje tiene formatter aprobado, `Save`, `Discard` y `⌘/Ctrl+S`, y no altera la Task ni el dock de terminal.

El Editor trata binarios, ficheros ilegibles y previews demasiado grandes con estados explicativos. `Open externally` es una acción separada y explícita; seleccionar un fichero nunca debe lanzar automáticamente una aplicación del sistema. La lectura se solicita al backend Tauri y queda sometida a la autorización de la raíz del Project. CodeMirror cubre la ruta principal inmediatamente; Monaco, sus contribuciones y Prettier se dividen e importan bajo demanda al abrir un lenguaje fallback o solicitar `Format`. El alcance completo está en [file-workspace](SPEC-file-workspace.md#product-contract).

### Terminal dock

La terminal nativa ocupa un dock inferior redimensionable: el usuario puede aumentar o reducir su altura mediante un divisor visible. El dock presenta tabs de terminal y una acción explícita para crear una nueva sesión; cada tab representa un PTY independiente con transcript, cwd, historial y estado de completado propios. Cambiar de tab conserva la sesión anterior sin reiniciarla ni mezclar su salida. Cerrar un tab detiene únicamente su PTY y, si era el último, crea o conserva una sesión activa para que el dock nunca quede sin terminal.

Cada tab presenta una única superficie de consola familiar, renderizada por `xterm.js` y conectada directamente al PTY nativo. El shell conserva el cwd del Project, posee el eco y el prompt, y la UI no añade una bienvenida, eco duplicado ni campo de comandos. `Terminal.onData` reenvía cada secuencia de teclado sin transformación mediante `terminal_input`, por lo que Claude Code y cualquier otra TUI reciben directamente caracteres, flechas, espacio, Enter, Escape, Tab, borrado y controles `Ctrl`. `Terminal.onResize` sincroniza filas y columnas con `portable-pty` mediante `terminal_resize`; el addon `Fit` mantiene la superficie alineada al tamaño del dock. Así, la pantalla alternativa ANSI, el cursor, el borrado, los colores y los menús interactivos se comportan como en una terminal nativa.

El shell real conserva `Enter`, `↑`/`↓`, `Tab`, el completado, el historial y el resto de su comportamiento habitual; ADE no implementa una segunda capa de interpretación. El foco se recupera pulsando la superficie del terminal y cambiar de tab nunca reinicia ni mezcla sesiones. El completado de rutas lo proporciona el shell real, no ADE, y no se intenta sustituir un shell completo ni un language server.

### Work

Permite crear, reanudar y observar Tasks y sus conversaciones. La creación y las transiciones seguras atraviesan `task.create`/`task.advance` por el sidecar, exigen transición válida, razón y actor, y refrescan el resumen de `Projects`. Una Task en `READY`, `CHANGES_REQUESTED` o `BLOCKED` puede iniciar `task.run`; la shell recibe aceptación inmediata y eventos de Implementer, mientras el sidecar persiste la transición, diff y ChangeSet. La conversación es una vista auxiliar: la identidad, estado y resultado se leen del agregado Task y sus registros relacionados. Mientras se cargan no se sustituyen por fixtures; cuando no hay Tasks se muestra un estado vacío y cada Task real se abre mediante un botón nativo, con foco visible y etiqueta accesible.

### Agents

`Agents` es una vista inline tipo workbench, no un popup ni un diálogo superpuesto sobre el resto del shell. Su estructura fija se inspira en las superficies de agentes de IDEs actuales y separa claramente sesiones y conversación, conservando la evidencia fuera de la vista primaria:

- el rail izquierdo lista sesiones del Project activo, permite crear una nueva y seleccionar el provider disponible;
- el centro contiene la conversación, el estado de la sesión, el contexto Project/Task, el composer multilinea, los permisos del turno y `Send prompt`.

Las sesiones persistidas se pueden reanudar sin borrar historial. La vista primaria no muestra un inspector lateral de actividad, ficheros cambiados ni skills/tools; esos datos siguen persistidos como evidencia de Task/runtime y se reservan para superficies de detalle. `Permissions for this turn` y `Model` permanecen plegables junto al composer para mantener el prompt como acción primaria. El selector muestra el catálogo del provider activo —OpenCode, Codex o Claude Code—, incluye `Provider default` y transmite cualquier alias concreto al runtime; el valor se mantiene en memoria por conversación y vuelve al valor por defecto al rehidratarla. Las respuestas se almacenan como mensajes de sesión en SQLite local para que el workbench pueda reconstruirse tras reiniciar ADE. La superficie no afirma integrar el chat remoto de ChatGPT: usa los adapters locales detectados por ADE y muestra el fallo del provider cuando no está disponible. La arquitectura visual y el contrato de datos son provider-neutral para permitir runtimes futuros, sin acoplar la UI a GPT.

En Codex, los permisos seleccionados se traducen a `read-only` o `workspace-write`, y `network` activa la búsqueda web soportada por el CLI. `run_commands` no concede escritura por sí solo; la granularidad `write_code`/`write_docs` se conserva en el contrato de ADE aunque Codex sólo ofrezca el sandbox de workspace.

### Knowledge

Muestra documentos seleccionados, motivo de inclusión, clase (`canonical`, `operational`, `agent`) e impacto pendiente. Los documentos canónicos se abren para consulta mediante Tauri, limitado a `docu/specs`, y sus cambios pasan por la gate documental.

### Version control

Conserva el icono de control de versiones y sustituye la antigua cola de revisión. `Changes` es la tab inicial: presenta una columna compacta de working tree con filtro funcional, selección de fichero y recuento; el resto del ancho pertenece al diff del fichero activo, con líneas de contexto, añadidas, eliminadas y hunks resaltadas. `History` mantiene un filtro funcional de commits y una lectura en tres zonas: lista de commits, ficheros del commit seleccionado y diff dominante. Sus dos columnas auxiliares se pueden contraer de forma independiente para dedicar el ancho al diff; cada estado conserva una guía estrecha y un control accesible para restaurar el panel, y la preferencia se persiste localmente. Seleccionar commit o fichero actualiza la evidencia sin salir de la vista.

La cabecera persistente de la superficie concentra `Fetch origin`, `Push origin`, `Commit` y un estado remoto trazable. `Commit` abre un diálogo con título y cuerpo opcional y sólo crea el commit local; al completarse habilita `Push origin`, que publica la rama actual bajo confirmación explícita. `Fetch origin` actualiza las referencias remotas bajo confirmación explícita. Las acciones de Git menos frecuentes —estado, ramas, worktrees, GitHub y PR— viven en el disclosure `Repository actions` dentro de la misma superficie, no debajo de la terminal ni en las demás vistas. Las tabs implementan el patrón accesible completo: `aria-controls`, `aria-labelledby`, un único tab stop y navegación con `←`/`→`, Home y End. Mientras `Version control` está visible, `git.pending` se consulta periódicamente con actualización silenciosa para reflejar cambios hechos desde ADE, desde la terminal o desde otra aplicación, sin obligar a cambiar de vista ni pulsar Refresh; las respuestas de un Project anterior se descartan. Los estados `No Git`, `loading`, `empty`, `failed`, `fetching`, `committing` y `local commit ready to push` deben ser visibles; un fallo de push no oculta el commit si ya llegó a crearse.

La distribución y el flujo siguen el contrato de paridad operativa con GitHub Desktop definido en [ADR-0028](../adr/0028-github-desktop-version-control-parity.md) y detallado en la [auditoría de GitHub Desktop](../knowledge/github-desktop-audit.md). La paridad es de jerarquía y operación: no copia su identidad visual, no fuerza staging por línea y no anticipa comparación de ramas hasta que el backend aporte esos contratos.

### Runtime infrastructure

El runtime y los servicios son infraestructura transversal: sus sesiones, procesos, puertos, healthchecks, stdout/stderr y tests alimentan `Agents`, `Work`, la terminal y los estados del shell, pero no se exponen como una vista independiente del menú lateral. El sidecar conserva `runtime.status` y `runtime.health`; las operaciones de recuperación y servicios declarados siguen disponibles mediante los casos de uso correspondientes. `task.run` sólo acepta `READY`, `CHANGES_REQUESTED` o `BLOCKED`, emite `runtime.event`, `runtime.completed` o `runtime.failed`; si falla durante la ejecución, la Task queda en `BLOCKED`. La UI conserva hasta 12 eventos recientes con hora, tipo y Task y refresca el resumen de `Projects` al finalizar. Un estado `RUNNING` debe provenir de evidencia de runtime, no de una inferencia visual; `DISCONNECTED` no implica fallo del proyecto ni ejecución cancelada.

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

La shell actual se verifica con `npm run build`, `npm test` (112 tests TypeScript), `cargo test --manifest-path desktop/src-tauri/Cargo.toml` (18 tests Rust), `npm run desktop:package:app` y smoke macOS; el smoke gráfico automatizado continúa pendiente.

El shell visual vive en `desktop/src/`. `project-snapshot.js` define el boundary de arranque y `project-context.js` conserva la fusión del Project activo. El comando Tauri `project_context` aporta contexto local y selecciona la raíz canónica. La UI no accede directamente a SQLite, Git ni procesos: Projects y ramas se obtienen mediante el sidecar y el cambio de raíz pasa por Tauri.

El read model de aplicación `ProjectSnapshot` compone el Project seleccionado, sus Tasks, el último evento de cada Task y las métricas `activeTasks`/`inReview`. La shell debe consumir este modelo y no consultar tablas de SQLite directamente.

La CLI expone el mismo contrato mediante `npm run ade -- project snapshot <project-id>`, usando `ADE_DB_PATH` para localizar la metadata. En la shell Tauri, `ADE_DB_PATH` es un override opcional: si falta, el supervisor reutiliza una `.ade/ade.db` encontrada junto al bundle de desarrollo y, en una instalación independiente, usa el directorio de datos de la aplicación. Así el lanzamiento desde Finder no pierde el catálogo ni depende del `cwd`. Esta salida es el seam de verificación; el transporte Tauri debe reutilizar el caso de uso, no parsear la salida humana de otros comandos.

## Code Style

La revisión se presenta de mayor a menor nivel de detalle: resumen semántico, impacto, findings, archivos, diff. El editor interno debe priorizar edición pragmática, legibilidad y trazabilidad de ruta; usa CodeMirror y Monaco detrás de una interfaz común para ampliar la cobertura sintáctica sin alterar la experiencia. La shell incluye únicamente el completado pragmático de rutas de `cd` en la terminal; no incluye autocompletado general de comandos ni language server propio.

## Testing Strategy

Tests de componentes para estados de Task y gates; tests de integración para crear Project, crear/reanudar Task, observar ChangeSet y revisar; test end-to-end del flujo principal con adapters fake; smoke test del shell en el sistema operativo objetivo; y test de escape hatch para IDE/terminal.

La primera vertical de UI debe probar: abrir `Projects` → seleccionar fichero → editarlo y guardarlo dentro de ADE → crear Task → observar Implementer → consultar Version control → revisar historial o cambios pendientes → preparar commit. No se exige editor completo, autocompletado general de comandos, language server ni colaboración realtime; el completado de rutas de `cd` forma parte del contrato de terminal.

## Boundaries

- **Always:** `Projects` primero; mantener visible el Project activo, estado Git/No Git, Task y agentes; hacer accesibles gates y evidencia de runtime desde sus superficies consumidoras; ofrecer escape hatch a IDE/terminal.
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
