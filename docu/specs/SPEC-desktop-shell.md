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

Las cinco áreas visibles son `PROJECT`, `WORK`, `KNOWLEDGE`, `CHANGES` y `RUNTIME`. El Project Hub comunica rama, estado Git, Tasks, agentes, cambios, gates, revisiones y servicios. La pantalla de resultado debe permitir entender una Task antes de abrir el diff.

### Project Hub

Es la entrada por defecto. Presenta Project, raíz del repositorio, branch detectada, estado Git, servicios activos y Tasks recientes. Una Task muestra intención, modo, fase, última evidencia, gate bloqueante y acción siguiente.

### Sidebar and Explorer

El lateral combina una navegación etiquetada para `Overview`, `Tasks`, `Project context`, `Review queue` y `Local runtime` con el Explorer del Project. No se muestran simultáneamente dos menús que representen las mismas vistas. Un divisor vertical visible permite redimensionar el lateral por pointer o teclado, con límites de 190–720 px (acotados responsivamente al ancho de ventana) y ancho persistido por Project. El Explorer tiene dos estados:

- **Compacto:** cuando existe un archivo activo, muestra su rama de carpetas desde la raíz del Project hasta el archivo, ocultando hermanos no relevantes y manteniendo el contexto como un breadcrumb en formato árbol. Si todavía no hay archivo activo, muestra los hijos directos de la raíz.
- **Expandido:** al pulsar el control de expansión o una carpeta de la rama compacta, oculta las opciones de navegación y convierte el árbol en la superficie principal del lateral. Los hijos se cargan perezosamente y la rama seleccionada permanece resaltada.

El control de contraer restaura la navegación y reconstruye la rama compacta del archivo activo. La transición no cambia el Project ni la Task seleccionada.

El filtro del Explorer busca recursivamente por nombre y ruta, pero muestra como resultado directo el fichero coincidente, no la carpeta contenedora. Cada resultado incluye el nombre del fichero y una ruta relativa legible, adyacente y envolvente de sus carpetas padre para distinguir ficheros homónimos; la ruta no se trunca visualmente y el tooltip conserva la ruta completa. El input permanece responsivo mientras se construye el primer índice recursivo: las pulsaciones se agrupan con un debounce corto, las búsquedas obsoletas se ignoran y un spinner visible indica que aún no están listos los resultados actuales. El índice normalizado se reutiliza durante la sesión del Project para que las siguientes búsquedas sean filtrados locales ligeros. Al seleccionar un resultado, la consulta se limpia, se abre el fichero dentro de ADE y el Explorer vuelve a la rama breadcrumb compacta del archivo activo.

### Internal file viewer

Seleccionar un fichero de texto en el Explorer abre su contenido dentro del workbench, en un editor acotado, mostrando nombre, ruta relativa y estado de carga. El documento activo se mantiene sincronizado con la rama compacta del Explorer, permite `Save`, `Discard` y `⌘/Ctrl+S`, y no altera la Task ni el dock de terminal.

El visor trata binarios, ficheros ilegibles y previews demasiado grandes con estados explicativos. `Open externally` es una acción separada y explícita; seleccionar un fichero nunca debe lanzar automáticamente una aplicación del sistema. La lectura se solicita al backend Tauri y queda sometida a la autorización de la raíz del Project. El alcance completo está en [file-workspace](SPEC-file-workspace.md).

### Terminal dock

La terminal nativa ocupa un dock inferior redimensionable: el usuario puede aumentar o reducir su altura mediante un divisor visible. Presenta una única superficie de consola familiar, compuesta por un transcript PTY desplazable y una línea de prompt integrada. El shell conserva el cwd del Project, posee el eco y el prompt mínimos y la UI no añade una bienvenida ni repite la salida del proceso. El transcript interpreta ANSI para que el cursor, el borrado y la pantalla alternativa de una TUI como Claude se rendericen correctamente.

