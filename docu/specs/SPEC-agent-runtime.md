# Spec: Agent Runtime

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-runtime -->

## Objective

Ejecutar implementaciones y revisiones mediante runtimes intercambiables, con OpenCode, Codex y Claude Code como adapters iniciales, sin acoplar el dominio a sus internals.

## Responsibilities

- **Implementer:** investiga y modifica el repositorio dentro de permisos explícitos.
- **Reviewer:** evalúa intención, requisitos, documentación relevante, diff y evidencia con contexto fresco.
- **Runtime adapter:** traduce sesiones, eventos, cancelación, modelos, tools, MCP y permisos del proveedor al contrato de ADE.

Una conversación puede continuar, renombrarse, resumirse, bifurcarse, archivarse, cambiar de modelo, convertirse en Task o iniciar un reviewer sin que ADE pierda la identidad de la Task.

## Tech Stack

`OpenCodeHttpRuntime`, `CodexCliRuntime` y `ClaudeCliRuntime` son las implementaciones iniciales de `AgentRuntimePort`, mediante HTTP/SSE y CLI JSONL respectivamente. El dominio y la aplicación no importan tipos de proveedor. La versión validada en el spike es OpenCode `1.18.26`; la URL se configura con `OPENCODE_URL` y por defecto es `http://127.0.0.1:4096`. Codex usa el comando detectado por el entorno o `ADE_CODEX_COMMAND`; Claude Code usa `claude` o `ADE_CLAUDE_COMMAND`.

## Commands

```bash
npm install
npm run build
npm test
npm run dev -- /ruta/al/repositorio "Inspect the repository and report its current state without editing files."
npm run review -- /ruta/al/repositorio "Describe the task"
```

