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

La shell no puede presentar controles decorativos o estados inventados. Indicadores de salud, notificaciones, identidad de operador, tareas de ejemplo o selectores aparentes sólo se muestran si tienen una fuente y una acción reales. El panel documental vive únicamente en `Context`; `Git workspace` vive únicamente en `Version control`.

## Information architecture

Las áreas visibles, en ese orden, son `PROJECTS`, `AGENTS`, `VERSION CONTROL`, `CONTEXT` y `EDITOR`: el orden recorre desde donde empieza el trabajo hasta donde se juzga, y deja el editor como salida. El orden es contrato, no un accidente del marcado. `Projects` administra el catálogo local, el Project activo y sus Tasks; `Editor` es la superficie de ficheros; `Agents` es la superficie conversacional para runtimes locales. `Version control` es la superficie Git operativa; el resumen de Project se mantiene deliberadamente compacto y el detalle de Tasks, revisiones y evidencia de runtime se consume desde sus superficies respectivas sin exponer un menú Runtime independiente.

### Projects

La entrada `Projects` es una pantalla de gestión deliberadamente mínima. Muestra únicamente el catálogo de Projects registrados, `Add project` (selector nativo de carpetas), el título del Project seleccionado y un resumen de cuatro métricas: `Active tasks`, `In review`, `Services` y `Last ship`. Cada fila muestra nombre, ruta y `Git`/`No Git`, permite activar el Project y ofrece `Remove from ADE`; la retirada elimina sólo el registro de seguimiento de la base local, nunca la carpeta ni sus ficheros. El Project activo no puede retirarse si es el único registrado; si existen otros, la retirada selecciona automáticamente el siguiente. La pantalla y el selector `Current project` de la topbar consumen el mismo catálogo persistido.

### Editor

`Editor` es una superficie fija y exclusiva para editar el fichero activo: muestra nombre, ruta relativa, estado dirty, `Save`, `Discard` y apertura externa explícita. Seleccionar un fichero en Explorer o encontrarlo mediante búsqueda activa esta vista automáticamente. Sin fichero activo conserva el editor vacío, listo para recibir la siguiente selección, sin CTA de búsqueda duplicada. Los paneles auxiliares de Git, agentes y documentación no se muestran en esta vista; la terminal nativa permanece como dock transversal. Cerrar el documento no abre aplicaciones externas ni cambia el Project.

### Git context bar

La topbar no duplica el buscador del Explorer ni repite la vista activa: no lleva breadcrumb, porque el lateral ya marca la selección y el propio selector nombra el Project. Presenta tres selectores persistentes y navegables, inspirados en los gestores Git de escritorio:

- `Current project` muestra el Project activo —Git o No Git— y abre los Projects locales previamente registrados, con nombre, ruta y tipo de control de versiones.
- `Current task` aparece entre Project y branch y representa la Task activa de todo ADE. Muestra como máximo 12 Tasks del Project activo, ordenadas por creación descendente; si la Task seleccionada ya no está entre esas 12, permanece disponible y visible para no perder contexto. Cada opción identifica intención, id y estado.
- `Current branch` muestra la rama activa y abre las ramas locales del Project Git activo, consultadas bajo demanda desde `git.workspace`; en un Project No Git muestra `No Git` y queda deshabilitado.

