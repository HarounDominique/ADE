# Spec: Agent Runtime

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-runtime -->

## Objective

Ejecutar implementaciones y revisiones mediante runtimes intercambiables, empezando por OpenCode, sin acoplar el dominio a sus internals.

## Responsibilities

- **Implementer:** investiga y modifica el repositorio dentro de permisos explícitos.
- **Reviewer:** evalúa intención, requisitos, documentación relevante, diff y evidencia con contexto fresco.
- **Runtime adapter:** traduce sesiones, eventos, cancelación, modelos, tools, MCP y permisos del proveedor al contrato de ADE.

Una conversación puede continuar, renombrarse, resumirse, bifurcarse, archivarse, cambiar de modelo, convertirse en Task o iniciar un reviewer sin que ADE pierda la identidad de la Task.

## Tech Stack

`OpenCodeHttpRuntime` es la implementación inicial de `AgentRuntimePort`, mediante HTTP local y streaming SSE. El dominio y la aplicación no importan tipos de OpenCode. La versión validada en el spike es OpenCode `1.18.26`; la URL se configura con `OPENCODE_URL` y por defecto es `http://127.0.0.1:4096`.

## Commands

```bash
npm install
npm run build
npm test
npm run dev -- /ruta/al/repositorio "Inspect the repository and report its current state without editing files."
npm run review -- /ruta/al/repositorio "Describe the task"
```

Con OpenCode sirviendo localmente: `opencode serve --hostname 127.0.0.1 --port 4096`. El adapter expone una API reproducible para health, crear sesión, enviar una Task, solicitar salida JSON estructurada, recibir streaming SSE, cancelar y obtener diff. El smoke test real está documentado en [Spike 001](../spikes/001-opencode-runtime.md#smoke-test-real) y la revisión independiente en [Spike 002](../spikes/002-independent-review.md#implementacion).

## Runtime contract

`AgentRuntimePort` ofrece las siguientes capacidades:

- `health`: comprueba disponibilidad sin iniciar una Task.
- `createSession`: crea una sesión aislada por `directory` y devuelve un handle estable.
- `prompt`: envía trabajo asíncrono al Implementer.
- `promptAndWait`: envía una petición que debe devolver una respuesta estructurada según un JSON Schema; se usa para el Reviewer.
- `events`: expone eventos SSE hasta cierre, cancelación o `session.idle` consumido por la aplicación.
- `diff`: obtiene el cambio que el runtime atribuye a la sesión.
- `abort`: solicita cancelación explícita de la sesión.

El puerto no garantiza semántica de negocio: no decide si una Task está terminada, no aprueba findings y no persiste secretos. La aplicación coordina eventos, timeout/cancelación, ChangeSet y Review; el adapter traduce errores HTTP, headers de directorio, formato de mensajes y SSE.

Cada sesión debe conservar `id` y `directory`. El `directory` se envía en cada operación que dependa del contexto del repositorio para impedir que una sesión opere accidentalmente sobre otro proyecto.

## Role isolation

El Implementer y el Reviewer usan sesiones independientes. El Reviewer recibe `taskId`, intención, ChangeSet, diff Git, archivos no trackeados y evidencia disponible; no recibe la conversación ni el historial de mensajes del Implementer. La respuesta estructurada se valida antes de construir una `Review`; una respuesta inválida es un fallo accionable, no un `pass` implícito.

## Project Structure

```text
src/application/                 → Orquestación de ejecuciones y reviews
src/ports/agent-runtime.ts       → Puerto estable del runtime
src/ports/reviewer.ts            → Puerto estable del Reviewer
src/adapters/opencode-*.ts       → Adapters HTTP de OpenCode
tests/                            → Tests de contrato, adapters y flujo
```

## Code Style

El puerto expresa capacidades de ADE, no tipos de OpenCode:

```ts
interface AgentRuntimePort {
  createSession(input: { directory: string; title?: string }): Promise<SessionHandle>;
  prompt(session: SessionHandle, input: { text: string; agent?: string }): Promise<void>;
  events(signal?: AbortSignal): AsyncIterable<RuntimeEvent>;
  abort(session: SessionHandle): Promise<void>;
}
```

## Testing Strategy

Tests de contrato contra un fake runtime; tests unitarios del parser SSE y errores HTTP; smoke test contra OpenCode real; pruebas de cancelación, streaming, directorio, salida estructurada y captura de diff. El Reviewer se prueba con contexto independiente del Implementer y con respuestas inválidas o findings mal formados.

## Boundaries

- **Always:** aislar OpenCode tras un adapter; persistir relación Task/session/execution; hacer explícitos permisos y modelo.
- **Ask first:** fork de OpenCode, cambio de runtime, nuevos permisos o ejecución autónoma por defecto.
- **Never:** afirmar que el agente terminó sin evento/evidencia; pasar toda la conversación del Implementer al Reviewer por conveniencia.

## Success Criteria

Una sesión real puede ejecutar una Task sobre un repositorio local, emitir eventos, modificar archivos y ser cancelada; el smoke test real validó health, sesión, prompt, streaming SSE, `session.idle` y aislamiento en un repositorio efímero. Una segunda sesión puede recibir diff, intención y evidencia, y devolver findings estructurados sin heredar la conversación del Implementer. El flujo persistido completo está validado en [Spike 002](../spikes/002-independent-review.md#implementacion).

## v0.1 decisions

- La integración inicial es HTTP local contra OpenCode; no se introduce SDK ni proceso hijo como dependencia del dominio.
- Las credenciales pertenecen al runtime/provider y no se almacenan en ADE DB; la configuración segura del entorno queda fuera de este módulo.
- Todo runtime futuro debe soportar, como mínimo, sesiones por directorio, prompt, eventos o señal de finalización, abort y diff; la salida estructurada es obligatoria para implementar `ReviewerPort`.

## Open Questions

- ¿Qué política común de timeout y reintentos debe aplicar la capa de aplicación?
- ¿Cómo se expondrán permisos y tools de forma portable entre runtimes?
- ¿Qué formato de observación persistirá ADE para logs y tool calls sin almacenar secretos?
