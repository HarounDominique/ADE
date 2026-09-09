# ADR-0026: Integrar Claude Code mediante un adapter CLI

## Status

Accepted; salida incremental ampliada por [ADR-0039](0039-agent-live-streaming.md)

## Date

2026-09-05

## Context

`Agents` ya podía seleccionar OpenCode y Codex, pero el usuario también utiliza Claude Code como agente local. La integración no debe acoplar la shell a la interfaz interactiva de la terminal ni copiar credenciales: debe conservar el contrato provider-neutral, permitir sesiones retomables y respetar los permisos concedidos para cada turno.

## Decision

Se añade `ClaudeCliRuntime` como adapter de `AgentRuntimePort`. ADE detecta `claude --version` —o el comando configurado en `ADE_CLAUDE_COMMAND`— y lo ofrece en el selector `Agents` como `Claude Code`.

Los prompts usan el modo no interactivo de Claude Code (`--print --output-format stream-json --verbose --include-partial-messages`; el CLI rechaza `stream-json` en modo `--print` sin `--verbose`) y cierran stdin. Las sesiones nuevas reciben un UUID con `--session-id`; el adapter captura el `session_id` emitido y las siguientes peticiones usan `--resume`. El resultado textual se extrae del evento final `result` y los `text_delta` públicos se entregan durante el turno, mientras los mensajes completos siguen persistidos únicamente en la metadata de ADE.

Los permisos se traducen a la CLI por turno: el modo base es `default` con `Read`, `Glob` y `Grep`; conceder escritura habilita `acceptEdits` y `Edit`/`Write`; `run_commands` habilita `Bash`; `network` habilita `WebFetch` y `WebSearch`. El modo `plan` no se usa para lectura porque puede sustituir silenciosamente un modelo de menor tier. ADE no guarda tokens, cabeceras ni credenciales del proveedor.

## Alternatives Considered

### Abrir Claude Code sólo como terminal PTY

Rechazado para `Agents`: conserva la experiencia interactiva, pero no ofrece transcript persistido, sesiones seleccionables ni integración de permisos y resultados con el workbench.

### Integrar un SDK o la API de Anthropic directamente

Rechazado en esta iteración: duplicaría autenticación y comportamiento de Claude Code, y convertiría ADE en responsable de credenciales y compatibilidad del proveedor.

### Mostrar Claude Code sólo como opción visual

Rechazado: una opción seleccionable sin runtime real produce una ruta de error confusa y contradice el contrato de disponibilidad del selector.

## Consequences

- `Agents` ofrece Claude Code junto a OpenCode y Codex sin cambiar la superficie conversacional.
- La disponibilidad depende de la instalación y autenticación local de Claude Code; si no está disponible, aparece deshabilitado con diagnóstico.
- La salida CLI se consume como JSONL y permite streaming de eventos públicos; la frontera de no exponer razonamiento privado queda fijada en [ADR-0039](0039-agent-live-streaming.md).
- Las skills pueden seleccionar Claude Code mediante el mismo contrato de runtime que los demás proveedores.
- Un smoke real con una cuenta Claude queda condicionado a la autenticación local y se mantiene como verificación manual.
