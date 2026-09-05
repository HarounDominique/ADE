# ADR-0024: Agent surface in the desktop shell

## Status

Accepted — 2026-09-05

## Context

ADE ya detectaba OpenCode y Codex y podía ejecutar skills nativas, pero no ofrecía un lugar único para iniciar una conversación, revisar su salida o reanudar sesiones fuera del detalle de una Task. La integración disponible es con runtimes locales: no existe un contrato para incrustar automáticamente el chat remoto que el usuario pueda tener abierto en ChatGPT/Codex Desktop.

## Decision

Añadir `Agents` como workbench inline del shell, sin popup ni overlay. La pantalla contiene un rail de sesiones por Project, selección de provider, un hilo conversacional central, composer de prompts y vínculo opcional con Task. Las sesiones y mensajes se persisten en SQLite (`agent_sessions` y `agent_messages`). Codex usa `codex exec --json` y `codex exec resume`; OpenCode usa su adapter HTTP y stream de eventos.

La evidencia que ADE conserva se limita a datos emitidos por el runtime: estado de ejecución, eventos de herramientas, skills ejecutadas y cambios observables en Git. Esa evidencia no se muestra en un inspector dentro de la conversación primaria. ADE no muestra razonamiento privado del modelo. La UI mantiene el contrato provider-neutral para que futuros adapters —por ejemplo Claude— puedan reutilizar el mismo flujo.

El contrato sigue siendo provider-neutral: la UI sólo consume `AgentRuntimePort` y el sidecar. ADE no almacena credenciales ni tokens, y no presenta una sesión como reanudable hasta que el adapter devuelve un identificador real.

## Consequences

- Codex local queda disponible desde ADE con salida y reanudación, siempre que el binario y la licencia local estén disponibles.
- OpenCode puede mostrar eventos de salida; un provider que no emita texto legible conserva estado/error sin texto inventado.
- La UI puede rehidratar conversaciones del Project tras reiniciar.
- La vista primaria gana espacio horizontal al no incluir un inspector lateral de actividad, ficheros cambiados ni skills/tools; esa evidencia permanece en los registros de Task/runtime para futuras superficies de detalle.
- Codex se ejecuta en modo no interactivo con stdin cerrado tras enviar el prompt; la terminal PTY continúa siendo el canal de entrada para TUIs interactivas.
- El menú no es todavía un puente directo al hilo remoto de este chat ni un gestor universal de permisos del proveedor; ambas capacidades quedan explícitamente fuera de esta iteración.

## Verification

`npm run build` y `npm test` verifican los métodos `agent.sessions`, `agent.messages` y `agent.prompt`, además de la persistencia ordenada de mensajes.
