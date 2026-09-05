# Spec: Agent Providers

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-providers -->

## Objective

Permitir que ADE albergue agentes que el usuario ya puede utilizar, empezando por OpenCode y Codex, sin acoplar el workflow a un proveedor ni almacenar credenciales.

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

OpenCode reanuda el `sessionId` HTTP almacenado. Codex inicia con `codex exec --json`, captura `thread_id` y lo retoma con `codex exec resume <thread_id>`. El shell muestra las sesiones de cada Task y permite elegir una para continuar una skill; una sesión no se declara reanudable hasta que el proveedor ha emitido su identificador real.

La actividad de skills se persiste como evidencia acotada por Task y sesión, y se muestra en el detalle de la Task junto a ChangeSets, operaciones Git y sesiones. Las conversaciones iniciadas desde `Agents` persisten mensajes de usuario y respuesta en `agent_messages`, vinculados a `agent_sessions`, para reanudar una sesión desde el mismo Project. No persiste tokens, credenciales ni cabeceras de autenticación.

## Agents surface

`Agents` es la superficie conversacional transversal del shell. Permite seleccionar `Codex` u `OpenCode`, crear una sesión nueva o seleccionar una sesión persistida, enviar un prompt libre y ver el transcript asociado al Project activo y, opcionalmente, a la Task seleccionada. El flujo primario sólo muestra `Provider`, `Session`, transcript y `Send prompt`; permisos y skills se presentan como herramientas plegables para evitar competir con la conversación. El historial se almacena en el fichero SQLite de metadatos del Project; el código y los artefactos siguen viviendo en el repositorio.

El envío es explícito: el usuario escribe el prompt, elige permisos adicionales por ejecución (`write_code`, `write_docs`, `run_commands`, `network`) y pulsa `Send prompt`. Sin esos permisos el panel no concede capacidades sensibles por inferencia visual. `read_project` es el alcance base del contexto local. Las respuestas de Codex se obtienen del JSONL de `codex exec`; OpenCode se observa mediante su stream de eventos. Si un proveedor no devuelve texto legible, ADE conserva el estado y el error, pero no inventa una respuesta.

El menú no incrusta la conversación que el usuario pueda tener abierta en ChatGPT/Codex Desktop: invoca el runtime local disponible. En macOS, Codex se detecta mediante el binario incluido en ChatGPT o `ADE_CODEX_COMMAND`. Por ello la sesión persistente depende de que el proveedor emita un identificador real; una sesión Codex sólo queda reanudable tras capturar `thread_id`.

## Availability and selection

Al iniciar el shell, ADE inspecciona el endpoint local de OpenCode y el mismo comando que usa el runner de Codex (por defecto, el binario incluido en ChatGPT para macOS o `ADE_CODEX_COMMAND`). El selector visual muestra todos los proveedores, deshabilita los que no están disponibles y deja visible su transporte, auth externa/local y capacidades. Una ejecución no se inicia contra un proveedor declarado no disponible.

## Success Criteria

ADE detecta proveedores disponibles, permite elegir uno para una Task o un prompt libre, mantiene el workflow aunque cambie el adapter y rehidrata sesiones por Project. La disponibilidad informada por el selector corresponde al runner que se ejecutará realmente.

## Open Questions

- ¿Qué proveedores adicionales entran después del paquete inicial de Codex CLI y OpenCode HTTP?
- ¿Cómo mostrar el estado de una licencia sin duplicar el login?
