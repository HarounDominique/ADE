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

`OpenCodeAdapter` es la implementación inicial preferida de `AgentRuntimePort`. La versión exacta y la estrategia de integración se decidirán en el Spike 001.

## Commands

El spike debe dejar comandos o API reproducible para crear sesión, enviar una Task, recibir streaming, cancelar y obtener eventos.

## Project Structure

```text
src/application/agent-runtime/ → Casos de uso
src/ports/agent-runtime.ts      → Puerto estable
src/adapters/opencode/           → Adapter inicial
tests/contract/agent-runtime/    → Contratos del puerto
```

## Code Style

El puerto expresa capacidades de ADE, no tipos de OpenCode:

```ts
interface AgentRuntimePort {
  createSession(input: SessionInput): Promise<SessionHandle>;
  sendMessage(session: SessionHandle, message: string): AsyncIterable<RuntimeEvent>;
  cancelExecution(executionId: string): Promise<void>;
}
```

## Testing Strategy

Tests de contrato contra un fake runtime; smoke test contra OpenCode real; pruebas de cancelación, errores, streaming, permisos y captura de tool calls. El Reviewer se prueba con contexto independiente del Implementer.

## Boundaries

- **Always:** aislar OpenCode tras un adapter; persistir relación Task/session/execution; hacer explícitos permisos y modelo.
- **Ask first:** fork de OpenCode, cambio de runtime, nuevos permisos o ejecución autónoma por defecto.
- **Never:** afirmar que el agente terminó sin evento/evidencia; pasar toda la conversación del Implementer al Reviewer por conveniencia.

## Success Criteria

Una sesión real puede ejecutar una Task sobre un repositorio local, emitir eventos, modificar archivos y ser cancelada; un reviewer fresco puede recibir diff, intención y tests y devolver findings estructurados.

## Open Questions

- ¿API embebida, proceso hijo o integración híbrida con OpenCode?
- ¿Cómo se autentican providers sin que ADE persista secretos?
- ¿Qué capacidades mínimas deben soportar runtimes futuros?
