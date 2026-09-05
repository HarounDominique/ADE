# ADR-0026: Integrar Claude Code mediante un adapter CLI

## Status

Accepted

## Date

2026-09-05

## Context

`Agents` ya podía seleccionar OpenCode y Codex, pero el usuario también utiliza Claude Code como agente local. La integración no debe acoplar la shell a la interfaz interactiva de la terminal ni copiar credenciales: debe conservar el contrato provider-neutral, permitir sesiones retomables y respetar los permisos concedidos para cada turno.

## Decision

Se añade `ClaudeCliRuntime` como adapter de `AgentRuntimePort`. ADE detecta `claude --version` —o el comando configurado en `ADE_CLAUDE_COMMAND`— y lo ofrece en el selector `Agents` como `Claude Code`.

Los prompts usan el modo no interactivo de Claude Code (`--print --output-format json`) y cierran stdin. Las sesiones nuevas reciben un UUID con `--session-id`; el adapter captura el `session_id` emitido y las siguientes peticiones usan `--resume`. El resultado textual se extrae del campo JSON `result`, mientras los mensajes completos siguen persistidos únicamente en la metadata de ADE.

Los permisos se traducen a la CLI por turno: el modo base es `plan` con `Read`, `Glob` y `Grep`; conceder escritura habilita `acceptEdits` y `Edit`/`Write`; `run_commands` habilita `Bash`; `network` habilita `WebFetch` y `WebSearch`. ADE no guarda tokens, cabeceras ni credenciales del proveedor.

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
- La salida CLI JSON no proporciona streaming de eventos en esta primera integración; el transcript se actualiza al completar el turno.
- Las skills pueden seleccionar Claude Code mediante el mismo contrato de runtime que los demás proveedores.
- Un smoke real con una cuenta Claude queda condicionado a la autenticación local y se mantiene como verificación manual.
