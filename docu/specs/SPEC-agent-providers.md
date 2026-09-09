# Spec: Agent Providers

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-providers -->

## Objective

Permitir que ADE albergue agentes que el usuario ya puede utilizar, con OpenCode, Codex y Claude Code como adapters CLI/HTTP iniciales, sin acoplar el workflow a un proveedor ni almacenar credenciales.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`.

## Project Structure

`src/ports/agent-runtime.ts` define capacidades; `src/adapters/` implementa proveedores; `src/application/` crea sesiones y asigna roles; `desktop/src/` muestra proveedor, sesión, permisos, conversación y estado.

## Code Style

```ts
type ProviderDescriptor = { id: string; label: string; capabilities: readonly string[]; auth: "local" | "external" };
```

## Testing Strategy

Fakes por capacidad, contract tests por adapter, detección de binario/endpoint y errores de autenticación. Nunca se requiere una cuenta real para tests.

## Boundaries

- Always: usar `AgentRuntimePort`, mostrar proveedor activo y atribuir operaciones; persistir el identificador real de sesión, directorio, proveedor, Task y estado.
- Ask first: conceder por ejecución `write_code`, `run_commands` o `network`; `read_project` y `write_docs` se rigen por el alcance del Project.
- Never: copiar tokens a SQLite, logs, prompts persistidos o ChangeSets.

## Command resolution

Codex y Claude Code se localizan resolviendo candidatos en orden —variable de entorno, `PATH`, rutas de instalación conocidas y, para Codex en macOS, el binario de ChatGPT al final—, aceptando sólo el que exista y sea ejecutable por el proceso. Depender del `PATH` no basta: una aplicación abierta desde el escritorio hereda el `PATH` mínimo del sistema. Si ningún candidato sirve, el turno falla con el inventario de lo que se buscó y la variable con la que apuntar al binario, nunca con un `ENOENT` mudo.

## Usage and context pressure

Cada proveedor declara lo que sabe de su propio consumo mediante `ProviderPressure`: los tokens que la última petición dejó en la ventana de contexto —cache incluida, porque sigue ocupándola—, el tamaño de esa ventana cuando lo publica, y las ventanas de plan de sesión y semana con su porcentaje gastado. Codex las publica todas en `token_count`; Claude Code publica el consumo del turno pero no sus ventanas de plan en modo `--print`; OpenCode no publica ninguna. Lo que un proveedor no reporta se transmite ausente, y la shell lo muestra como desconocido en lugar de estimarlo. Véase [ADR-0041](../adr/0041-agent-pressure-dials.md).

## Session contract

OpenCode reanuda el `sessionId` HTTP almacenado. Codex inicia con `codex exec --json`, captura `thread_id` y lo retoma con `codex exec resume <thread_id>`. Claude Code inicia con `claude --print --output-format stream-json --include-partial-messages --session-id <uuid>`, captura `session_id` y lo retoma con `claude --print --output-format stream-json --include-partial-messages --resume <session_id>`. El shell muestra las sesiones de cada Task y permite elegir una para continuar una skill; una sesión no se declara reanudable hasta que el proveedor ha emitido su identificador real.

La actividad de skills se persiste como evidencia acotada por Task y sesión, y se muestra en el detalle de la Task junto a ChangeSets, operaciones Git y sesiones. Las conversaciones iniciadas desde `Agents` persisten mensajes de usuario y respuesta en `agent_messages`, vinculados a `agent_sessions`, para reanudar una sesión desde el mismo Project. No persiste tokens, credenciales ni cabeceras de autenticación.

## Agents surface

`Agents` es un workbench conversacional inline y transversal del shell: ocupa la vista principal de ADE y no abre un popup sobre otra vista. Su composición prioriza la conversación y mantiene dos zonas persistentes:

- **Sessions rail:** creación de sesión y lista de sesiones persistidas del Project activo, agrupada por Task/General. Cada conversación guardada ofrece una acción de borrado accesible que abre un diálogo modal con `Delete`/`Cancel`; al confirmarla se eliminan la sesión y sus mensajes persistidos, sin tocar código ni artefactos del repositorio.
- **Conversation thread:** una cabecera contextual compacta muestra provider, título, Task y estado, sin repetir la ruta ni el Project ya presentes en la barra global. El resto del espacio pertenece al transcript y al composer multilinea, con permisos por turno y estado `READY`/`WORKING`/`ERROR`.

La vista primaria no incluye un inspector lateral de actividad, ficheros modificados ni skills/tools: se elimina para que el transcript y el composer dispongan del espacio principal. Esa evidencia sigue perteneciendo a los registros persistidos de Task/runtime y podrá exponerse en superficies específicas sin saturar la conversación.

La superficie no expone razonamiento privado o cadena de pensamiento interna. Sólo muestra texto devuelto por el provider y actividad verificable: eventos explícitos, skills ejecutadas y cambios que el repositorio puede identificar. El historial se almacena en el fichero SQLite de metadatos del Project; el código y los artefactos siguen viviendo en el repositorio.

La cabecera de la conversación incluye un menú `Model`. El catálogo se deriva del provider activo: OpenCode ofrece `Provider default` hasta que su endpoint exponga descubrimiento de modelos; Codex ofrece `Provider default`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna` y `gpt-5.5`; Claude Code ofrece `Provider default`, `fable`, `opus`, `sonnet` y `haiku`. El catálogo lista aliases de cada CLI, no nombres completos de modelo: un alias resuelve al último modelo de su tier, de modo que la lista no envejece con cada versión publicada. `Provider default` no envía override y deja que el runtime aplique la configuración del usuario. Los aliases concretos se pueden rechazar por disponibilidad o licencia del proveedor y el error se muestra en el feedback del turno. Los aliases Codex heredados `gpt-5.4` y `gpt-5.4-mini` se migran al crear una sesión nueva a `gpt-5.6-terra` y `gpt-5.6-luna`, respectivamente; una sesión reanudada conserva su modelo.

