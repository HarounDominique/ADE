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

## Session contract

OpenCode reanuda el `sessionId` HTTP almacenado. Codex inicia con `codex exec --json`, captura `thread_id` y lo retoma con `codex exec resume <thread_id>`. Claude Code inicia con `claude --print --output-format json --session-id <uuid>`, captura `session_id` y lo retoma con `claude --print --resume <session_id>`. El shell muestra las sesiones de cada Task y permite elegir una para continuar una skill; una sesión no se declara reanudable hasta que el proveedor ha emitido su identificador real.

La actividad de skills se persiste como evidencia acotada por Task y sesión, y se muestra en el detalle de la Task junto a ChangeSets, operaciones Git y sesiones. Las conversaciones iniciadas desde `Agents` persisten mensajes de usuario y respuesta en `agent_messages`, vinculados a `agent_sessions`, para reanudar una sesión desde el mismo Project. No persiste tokens, credenciales ni cabeceras de autenticación.

## Agents surface

`Agents` es un workbench conversacional inline y transversal del shell: ocupa la vista principal de ADE y no abre un popup sobre otra vista. Su composición prioriza la conversación y mantiene dos zonas persistentes:

- **Sessions rail:** selector de provider (`Codex`, `OpenCode`, `Claude Code` y futuros adapters), creación de sesión y lista de sesiones persistidas del Project activo. Cada conversación guardada ofrece una acción de borrado accesible que abre un diálogo modal con `Delete`/`Cancel`; al confirmarla se eliminan la sesión y sus mensajes persistidos, sin tocar código ni artefactos del repositorio.
- **Conversation thread:** identidad de la sesión, Project/Task de contexto, transcript, composer multilinea, permisos para el turno y estado `READY`/`WORKING`/`ERROR`.

La vista primaria no incluye un inspector lateral de actividad, ficheros modificados ni skills/tools: se elimina para que el transcript y el composer dispongan del espacio principal. Esa evidencia sigue perteneciendo a los registros persistidos de Task/runtime y podrá exponerse en superficies específicas sin saturar la conversación.

La superficie no expone razonamiento privado o cadena de pensamiento interna. Sólo muestra texto devuelto por el provider y actividad verificable: eventos explícitos, skills ejecutadas y cambios que el repositorio puede identificar. El historial se almacena en el fichero SQLite de metadatos del Project; el código y los artefactos siguen viviendo en el repositorio.

El envío es explícito: el usuario escribe el prompt, elige permisos adicionales por ejecución (`write_code`, `write_docs`, `run_commands`, `network`) y pulsa `Send prompt`. Sin esos permisos el panel no concede capacidades sensibles por inferencia visual. `read_project` es el alcance base del contexto local. Las respuestas de Codex se obtienen del JSONL de `codex exec`; Claude Code devuelve un resultado JSON desde su modo `--print`; OpenCode se observa mediante su stream de eventos. Si un proveedor no devuelve texto legible, ADE conserva el estado y el error, pero no inventa una respuesta.

El workbench no incrusta la conversación que el usuario pueda tener abierta en ChatGPT/Codex Desktop: invoca el runtime local disponible y conserva el proveedor detrás del adapter. En macOS, Codex se detecta mediante el binario incluido en ChatGPT o `ADE_CODEX_COMMAND`, y Claude Code mediante `claude` o `ADE_CLAUDE_COMMAND`. Por ello la sesión persistente depende de que el proveedor emita un identificador real; una sesión Codex sólo queda reanudable tras capturar `thread_id` y una de Claude Code tras capturar `session_id`. El layout está preparado para añadir proveedores futuros sin cambiar el contrato de conversación ni sesiones.

Las ejecuciones Codex del sidecar son estrictamente no interactivas: ADE cierra el stdin del proceso después de entregar el prompt para que `codex exec --json` complete su respuesta JSONL y no quede esperando una segunda entrada. La terminal PTY mantiene el comportamiento contrario y conserva stdin abierto para TUIs interactivas.

Los permisos del composer se traducen a cada CLI: Codex usa `--sandbox read-only`/`workspace-write` y `--search`; Claude Code usa `--permission-mode plan` por defecto, `acceptEdits` al conceder escritura y una lista explícita de tools (`Read`, `Glob`, `Grep`, `Edit`, `Write`, `Bash`, `WebFetch`, `WebSearch`) según el turno. `run_commands` no concede escritura por sí solo. La distinción entre editar código y documentación se conserva como permiso de ADE, aunque ambos CLIs aplican sus propias granularidades.

## Availability and selection

Al iniciar el shell, ADE inspecciona el endpoint local de OpenCode, el mismo comando que usa el runner de Codex (por defecto, el binario incluido en ChatGPT para macOS o `ADE_CODEX_COMMAND`) y el comando `claude` (o `ADE_CLAUDE_COMMAND`). El selector visual muestra todos los proveedores, deshabilita los que no están disponibles y deja visible su transporte, auth externa/local y capacidades. Una ejecución no se inicia contra un proveedor declarado no disponible.

## Success Criteria

ADE detecta OpenCode, Codex y Claude Code cuando están disponibles, permite elegir uno para una Task o un prompt libre, mantiene el workflow aunque cambie el adapter y rehidrata sesiones por Project. La disponibilidad informada por el selector corresponde al runner que se ejecutará realmente.

## Open Questions

- ¿Qué proveedores adicionales entran después del paquete inicial de Codex CLI, Claude Code CLI y OpenCode HTTP?
- ¿Cómo mostrar el estado de una licencia sin duplicar el login?
