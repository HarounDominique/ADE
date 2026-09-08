# Spec: Local Runtime

<!-- Nexus: SPEC-NEXUS.md | Module id: local-runtime -->

## Objective

Administrar servicios, procesos, terminal, logs y tests locales para que ADE pueda observar y verificar software sin convertirse en un IDE completo.

## Runtime contract

Un servicio declarado debe exponer comando, proceso, puertos, variables no secretas, estado, logs y health evidence. ADE debe poder arrancarlo, detenerlo, reiniciarlo, aplicar timeout y entregar su evidencia al workflow y al Reviewer.

## Process and service contract

Un `ServiceDefinition` contiene `id`, `command`, `args`, `cwd`, `env`, `ports`, `healthcheck` y `shutdownTimeoutMs`. `cwd` debe resolverse dentro del Project salvo una autorización explícita. Las variables secretas se referencian por nombre desde el entorno del proceso y nunca se persisten ni se imprimen.

```ts
type ServiceState = "DECLARED" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";

type RuntimeEvidence = {
  serviceId: string;
  state: ServiceState;
  at: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
  health?: { ok: boolean; detail?: string };
};
```

El ciclo normal es `DECLARED → STARTING → RUNNING → STOPPING → STOPPED`. Un proceso que termina inesperadamente —incluido justo después de `spawn`—, excede el timeout de arranque o falla el healthcheck pasa a `FAILED`. La implementación notifica la salida del proceso al supervisor para que no quede una sesión stale en `RUNNING`; `RUNNING` sólo puede emitirse después de que el proceso esté vivo y el healthcheck requerido haya pasado.

Cada operación devuelve o persiste evidencia con comando, cwd, actor, timestamps, código de salida, stdout/stderr limitado y resultado del healthcheck. Los límites de salida deben evitar memoria ilimitada sin ocultar que hubo truncamiento.

## Run configurations boundary

Este módulo posee el supervisor: procesos, estados, señales, puertos, healthchecks y evidencia. Cómo el usuario elige y arranca una aplicación —configuraciones seleccionables, modo depuración, control en la topbar y consola por ejecución— pertenece a [run-configurations](SPEC-run-configurations.md#objective), que reutiliza este contrato sin ampliarlo: no añade estados al ciclo de vida ni un segundo supervisor. Una configuración puede referenciar un `ServiceDefinition` de `.ade/services.json` por `id` en lugar de recopiar su comando.

## Safety contract

ADE ejecuta comandos declarados por el Project con permisos del usuario actual. Antes de arrancar o detener un servicio muestra comando, directorio y puertos. Comandos destructivos, elevación de permisos, acceso fuera del Project y variables secretas requieren confirmación humana. El supervisor debe enviar una señal de terminación, esperar el timeout y escalar a una señal forzada sólo según policy explícita.

## Project Structure

```text
src/application/local-runtime/ → Casos de uso
src/ports/process.ts           → Puerto de procesos
src/ports/filesystem.ts        → Puerto de filesystem
src/adapters/local/            → Implementaciones locales
tests/                          → Tests con procesos y fixtures controlados
```

## Commands

Cada Project declara comandos configurables para arrancar/parar servicios, tests y build en `.ade/services.json`. La primera validación del repositorio sigue siendo:

```bash
npm run build
npm test
```

El futuro CLI debe exponer operaciones equivalentes a `service-start <id>`, `service-stop <id>`, `service-restart <id>`, `service-logs <id>` y `run-check <command-id>`. La shell ya lista los servicios declarados por Project desde `.ade/services.json` y permite start/stop por `id`.

## Code Style

Los procesos se modelan por estado y evidencia, no por un booleano aislado:

```text
DECLARED → STARTING → RUNNING → STOPPING → STOPPED
                         ↓
                       FAILED
```

## Testing Strategy

Tests de lifecycle con procesos efímeros; captura y truncamiento de logs; puertos ocupados; timeout de arranque y parada; terminación sin huérfanos; healthcheck HTTP/comando; ejecución en cwd del Project; y tests de comandos de proyecto en fixtures. La verificación no debe depender de un servidor externo.

## Boundaries

- **Always:** mostrar comando, proceso, puerto, estado y logs; aplicar timeouts; atribuir operaciones al actor.
- **Ask first:** ejecutar comandos destructivos, elevar permisos o abrir servicios fuera del proyecto.
- **Never:** ocultar stdout/stderr; mantener procesos huérfanos; tratar un proceso arrancado como servicio saludable sin evidencia.

## Success Criteria

ADE puede arrancar un backend y frontend declarados, mostrar estado y logs, ejecutar tests y entregar evidencia consumible por el reviewer.

## v0.1 decisions

- El supervisor será una abstracción propia sobre procesos del sistema; no se adopta un daemon externo antes de validar el lifecycle.
- Los secretos se resuelven desde el entorno del proceso y se redactan en logs/evidencias; `.ade/services.json` no contiene valores secretos.
- Los comandos se ejecutan sin shell por defecto (`command` + `args`); el uso de shell específico es una capacidad explícita y condicionada por policy.

## Open Questions

- ¿Qué implementación multiplataforma de señales y grupos de procesos requiere Tauri/Electron?
- ¿Cómo evolucionará y se versionará por Project el esquema JSON de `.ade/services.json`?
- ¿Qué healthchecks son suficientemente portables para servicios no HTTP?