El modelo elegido pertenece a la conversación y se persiste con ella hasta que se borra: `agent_sessions` guarda el alias y reanudar una conversación lo recupera, incluso tras reiniciar la aplicación.

Cada agente admite además un modelo por defecto, que se marca con una estrella en la fila correspondiente del menú `Model` y se guarda por provider en el almacenamiento local de la shell; `Provider default` no se puede marcar porque es la ausencia de override. Ese default sólo decide el punto de partida: una conversación nueva —y un cambio de agente dentro de una conversación que aún no tiene modelo propio— arranca en él, y en `Provider default` mientras no haya ninguno marcado. La conversación gana siempre: una que ya tiene modelo, `Provider default` incluido, conserva el suyo aunque el default se marque o cambie después, y marcar un default nunca reescribe la conversación abierta. Un alias que deje de pertenecer al catálogo del provider se descarta al leerlo. La decisión y su precedencia están registradas en [ADR-0034](../adr/0034-agent-default-model.md). La shell envía el campo del modelo en cada turno incluido vacío, porque el silencio y la elección explícita de `Provider default` son cosas distintas: sin esa distinción una conversación conservaría el modelo anterior al volver al valor por defecto.

Un flag del runtime no puede anular esa elección en silencio. Un turno de sólo lectura no se ejecuta como turno de planificación, porque el modo `plan` de Claude Code impone un tier mínimo de modelo y sustituye por su cuenta el alias pedido cuando queda por debajo. El carácter de sólo lectura lo impone la lista de herramientas permitidas, no el modo: una escritura no listada se deniega porque una ejecución no interactiva no puede pedir permiso.

El envío es explícito: el usuario escribe el prompt, selecciona un modelo compatible con el provider activo, elige permisos adicionales por ejecución (`write_code`, `write_docs`, `run_commands`, `network`) y pulsa `Send prompt`. Sin esos permisos el panel no concede capacidades sensibles por inferencia visual. `read_project` es el alcance base del contexto local. La selección se refresca al cambiar de provider o de conversación y nunca se envía como opción de otro provider. `Enter` envía el prompt, `Shift+Enter` inserta una línea y `↑`/`↓` recuperan los prompts de usuario guardados en la conversación activa —sin mezclar otras conversaciones del Project—; un único `Esc` detiene un turno en curso.

El prompt entra en la conversación al enviarlo, no al terminar el turno, y bajo él queda un turno en vuelo que informa de su estado: `Sending`, `Thinking`, `Responding` cuando llegan deltas de texto y acciones útiles que el proveedor reporta, con el tiempo transcurrido. El sidecar emite `agent.output` para los deltas de respuesta y `agent.activity` sólo para acciones públicas verificables —comandos, lectura/escritura de archivos, búsquedas y llamadas a herramientas—; descarta hitos internos como inicio de thread/turn, chunks de texto y errores transitorios sin contexto. Codex se consume como JSONL, Claude Code como `stream-json` y OpenCode mediante SSE. La superficie no expone razonamiento privado. El turno en vuelo vive en el estado de la shell, de modo que repintar el transcript lo reconstruye en lugar de perderlo, y se retira en sus cuatro salidas: completado, detenido, error de protocolo y fallo de envío.

Cada mensaje persistido, propio o del agente, se puede copiar. El control permanece discreto hasta que el puntero se acerca, pero es alcanzable por teclado. Copiar no se da por hecho: la API de portapapeles exige contexto seguro y un permiso que este webview no siempre concede y que puede quedarse colgada en lugar de rechazar, así que el intento está acotado y recae en una copia por selección; una copia que no ocurre se comunica en vez de fingirse. La detención no es cosmética: aborta el stream de OpenCode o el proceso CLI de Codex/Claude, marca la sesión reanudable como `STOPPED` y no persiste una sesión CLI pendiente. Las respuestas de Codex se obtienen del JSONL de `codex exec`; Claude Code devuelve deltas públicos y un evento final desde su modo `--print --output-format stream-json`; OpenCode se observa mediante su stream de eventos. La respuesta sólo se persiste al completar el turno; si un proveedor no devuelve texto legible, ADE conserva el estado y el error, pero no inventa una respuesta.

