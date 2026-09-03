# Spike 001 — OpenCode runtime y primera vertical slice

**Estado:** smoke test real completado con un hallazgo corregido en el adapter  
**Fecha:** 2026-09-02  
**Spec:** [SPEC-agent-runtime.md](../specs/SPEC-agent-runtime.md#success-criteria)  
**Nexus:** [SPEC-NEXUS.md](../specs/SPEC-NEXUS.md#mvp-contract)

## Objetivo

Validar que ADE puede controlar un runtime OpenCode, asociarlo a una Task y observar el resultado sin acoplar el dominio a OpenCode.

## Decisión del spike

Se usa un adapter HTTP/SSE con `fetch` nativo contra `opencode serve`. Es la integración más pequeña que permite validar el contrato real del servidor: health, creación de sesión, prompt asíncrono, eventos, diff y abort. El SDK oficial y una integración embebida quedan como alternativas posteriores; no se decide el stack definitivo de ADE en este spike.

## Implementación

```text
src/domain/task.ts                  → Task, estados, transiciones y eventos
src/ports/agent-runtime.ts          → AgentRuntimePort
src/adapters/opencode-http-runtime.ts → adapter OpenCode HTTP/SSE
src/adapters/git-changes.ts        → captura de estado, patch y no trackeados
src/domain/change-set.ts           → ChangeSet agregado a Task/session/Git
src/persistence/sqlite-store.ts   → persistencia SQLite de Task y ChangeSet
src/application/run-spike.ts        → orquestación Task/session/events/diff
src/spike.ts                         → CLI mínima
tests/task.test.ts                  → invariantes del dominio
tests/opencode-http-runtime.test.ts → contrato HTTP del adapter
```

## Flujo validado localmente

```text
Task.create
  → READY
  → IN_PROGRESS
  → create session
  → prompt_async
  → collect SSE until session.idle
  → get session diff
  → capture Git status (including untracked files)
  → create ChangeSet
  → persist Task + ChangeSet in SQLite
  → IMPLEMENTED
```

Las transiciones incluyen actor, causa y timestamp. El adapter rechaza respuestas HTTP erróneas, valida el id de sesión y cancela la lectura del stream al finalizar. La captura de Git complementa el diff de OpenCode porque un archivo nuevo puede no aparecer en el endpoint de diff de sesión.

## Verificación ejecutada

```bash
npm run build
npm test
```

Resultado: TypeScript compila y pasan 4 tests: transiciones auditables de Task, rechazo de transiciones inválidas, mapeo del adapter a health/session/prompt/diff y captura de archivos no trackeados.

## Smoke test real

Requisitos externos:

1. Instalar el binario OpenCode. ✅
2. Configurar un provider/modelo autenticado. ✅
3. Arrancar `opencode serve --hostname 127.0.0.1 --port 4096`. ✅
4. Ejecutar el CLI de ADE sobre un repositorio temporal. ✅
5. Confirmar eventos de sesión, `session.idle`, diff, estado Git y abort. ✅ parcial: diff de no trackeados requiere complemento Git.

```bash
npm run dev -- /ruta/al/repositorio "Create a small file and report the change."
```

Resultado ejecutado: OpenCode `1.18.26` respondió health, se creó una sesión, se recibieron 105 eventos y el agente creó `smoke-result.txt` correctamente en el repositorio efímero. El endpoint de diff de sesión devolvió `[]` para el archivo no trackeado; Git lo detectó como `?? smoke-result.txt`, por lo que se añadió captura explícita de Git.

## Resultado y siguiente decisión

La frontera `AgentRuntimePort → OpenCodeHttpRuntime` y la persistencia `Task → ChangeSet` son viables. Antes de elegir SDK oficial, proceso hijo o integración embebida, hay que medir: estabilidad del SSE, forma de eventos, permisos, errores de provider, cancelación y aislamiento por directorio.

La ejecución integrada también reveló y resolvió la necesidad de migrar SQLite cuando evoluciona el esquema: `AdeStore` añade `change_sets.directory` a bases existentes antes de usarlas.

## Integración desktop

El sidecar desktop reutiliza este adapter mediante `task.run`, emite eventos de runtime por JSONL y la shell conserva los 12 más recientes. La verificación automatizada de contrato y persistencia pasa; el smoke desde Tauri requiere arrancar `opencode serve` en el entorno del usuario. En esta sesión `opencode --version` respondió `1.18.26`, pero `opencode serve` terminó con `ServeError`, por lo que no se afirma una validación end-to-end adicional.