Con OpenCode sirviendo localmente: `opencode serve --hostname 127.0.0.1 --port 4096`. El adapter expone una API reproducible para health, crear sesión, enviar una Task, solicitar salida JSON estructurada, recibir streaming SSE, cancelar y obtener diff. El smoke test real está documentado en [Spike 001](../spikes/001-opencode-runtime.md#smoke-test-real) y la revisión independiente en [Spike 002](../spikes/002-independent-review.md#flujo-validado).

Con Claude Code instalado, el smoke local del adapter puede comprobarse sin abrir una TUI: `claude --print --output-format stream-json --verbose --include-partial-messages --permission-mode default --permission-prompts none "Inspect the repository"`. La autenticación permanece en Claude Code y no forma parte de la configuración de ADE.

## Runtime contract

`AgentRuntimePort` ofrece las siguientes capacidades:

- `health`: comprueba disponibilidad sin iniciar una Task.
- `createSession`: crea una sesión aislada por `directory` y devuelve un handle estable.
- `prompt`: envía trabajo asíncrono al Implementer, incluyendo opcionalmente el `model` elegido por el usuario.
- `promptAndWait`: envía una petición que debe devolver una respuesta estructurada según un JSON Schema y puede fijar `model`; se usa para el Reviewer.
- `events`: expone el stream de eventos nativo cuando el provider lo ofrece —SSE en OpenCode— hasta cierre, cancelación o `session.idle` consumido por la aplicación; los CLIs entregan sus eventos públicos mediante `onEvent`.
- `diff`: obtiene el cambio que el runtime atribuye a la sesión.
- `abort`: solicita cancelación explícita de la sesión.

El puerto no garantiza semántica de negocio: no decide si una Task está terminada, no aprueba findings y no persiste secretos. La aplicación coordina eventos, timeout/cancelación, ChangeSet y Review; el adapter traduce errores HTTP, headers de directorio, formato de mensajes y SSE.

Durante `prompt`, el callback interno opcional `onEvent` entrega eventos públicos del proveedor mientras el proceso está vivo. La aplicación puede normalizarlos como `agent.output` —deltas de texto— y `agent.activity` —acciones verificables con contexto— para el transcript; los hitos internos de protocolo no se publican. No se solicita ni se muestra la cadena de pensamiento privada. Los adapters CLI conservan el stdout completo para obtener el identificador de sesión y la respuesta final; la shell sólo persiste el mensaje completo cuando el turno termina correctamente.

Cada sesión debe conservar `id` y `directory`. El `directory` se envía en cada operación que dependa del contexto del repositorio para impedir que una sesión opere accidentalmente sobre otro proyecto.

## Turn accounting

Cada turno completado registra lo que el proveedor dice que costó. El puerto declara `TurnUsage` —tokens de entrada, de salida, leídos de cache, escritos en cache y coste declarado cuando el proveedor lo da— y los adapters lo traducen desde su propio formato: Claude Code desde el evento `result` de `stream-json`, que ya agrega todas las peticiones del turno, y Codex desde `token_count`, cuyo `total_token_usage` es acumulado del thread y se reduce al turno restando lo ya registrado en la sesión. Los tokens cacheados se guardan aparte de la entrada para que una fila signifique lo mismo en cualquier proveedor.

La aplicación persiste una fila por turno en `agent_turn_usage`, ligada a la conversación y borrada con ella, y devuelve el consumo en el resultado del turno. Ese consumo se lee en las tres unidades en que el trabajo existe —turno, conversación y Task— con la misma gramática de entrada, salida, cache y coste declarado, según [ADR-0049](../adr/0049-turn-cost-read-where-the-work-is.md); la cache se dice aparte de la entrada y una unidad que ningún turno contabilizó se muestra como desconocida, nunca como cero. Un total que mezcla turnos con y sin precio conserva el coste declarado y dice de cuántos turnos habla. Un proveedor que no contabiliza —OpenCode en este seam— no escribe fila: la ausencia de coste no es coste cero. La contabilidad no decide modelo; el enrutado automático queda diferido en [ADR-0040](../adr/0040-agent-turn-accounting.md), que fija además la restricción de no cambiar de modelo dentro de una conversación viva para no perder el prompt cache del proveedor.

## Role isolation

El Implementer y el Reviewer usan sesiones independientes. El Reviewer recibe `taskId`, intención, ChangeSet, diff Git, archivos no trackeados y evidencia disponible; no recibe la conversación ni el historial de mensajes del Implementer. La respuesta estructurada se valida antes de construir una `Review`; una respuesta inválida es un fallo accionable, no un `pass` implícito.

## Project Structure

```text
src/application/                 → Orquestación de ejecuciones y reviews
src/ports/agent-runtime.ts       → Puerto estable del runtime
src/ports/reviewer.ts            → Puerto estable del Reviewer
src/adapters/opencode-*.ts       → Adapters HTTP de OpenCode
src/adapters/*-cli-runtime.ts    → Adapters CLI de Codex y Claude Code
tests/                            → Tests de contrato, adapters y flujo
```

## Code Style

El puerto expresa capacidades de ADE, no tipos de OpenCode:

```ts
interface AgentRuntimePort {
  health(): Promise<{ healthy: boolean; version?: string }>;
  createSession(input: { directory: string; title?: string }): Promise<SessionHandle>;
  prompt(session: SessionHandle, input: AgentPromptInput): Promise<unknown>;
  promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown>;
  events(signal?: AbortSignal): AsyncIterable<RuntimeEvent>;
  diff(session: SessionHandle): Promise<readonly FileDiff[]>;
  abort(): Promise<void>;
}
```

## Testing Strategy

Tests de contrato contra un fake runtime; tests unitarios de adapters CLI/HTTP, parser SSE y errores HTTP; smoke test contra OpenCode real y health/contrato CLI sin credenciales. Las pruebas cubren cancelación, streaming, directorio, salida estructurada, reanudación y captura de diff. El Reviewer se prueba con contexto independiente del Implementer y con respuestas inválidas o findings mal formados.

## Boundaries

- **Always:** aislar cada proveedor tras un adapter; persistir relación Task/session/execution; hacer explícitos permisos y modelo.
- **Ask first:** fork de OpenCode, cambio de runtime, nuevos permisos o ejecución autónoma por defecto.
- **Never:** afirmar que el agente terminó sin evento/evidencia; pasar toda la conversación del Implementer al Reviewer por conveniencia.

## Success Criteria

Una sesión real puede ejecutar una Task sobre un repositorio local, emitir eventos, modificar archivos y ser cancelada; el smoke test real validó health, sesión, prompt, streaming SSE, `session.idle` y aislamiento en un repositorio efímero. Una segunda sesión puede recibir diff, intención y evidencia, y devolver findings estructurados sin heredar la conversación del Implementer. El flujo persistido completo está validado en [Spike 002](../spikes/002-independent-review.md#flujo-validado).

## v0.1 decisions

- La integración inicial es HTTP local contra OpenCode; no se introduce SDK ni proceso hijo como dependencia del dominio.
- Las credenciales pertenecen al runtime/provider y no se almacenan en ADE DB; la configuración segura del entorno queda fuera de este módulo.
- Todo runtime futuro debe soportar, como mínimo, sesiones por directorio, prompt, eventos o señal de finalización, abort y diff. La salida estructurada deja de ser obligatoria para implementar `ReviewerPort`: basta con que el proveedor sepa devolver el JSON pedido en su respuesta —estructurado, en texto o dentro de su transcript—, según [ADR-0052](../adr/0052-review-runs-on-the-operators-provider.md).

## Open Questions

- ¿Qué política común de timeout y reintentos debe aplicar la capa de aplicación?
- ¿Cómo se expondrán permisos y tools de forma portable entre runtimes?
- ¿Qué formato de observación persistirá ADE para logs y tool calls sin almacenar secretos?
