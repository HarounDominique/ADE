# ADR-0024: Agent surface in the desktop shell

## Status

Accepted — 2026-09-05

## Context

ADE ya detectaba OpenCode y Codex y podía ejecutar skills nativas, pero no ofrecía un lugar único para iniciar una conversación, revisar su salida o reanudar sesiones fuera del detalle de una Task. La integración disponible es con runtimes locales: no existe un contrato para incrustar automáticamente el chat remoto que el usuario pueda tener abierto en ChatGPT/Codex Desktop.

## Decision

Añadir `Agents` como área principal del shell. La pantalla contiene catálogo de sesiones por Project, selección de provider, transcript, composer de prompts, vínculo opcional con Task y permisos sensibles concedidos por ejecución. Las sesiones y mensajes se persisten en SQLite (`agent_sessions` y `agent_messages`). Codex usa `codex exec --json` y `codex exec resume`; OpenCode usa su adapter HTTP y stream de eventos.

El contrato sigue siendo provider-neutral: la UI sólo consume `AgentRuntimePort` y el sidecar. ADE no almacena credenciales ni tokens, y no presenta una sesión como reanudable hasta que el adapter devuelve un identificador real.

## Consequences

- Codex local queda disponible desde ADE con salida y reanudación, siempre que el binario y la licencia local estén disponibles.
- OpenCode puede mostrar eventos de salida; un provider que no emita texto legible conserva estado/error sin texto inventado.
- La UI puede rehidratar conversaciones del Project tras reiniciar.
- El menú no es todavía un puente directo al hilo remoto de este chat ni un gestor universal de permisos del proveedor; ambas capacidades quedan explícitamente fuera de esta iteración.

## Verification

`npm run build` y `npm test` verifican los métodos `agent.sessions`, `agent.messages` y `agent.prompt`, además de la persistencia ordenada de mensajes.