La interacción mínima es la esperada en una terminal: `Enter` ejecuta el comando, `↑`/`↓` recorren el historial y `cd <ruta>` admite completado de directorios con `Tab`. Cuando existen varias coincidencias, el dock muestra una lista de sugerencias accesible que puede recorrerse con `↑`/`↓`; `Esc` la cierra. El completado es deliberadamente acotado a rutas de `cd`, no sustituye un shell completo ni un language server.

### Work

Permite crear, reanudar y observar Tasks y sus conversaciones. La creación y las transiciones seguras atraviesan `task.create`/`task.advance` por el sidecar, exigen transición válida, razón y actor, y refrescan el Project Hub. Una Task en `READY`, `CHANGES_REQUESTED` o `BLOCKED` puede iniciar `task.run`; la shell recibe aceptación inmediata y eventos de Implementer, mientras el sidecar persiste la transición, diff y ChangeSet. La conversación es una vista auxiliar: la identidad, estado y resultado se leen del agregado Task y sus registros relacionados.

### Knowledge

Muestra documentos seleccionados, motivo de inclusión, clase (`canonical`, `operational`, `agent`) e impacto pendiente. Los documentos canónicos se abren para consulta mediante Tauri, limitado a `docu/specs`, y sus cambios pasan por la gate documental.

### Changes

Presenta resumen semántico, impacto, findings, archivos, diff, ChangeSets y checkpoints en ese orden. La primera slice selecciona la Task real del `ProjectSnapshot`, priorizando `UNDER_REVIEW` y `READY_FOR_HUMAN`, y muestra un estado vacío explícito si no existe. Las acciones de corregir, aceptar riesgo, descartar y re-review deben mostrar actor, razón y evidencia.

### Runtime

Muestra sesiones, servicios, procesos, puertos, healthchecks, terminal, stdout/stderr y tests. Expone `runtime.status` y `runtime.health` por el sidecar; Runtime puede comprobar OpenCode y presenta versión o `RUNTIME_UNAVAILABLE` como evidencia. También muestra por separado `sidecar: READY`, `agentRuntime`, Task activa, último evento y último error. `task.run` sólo acepta `READY`, `CHANGES_REQUESTED` o `BLOCKED`, emite `runtime.event`, `runtime.completed` o `runtime.failed`; si falla durante la ejecución, la Task queda en `BLOCKED`. La UI conserva hasta 12 eventos recientes con hora, tipo y Task, y refresca el Project Hub al finalizar. Un estado `RUNNING` debe provenir de evidencia de runtime, no de una inferencia visual; `DISCONNECTED` no implica fallo del proyecto ni ejecución cancelada.

## Interaction states

Toda vista relevante debe representar explícitamente `loading`, `ready`, `empty`, `blocked`, `failed` y `stale`. El Explorer añade estados `compact` y `expanded`; el botón de expansión expone `aria-expanded` y el foco por teclado. Los fallos muestran causa, evidencia y punto de reentrada recomendado. Las operaciones largas ofrecen cancelación y mantienen visible el último estado confirmado.

Las acciones peligrosas requieren confirmación contextual con comando, directorio, impacto y posibilidad de cancelación. El shell no oculta stdout/stderr ni reemplaza el diff por un resumen del agente.

## Project Structure

```text
src/ui/project/       → Project Hub
src/ui/work/          → Tasks, conversaciones y agentes
src/ui/knowledge/     → Documentos y skills
src/ui/changes/       → Resumen, diff, review y commit
src/ui/runtime/       → Servicios, terminal, tests y logs
tests/ui/              → Tests de flujos críticos
```

## Commands

