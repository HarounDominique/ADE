# Spec: Agent Providers

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-providers -->

## Objective

Permitir que ADE albergue agentes que el usuario ya puede utilizar, empezando por OpenCode y Codex, sin acoplar el workflow a un proveedor ni almacenar credenciales.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`.

## Project Structure

`src/ports/agent-runtime.ts` define capacidades; `src/adapters/` implementa proveedores; `src/application/` crea sesiones y asigna roles; `desktop/src/` muestra proveedor, sesión, permisos y estado.

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

La actividad de skills se persiste como evidencia acotada por Task y sesión, y se muestra en el detalle de la Task junto a ChangeSets, operaciones Git y sesiones. No persiste tokens ni prompts completos del proveedor.

## Availability and selection

Al iniciar el shell, ADE inspecciona el endpoint local de OpenCode y el mismo comando que usa el runner de Codex (por defecto, el binario incluido en ChatGPT para macOS o `ADE_CODEX_COMMAND`). El selector visual muestra todos los proveedores, deshabilita los que no están disponibles y deja visible su transporte, auth externa/local y capacidades. Una ejecución no se inicia contra un proveedor declarado no disponible.

## Success Criteria

ADE detecta proveedores disponibles, permite elegir uno para una Task y mantiene el workflow aunque cambie el adapter. La disponibilidad informada por el selector corresponde al runner que se ejecutará realmente.

## Open Questions

- ¿Qué proveedores entran en el paquete inicial?
- ¿Cómo mostrar el estado de una licencia sin duplicar el login?