El control de arranque del Project —selector de configuración, `Run`, `Debug`, `Stop` y el puerto o URL de lo que está corriendo— ocupa el extremo opuesto de esa misma barra, porque arrancar la aplicación es contexto transversal y no pertenece a una sola vista. Usa el mismo menú desplegable que Project, Task y branch; `Debug` queda deshabilitado y explicado cuando la configuración no declara modo depuración, y el estado abre la URL local del servicio cuando está corriendo. Su contrato vive en [run-configurations](SPEC-run-configurations.md#product-contract).

Seleccionar un Project cambia el contexto canónico de Tauri, refresca snapshot, árbol, Editor, branch, servicios, skills y estado Git, y conserva la selección de fichero sólo si sigue perteneciendo a la nueva raíz. El Project activo se mantiene como estado único del shell: cada refresh posterior de snapshot debe fusionarse sobre ese estado, nunca sobre el fixture inicial, para que nombre, ruta y tipo de control de versiones permanezcan sincronizados en topbar, breadcrumb, Projects, resumen del Project, Editor, terminal y paneles dependientes. Seleccionar una Task actualiza inmediatamente las superficies dependientes —Work, Changes, gates y operaciones Git— y establece la asociación por defecto de una conversación nueva; nunca reasigna la Task de una conversación persistida ya existente. Sin Tasks, `Current task` permanece visible y abre un estado vacío explicativo. Seleccionar una rama ejecuta `git switch` mediante el sidecar sólo si el Project es Git; no fuerza ni descarta cambios. Si Git rechaza la operación, se muestra el error y permanece visible el contexto anterior. Los menús deben exponer estados `loading`, `empty`, `failed` y `switching`, cerrar al seleccionar o pulsar fuera y ser navegables por teclado.

El Explorer mantiene el buscador como única búsqueda de ficheros. Una lupa accionable junto al título `Explorer` enfoca el filtro sin crear una segunda búsqueda.

### Project summary

El resumen operativo dentro de `Projects` no es una entrada separada ni un segundo workbench. Bajo el título del Project activo presenta sólo las cuatro métricas compactas del contrato: Tasks activas, Tasks en revisión, servicios activos/declarados y último envío. El detalle de Tasks, actividad, Git, agentes, servicios y evidencia vive en `Work`, `Changes` y en las superficies que consumen el runtime.

### Sidebar and Explorer

El lateral combina esa navegación etiquetada con el Explorer del Project. No se muestran simultáneamente dos menús que representen las mismas vistas. Un divisor vertical visible permite redimensionar el lateral por pointer o teclado, con límites de 190–720 px (acotados responsivamente para reservar al menos 580 px al workbench) y ancho persistido por Project. El Explorer tiene dos estados:

- **Compacto:** cuando existe un archivo activo, muestra su rama de carpetas desde la raíz del Project hasta el archivo, ocultando hermanos no relevantes y manteniendo el contexto como un breadcrumb en formato árbol. Si todavía no hay archivo activo, muestra los hijos directos de la raíz.
- **Expandido:** al pulsar el control de expansión o una carpeta de la rama compacta, oculta las opciones de navegación no activas y convierte el árbol en la superficie principal del lateral. La entrada de la vista activa permanece visible y seleccionada como ancla de contexto (`Agents`, `Version control`, etc.). Los hijos se cargan perezosamente y la rama seleccionada permanece resaltada.

El control de contraer restaura la navegación y reconstruye la rama compacta del archivo activo. La transición no cambia el Project ni la Task seleccionada.

Un fichero del árbol nombra qué es cuando el puntero descansa sobre él: pasado 1,5 s aparece un tooltip propio de la shell con el nombre del fichero y su extensión, nunca la ruta, que el árbol ya muestra. El tooltip nativo no admite retardo y ya cargaba el estado Git de la fila, así que ese estado pasa a una segunda línea del mismo tooltip y el atributo queda aparcado mientras el puntero descansa, para no mostrar dos tooltips superpuestos. Salir de la fila, pulsar, hacer scroll o perder el foco de la ventana termina la espera; el nombre accesible de la fila no cambia y el puntero táctil no espera nada.

El filtro del Explorer busca recursivamente por nombre y ruta, pero muestra como resultado directo el fichero coincidente, no la carpeta contenedora. Cada resultado incluye el nombre del fichero y una ruta relativa legible, adyacente y envolvente de sus carpetas padre para distinguir ficheros homónimos; la ruta no se trunca visualmente y el tooltip conserva la ruta completa. El input permanece responsivo mientras se construye el primer índice recursivo: las pulsaciones se agrupan con un debounce corto, las búsquedas obsoletas se ignoran y un spinner visible indica que aún no están listos los resultados actuales. El índice normalizado se reutiliza durante la sesión del Project para que las siguientes búsquedas sean filtrados locales ligeros. Al seleccionar un resultado, la consulta se limpia, se abre el fichero dentro de ADE y el Explorer vuelve a la rama breadcrumb compacta del archivo activo.

### Editor

Seleccionar un fichero de texto en el Explorer abre su contenido dentro del workbench, en un editor interno con motor seleccionable por lenguaje: CodeMirror para los paquetes oficiales de ADE y Monaco como fallback para lenguajes adicionales. El documento muestra nombre, ruta relativa, lenguaje detectado y estado de carga. El documento activo se mantiene sincronizado con la rama compacta del Explorer, permite resaltado sintáctico, navegación estructural básica, `Format` cuando el lenguaje tiene formatter aprobado, `Save`, `Discard` y `⌘/Ctrl+S`, y no altera la Task ni el dock de terminal.

El Editor trata binarios, ficheros ilegibles y previews demasiado grandes con estados explicativos. `Open externally` es una acción separada y explícita; seleccionar un fichero nunca debe lanzar automáticamente una aplicación del sistema. La lectura se solicita al backend Tauri y queda sometida a la autorización de la raíz del Project. CodeMirror cubre la ruta principal inmediatamente; Monaco, sus contribuciones y Prettier se dividen e importan bajo demanda al abrir un lenguaje fallback o solicitar `Format`. El alcance completo está en [file-workspace](SPEC-file-workspace.md#product-contract).

### Terminal dock

La terminal nativa ocupa un dock inferior redimensionable: el usuario puede aumentar o reducir su altura mediante un divisor visible. Un botón de chevron sin borde, centrado justo debajo de ese divisor, alterna por click entre los límites mínimo y máximo existentes con una transición corta de salida suave; su dirección, etiqueta accesible y tooltip describen siempre la siguiente acción. El control no altera los límites ni sustituye el resize fino por pointer o teclado, que permanece inmediato, y respeta `prefers-reduced-motion`. El dock presenta tabs de terminal y una acción explícita para crear una nueva sesión; cada tab representa un PTY independiente con transcript, cwd, historial y estado de completado propios. Cambiar de tab conserva la sesión anterior sin reiniciarla ni mezclar su salida. Cerrar un tab detiene únicamente su PTY y, si era el último, crea o conserva una sesión activa para que el dock nunca quede sin terminal.

Cada tab presenta una única superficie de consola familiar, renderizada por `xterm.js` y conectada directamente al PTY nativo. El shell conserva el cwd del Project, posee el eco y el prompt, y la UI no añade una bienvenida, eco duplicado ni campo de comandos. `Terminal.onData` reenvía cada secuencia de teclado sin transformación mediante `terminal_input`, por lo que Claude Code y cualquier otra TUI reciben directamente caracteres, flechas, espacio, Enter, Escape, Tab, borrado y controles `Ctrl`. `Terminal.onResize` sincroniza filas y columnas con `portable-pty` mediante `terminal_resize`; el addon `Fit` mantiene la superficie alineada al tamaño del dock. Así, la pantalla alternativa ANSI, el cursor, el borrado, los colores y los menús interactivos se comportan como en una terminal nativa.

El shell real conserva `Enter`, `↑`/`↓`, `Tab`, el completado, el historial y el resto de su comportamiento habitual; ADE no implementa una segunda capa de interpretación. El foco se recupera pulsando la superficie del terminal y cambiar de tab nunca reinicia ni mezcla sesiones. El completado de rutas lo proporciona el shell real, no ADE, y no se intenta sustituir un shell completo ni un language server.

Junto a la acción de nueva sesión, un botón abre el historial de las terminales que ejecutaron un agente. El dock no gana un panel permanente: es un popup, y su contrato —qué terminal se guarda, cómo se retoma su conversación y cómo se borra— pertenece a [SPEC-agent-terminal-history](SPEC-agent-terminal-history.md#historial-y-ui). El dock sólo aporta la superficie: abrir una entrada crea un tab de terminal normal, con el mismo PTY, resize y ciclo de vida que cualquier otro.

### Tasks dentro de Projects

Una Task no existe fuera de un Project, así que ambos viven en la misma vista y `Tasks` no ocupa una entrada de navegación propia. `Projects` es un maestro-detalle: a la izquierda el catálogo —estrecho, sin métricas por fila, con `Add project` en su cabecera— y a la derecha el Project activo con su ruta, una línea de contexto con recuentos reales y la lista de sus Tasks, que es el foco de la pantalla.

El catálogo es navegación, no contenido: la topbar ya ofrece el mismo cambio de Project, de modo que la columna no compite en ancho con el trabajo. Seleccionar un Project en la lista es cambiar el Project activo del shell, y seleccionar una Task es fijar `Current task`; ninguna de las dos introduce una selección paralela a la de la topbar, que seguiría siendo una segunda fuente de verdad.

Cada Task se presenta como una fila con id, intención, estado y su transición primaria, y despliega su evidencia en el sitio —gates, ChangeSet, traza Git, sesiones de agente y actividad persistida— con `aria-expanded` y `aria-controls`, empujando las filas siguientes. La Task activa permanece activa aunque se colapse su evidencia. La creación y las transiciones seguras atraviesan `task.create`/`task.advance` por el sidecar, exigen transición válida, razón y actor.

Los recuentos del Project se muestran como una línea de contexto, no como una rejilla de tarjetas con variaciones inventadas: el contrato de la shell prohíbe estados sin fuente real, y las Tasks son el contenido que debe dominar la superficie.

### Agents

`Agents` es una vista inline tipo workbench, no un popup ni un diálogo superpuesto sobre el resto del shell. Su estructura fija se inspira en las superficies de agentes de IDEs actuales y separa claramente sesiones y conversación, conservando la evidencia fuera de la vista primaria:

- el rail izquierdo lista sesiones del Project activo, permite crear una nueva y seleccionar el provider disponible, y cierra con tres diales de presión —sesión, semana y contexto— que muestran el porcentaje al pasar el puntero o al recibir foco;
- el centro contiene la conversación, el estado de la sesión, el contexto Project/Task, el composer multilinea, los permisos del turno y `Send prompt`.

Los diales dicen lo que queda y sólo cuando el proveedor lo reporta: Codex publica sus dos ventanas de plan y el tamaño de su ventana de contexto en `token_count`; Claude Code sólo publica sus ventanas de plan a su status line interactiva, de modo que en modo `--print` sus diales de sesión y semana quedan explícitamente desconocidos mientras el de contexto funciona; OpenCode no reporta ninguno. Un dato no reportado se dibuja como desconocido, nunca como cero ni como una estimación. Las ventanas de plan pertenecen a la cuenta y persisten entre conversaciones y reinicios; el contexto pertenece a la conversación. Un turno vivo actualiza los diales sin esperar a terminar. El contrato está en [ADR-0041](../adr/0041-agent-pressure-dials.md).

Un turno que termina emite un tono corto, tanto si se completó como si falló; no suena cuando el operador lo detuvo, porque estaba delante. Está encendido por defecto, se silencia desde la cabecera de la conversación y la preferencia es del operador, no del Project. El aviso remoto —correo o webhook— queda congelado con su diseño registrado en [ADR-0046](../adr/0046-turn-chime-and-frozen-remote-notice.md).

Las sesiones persistidas se pueden reanudar sin borrar historial. La vista primaria no muestra un inspector lateral de actividad, ficheros cambiados ni skills/tools; esos datos siguen persistidos como evidencia de Task/runtime y se reservan para superficies de detalle. `Permissions for this turn` permanece plegable junto al composer para mantener el prompt como acción primaria, mientras `Agent` y `Model` viven en la cabecera de la conversación como contexto estable. Ambos usan el mismo menú desplegable que la topbar aplica a Project, Task y branch —botón con etiqueta y valor, menú propio con la marca de selección— en lugar de un `select` nativo, cuyo chrome lo pintaba la plataforma y no el tema. El menú `Model` muestra el catálogo del provider activo —OpenCode, Codex o Claude Code—, incluye `Provider default`, transmite cualquier alias concreto al runtime y permite marcar con una estrella el modelo por defecto de ese agente; el valor elegido pertenece a la conversación y se recupera al rehidratarla, y el default sólo decide en qué modelo arranca una conversación nueva. Las respuestas se almacenan como mensajes de sesión en SQLite local para que el workbench pueda reconstruirse tras reiniciar ADE. El composer toma esos mensajes de usuario como historial de la conversación: `↑`/`↓` los recorre sólo cuando el cursor está al comienzo/final del textarea, conserva un borrador al volver hacia abajo y nunca mezcla prompts de otra conversación. La superficie no afirma integrar el chat remoto de ChatGPT: usa los adapters locales detectados por ADE y muestra el fallo del provider cuando no está disponible. La arquitectura visual y el contrato de datos son provider-neutral para permitir runtimes futuros, sin acoplar la UI a GPT.

En Codex, los permisos seleccionados se traducen a `read-only` o `workspace-write`, y `network` activa la búsqueda web soportada por el CLI. `run_commands` no concede escritura por sí solo; la granularidad `write_code`/`write_docs` se conserva en el contrato de ADE aunque Codex sólo ofrezca el sandbox de workspace.

El rail agrupa conversaciones por Task y `General` dentro del Project activo, la conversación ocupa todo el ancho restante y los estados observables se adjuntan al turno correspondiente. La sesión persiste Project, Task opcional, provider y título; el sidecar rechaza lectura o borrado desde otro Project y la UI descarta respuestas de prompts que pertenezcan a un contexto ya reemplazado. El selector global de Project/branch conserva su responsabilidad; Agents no vuelve a mostrar conversaciones de otros Projects ni un inspector de Git/commit/rama. [ADR-0029](../adr/0029-chatgpt-inspired-agent-workbench.md) conserva la decisión.

### Knowledge

Muestra documentos seleccionados, motivo de inclusión, clase (`canonical`, `operational`, `agent`) e impacto pendiente. Los documentos canónicos se abren para consulta mediante Tauri, limitado a `docu/specs`, y sus cambios pasan por la gate documental.

### Version control

Conserva el icono de control de versiones y sustituye la antigua cola de revisión. `Changes` es la tab inicial: presenta una columna compacta de working tree con filtro funcional, selección de fichero y recuento; cada fila nombra primero el fichero con su extensión y deja la carpeta como contexto secundario, de modo que al faltar ancho se trunca la ruta y nunca el nombre, con la ruta relativa completa disponible en el tooltip; el resto del ancho pertenece al diff del fichero activo, con líneas de contexto, añadidas, eliminadas y hunks resaltadas. `History` mantiene un filtro funcional de commits y una lectura en tres zonas: lista de commits, ficheros del commit seleccionado y diff dominante. Sus dos columnas auxiliares se pueden contraer de forma independiente para dedicar el ancho al diff; cada estado conserva una guía estrecha y un control accesible para restaurar el panel, y la preferencia se persiste localmente. La contracción/expansión combina una transición de layout breve con fundido y desplazamiento mínimo del panel oculto; `prefers-reduced-motion` la reduce a un cambio inmediato. Seleccionar commit o fichero actualiza la evidencia sin salir de la vista.

La cabecera persistente de la superficie concentra `Fetch origin`, `Push origin`, `Commit` y un estado remoto trazable. `Commit` abre un diálogo con título y cuerpo opcional y sólo crea el commit local; `Push origin` publica la rama actual y `Fetch origin` actualiza las referencias remotas, ambas como acciones directas sin un segundo diálogo. `Push origin` está habilitado siempre que el repositorio tenga commits que el remoto no ha visto, con independencia de si los creó ADE en esta sesión. Las acciones de Git menos frecuentes —estado, ramas, worktrees, GitHub y PR— viven en el disclosure `Repository actions` dentro de la misma superficie, no debajo de la terminal ni en las demás vistas. Las tabs implementan el patrón accesible completo: `aria-controls`, `aria-labelledby`, un único tab stop y navegación con `←`/`→`, Home y End. Mientras `Version control` está visible, `git.pending` se consulta periódicamente con actualización silenciosa para reflejar cambios hechos desde ADE, desde la terminal o desde otra aplicación, sin obligar a cambiar de vista ni pulsar Refresh; las respuestas de un Project anterior se descartan. Los estados `No Git`, `loading`, `empty`, `failed`, `fetching`, `committing` y `local commit ready to push` deben ser visibles; un fallo de push no oculta el commit si ya llegó a crearse. El estado remoto compone las dos deudas del repositorio —commits pendientes de empujar y cambios locales sin commitear— en lugar de dejar que una tape a la otra, y `History` distingue cada commit que el remoto no ha visto. En `Changes` la composición es un split de dos paneles sin tracks implícitos; sus columnas y las de `History` se colapsan con el mismo control: icono, posición al final de la cabecera, comportamiento y animación idénticos, sin que la superficie de `Changes` degrade ese control a una fila propia. El diff conserva color y espacios, reenvuelve líneas largas y recalcula su ancho útil en tiempo real al cambiar las columnas.

La distribución y el flujo siguen el contrato de paridad operativa con GitHub Desktop definido en [ADR-0028](../adr/0028-github-desktop-version-control-parity.md) y detallado en la [auditoría de GitHub Desktop](../knowledge/github-desktop-audit.md). La paridad es de jerarquía y operación: no copia su identidad visual, no fuerza staging por línea y no anticipa comparación de ramas hasta que el backend aporte esos contratos.

### Runtime infrastructure

El runtime y los servicios son infraestructura transversal: sus sesiones, procesos, puertos, healthchecks, stdout/stderr y tests alimentan `Agents`, `Work`, la terminal y los estados del shell, pero no se exponen como una vista independiente del menú lateral. El sidecar conserva `runtime.status` y `runtime.health`; las operaciones de recuperación y servicios declarados siguen disponibles mediante los casos de uso correspondientes. `task.run` sólo acepta `READY`, `CHANGES_REQUESTED` o `BLOCKED`, emite `runtime.event`, `runtime.completed` o `runtime.failed`; si falla durante la ejecución, la Task queda en `BLOCKED`. La UI conserva hasta 12 eventos recientes con hora, tipo y Task y refresca el resumen de `Projects` al finalizar. Un estado `RUNNING` debe provenir de evidencia de runtime, no de una inferencia visual; `DISCONNECTED` no implica fallo del proyecto ni ejecución cancelada.

## Interaction states

Toda vista relevante debe representar explícitamente `loading`, `ready`, `empty`, `blocked`, `failed` y `stale`. El Explorer añade estados `compact` y `expanded`; el botón de expansión expone `aria-expanded` y el foco por teclado. Los fallos muestran causa, evidencia y punto de reentrada recomendado. Las operaciones largas ofrecen cancelación y mantienen visible el último estado confirmado.

Las acciones peligrosas requieren confirmación contextual con comando, directorio, impacto y posibilidad de cancelación. El shell no oculta stdout/stderr ni reemplaza el diff por un resumen del agente.

Esa confirmación se resuelve siempre con un diálogo propio de la shell —modal, con título, consecuencia descrita, etiqueta de acción propia y cancelación—, nunca con `window.confirm` ni `window.prompt`: el webview no los responde, de modo que un botón apoyado en ellos queda inerte y la acción resulta imposible. Por el mismo motivo, cualquier dato que la acción necesite se pide con campos reales en un diálogo. Retirar un Project del seguimiento, descartar cambios sin guardar, cerrar un documento sucio, crear un worktree y las operaciones Git de `Repository actions` usan esta superficie. Una acción cuya intención ya es explícita e inequívoca —un botón habilitado sólo cuando la operación es posible— no añade un segundo diálogo.

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

La shell actual se verifica con `npm run build`, `npm test` (246 tests TypeScript), `cargo test --manifest-path desktop/src-tauri/Cargo.toml` (20 tests Rust), `npm run desktop:package:app` y smoke macOS; el smoke gráfico automatizado continúa pendiente. Esa misma secuencia se ejecuta por matriz en macOS, Windows y Linux según [SPEC-cross-platform-support](SPEC-cross-platform-support.md#verification-strategy); macOS es hoy la única plataforma verificada.

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

El transporte backend se investiga en [004-desktop-transport](../spikes/004-desktop-transport.md#recomendación-provisional); el sidecar implementa `project.snapshot`, `runtime.status`, las mutaciones acotadas `task.create`/`task.advance` y los eventos de Agents `agent.output`/`agent.activity`. La ejecución del agente permanece detrás del runtime y la shell sólo consume el protocolo normalizado.
