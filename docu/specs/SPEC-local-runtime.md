# Spec: Local Runtime

<!-- Nexus: SPEC-NEXUS.md | Module id: local-runtime -->

## Objective

Administrar servicios, procesos, terminal, logs y tests locales para que ADE pueda observar y verificar software sin convertirse en un IDE completo.

## Runtime contract

Un servicio declarado debe exponer comando, proceso, puertos, variables no secretas, estado, logs y health evidence. ADE debe poder arrancarlo, detenerlo, reiniciarlo, aplicar timeout y entregar su evidencia al workflow y al Reviewer.

## Project Structure

```text
src/application/local-runtime/ → Casos de uso
src/ports/process.ts           → Puerto de procesos
src/ports/filesystem.ts        → Puerto de filesystem
src/adapters/local/            → Implementaciones locales
tests/local-runtime/           → Tests con procesos controlados
```

## Commands

Cada Project podrá declarar comandos configurables para arrancar/parar servicios, tests y build. La forma portable (`.ade/services.yaml`) es provisional.

## Code Style

Los procesos se modelan por estado y evidencia, no por un booleano aislado:

```text
DECLARED → STARTING → RUNNING → STOPPING → STOPPED
                         ↓
                       FAILED
```

## Testing Strategy

Tests de lifecycle con procesos efímeros; captura de logs; puertos ocupados; timeout; terminación; tests de comandos de proyecto en fixtures.

## Boundaries

- **Always:** mostrar comando, proceso, puerto, estado y logs; aplicar timeouts; atribuir operaciones al actor.
- **Ask first:** ejecutar comandos destructivos, elevar permisos o abrir servicios fuera del proyecto.
- **Never:** ocultar stdout/stderr; mantener procesos huérfanos; tratar un proceso arrancado como servicio saludable sin evidencia.

## Success Criteria

ADE puede arrancar un backend y frontend declarados, mostrar estado y logs, ejecutar tests y entregar evidencia consumible por el reviewer.

## Open Questions

- ¿Qué supervisor de procesos usar en desktop?
- ¿Cómo se declaran variables de entorno sin almacenar secretos?
- ¿Se soporta shell específico por sistema operativo en v0.1?