El workbench no incrusta la conversación que el usuario pueda tener abierta en ChatGPT/Codex Desktop: invoca el runtime local disponible y conserva el proveedor detrás del adapter. En macOS, Codex se detecta mediante el binario incluido en ChatGPT o `ADE_CODEX_COMMAND`, y Claude Code mediante `claude` o `ADE_CLAUDE_COMMAND`. Por ello la sesión persistente depende de que el proveedor emita un identificador real; una sesión Codex sólo queda reanudable tras capturar `thread_id` y una de Claude Code tras capturar `session_id`. El layout está preparado para añadir proveedores futuros sin cambiar el contrato de conversación ni sesiones.

Las ejecuciones Codex del sidecar son estrictamente no interactivas: ADE cierra el stdin del proceso después de entregar el prompt para que `codex exec --json` complete su respuesta JSONL y no quede esperando una segunda entrada. La terminal PTY mantiene el comportamiento contrario y conserva stdin abierto para TUIs interactivas.

Los permisos del composer se traducen a cada CLI: Codex usa `--sandbox read-only`/`workspace-write` y `--search`; Claude Code usa `--permission-mode default` por defecto, `acceptEdits` al conceder escritura y una lista explícita de tools (`Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash`, `WebFetch`, `WebSearch`) según el turno. `run_commands` no concede escritura por sí solo. La distinción entre editar código y documentación se conserva como permiso de ADE, aunque ambos CLIs aplican sus propias granularidades.

## Agent workbench

La [auditoría de ChatGPT Desktop](../knowledge/chatgpt-desktop-agents-audit.md) y el [ADR-0029](../adr/0029-chatgpt-inspired-agent-workbench.md) definen e implementan esta recuperación visual de sesiones, conservando el contrato de adaptadores, permisos, persistencia y borrado:

- El rail se limita estrictamente al Project activo y agrupa conversaciones por `Task`; las sesiones sin Task aparecen bajo `General`. Cada sesión persiste `projectId` y un título derivado del primer prompt para que el aislamiento no dependa sólo del layout. Nunca replica la agrupación por Project de ChatGPT porque ADE ya tiene `Projects` y topbar como contexto canónico.
- Las conversaciones se ordenan por última actividad dentro de cada grupo; los grupos son contraíbles, el grupo de la sesión activa no se oculta y el cambio de Project invalida resultados asíncronos anteriores.
- El rail completo de conversaciones se puede contraer para ceder ancho al thread. Su control de restauración permanece visible, actualiza `aria-expanded`, retira las sesiones del foco mientras está cerrado y usa una transición corta que se reduce bajo `prefers-reduced-motion`.
- La Task de contexto no se selecciona dentro del encabezado de Agents: pertenece a `Current task` en la topbar global, entre Project y branch. Ese selector se limita a 12 Tasks, prioriza la última creada y actualiza las superficies dependientes en tiempo real. Una conversación nueva hereda esa Task; una conversación guardada conserva su asociación original aunque el usuario cambie el contexto global.
- El thread conserva todo el ancho restante: no añade inspector derecho de Git, rama, commit, archivos modificados, actividad global o skills. El estado/evidencia verificable se puede adjuntar y contraer dentro del turno que lo produjo.
- Provider, modelo y Task viven en la cabecera contextual del thread; el composer queda limitado a redactar, permisos por turno y envío. La conversación conserva el provider con el que fue creada para reanudarla correctamente; cambiar de provider crea una conversación nueva asociable a la misma Task. Cambiar de modelo sólo afecta al siguiente turno del provider de la conversación. El textarea se redimensiona verticalmente dentro de un máximo proporcional a la ventana para no ocultar el transcript ni el botón de envío.
- ADE sigue sin revelar razonamiento privado ni sincronizar conversaciones remotas de ChatGPT/Codex Desktop.

## Availability and selection

Al iniciar el shell, ADE inspecciona el endpoint local de OpenCode, el mismo comando que usa el runner de Codex (por defecto, el binario incluido en ChatGPT para macOS o `ADE_CODEX_COMMAND`) y el comando `claude` (o `ADE_CLAUDE_COMMAND`). El selector visual muestra todos los proveedores, deshabilita los que no están disponibles y deja visible su transporte, auth externa/local y capacidades. Una ejecución no se inicia contra un proveedor declarado no disponible.

## Success Criteria

ADE detecta OpenCode, Codex y Claude Code cuando están disponibles, permite elegir uno para una Task o un prompt libre, mantiene el workflow aunque cambie el adapter y rehidrata sesiones por Project. La disponibilidad informada por el selector corresponde al runner que se ejecutará realmente.

## Open Questions

- ¿Qué proveedores adicionales entran después del paquete inicial de Codex CLI, Claude Code CLI y OpenCode HTTP?
- ¿Cómo mostrar el estado de una licencia sin duplicar el login?