El shell usa Tauri 2 y proporciona estos comandos desde la raíz del repositorio:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:package
```

La shell actual se verifica con `npm run build`, `npm test`, `npm run desktop:test` y smoke macOS; los flujos CLI descritos en las specs de runtime y governance siguen siendo el fallback operativo.

El shell visual inicial vive en `desktop/src/`. Su fixture `project-snapshot.js` define el boundary de datos y el comando Tauri `project_context` ya aporta contexto local de repositorio en modo solo lectura. La UI no accede directamente a SQLite, Git ni procesos.

El read model de aplicación `ProjectSnapshot` compone el Project seleccionado, sus Tasks, el último evento de cada Task y las métricas `activeTasks`/`inReview`. La shell debe consumir este modelo y no consultar tablas de SQLite directamente.

La CLI expone el mismo contrato mediante `npm run ade -- project snapshot <project-id>`, usando `ADE_DB_PATH` para localizar la metadata. El sidecar también exige `ADE_DB_PATH`; la shell no debe depender del `cwd` para decidir dónde persistir. Esta salida es el seam de verificación; el transporte Tauri debe reutilizar el caso de uso, no parsear la salida humana de otros comandos.

## Code Style

La revisión se presenta de mayor a menor nivel de detalle: resumen semántico, impacto, findings, archivos, diff. El editor interno debe priorizar edición pragmática, legibilidad y trazabilidad de ruta; syntax highlighting, búsqueda y navegación pueden incorporarse de forma incremental. La shell incluye únicamente el completado pragmático de rutas de `cd` en la terminal; no incluye autocompletado general de comandos ni language server propio.

## Testing Strategy

Tests de componentes para estados de Task y gates; tests de integración para crear Project, crear/reanudar Task, observar ChangeSet y revisar; test end-to-end del flujo principal con adapters fake; smoke test del shell en el sistema operativo objetivo; y test de escape hatch para IDE/terminal.

La primera vertical de UI debe probar: abrir Project → seleccionar fichero, editarlo y guardarlo dentro de ADE → crear Task → observar Implementer → consultar Review → reconciliar documentación → aprobar → preparar commit. No se exige editor completo, autocompletado general de comandos, language server ni colaboración realtime; el completado de rutas de `cd` forma parte del contrato de terminal.

## Boundaries

- **Always:** Project Hub primero; hacer visible estado Git, Task, agentes, gates y runtime; ofrecer escape hatch a IDE/terminal.
- **Ask first:** adoptar editor completo, soporte cloud, cuentas, sync o colaboración realtime.
- **Never:** abrir un fichero seleccionado automáticamente fuera de ADE; esconder operaciones peligrosas detrás de una acción ambigua; convertir la conversación en única representación del trabajo.

## Success Criteria

Un usuario puede abrir un repositorio, crear una Task, observar la implementación, revisar el resumen y diff, consultar logs/tests y aprobar un commit sin abandonar ADE para el flujo normal.

## v0.1 decisions

- El shell es deliberadamente fino: presenta estado y orquesta casos de uso, pero no contiene un editor completo ni lógica de dominio duplicada.
- Tauri 2 es el framework adoptado para el MVP desktop tras el spike 003; el frontend se mantiene desacoplado del dominio y las capacidades nativas se restringen mediante permisos.
- La primera plataforma objetivo será macOS, por ser el entorno validado del proyecto; la abstracción debe dejar abierta la portabilidad posterior.
- El escape hatch mínimo abre la raíz del Project en Terminal mediante Tauri y permite configurar un comando externo de IDE; la integración profunda con IntelliJ/VS Code queda fuera.
- El spike 003 validó Tauri 2 en macOS y ADR-0009 registra la adopción. Una reevaluación futura sólo se hará si cambia el alcance o aparece evidencia de que Tauri incumple el contrato.

## Open Questions

- ¿Qué mecanismo de eventos usa la UI: polling, SSE local o un event bus nativo?
- ¿Qué esquema de navegación permite observar varias Tasks sin perder el contexto de la activa?

La evidencia de adopción está documentada en [003-desktop-framework](../spikes/003-desktop-framework.md#resultado) y [ADR-0009](../adr/0009-tauri-desktop-shell.md).

El transporte backend se investiga en [004-desktop-transport](../spikes/004-desktop-transport.md#recomendación-provisional); el sidecar implementa `project.snapshot`, `runtime.status` y las mutaciones acotadas `task.create`/`task.advance`. La ejecución del agente y el streaming de eventos siguen separados de este primer contrato de observabilidad.
