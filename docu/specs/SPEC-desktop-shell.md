# Spec: Desktop Shell and Review UX

<!-- Nexus: SPEC-NEXUS.md | Module id: desktop-shell -->

## Objective

Ofrecer una superficie desktop centrada en proyectos y Tasks, con navegación por Knowledge, Changes y Runtime, sin construir un editor completo.

## Shell contract

El shell es una vista local sobre los contratos de `project-task-workflow`, `development-workflow`, `agent-runtime`, `local-runtime` y `changes-review-governance`. No duplica su lógica ni permite mutar estado sin pasar por los casos de uso de aplicación.

El arranque debe:

1. Detectar o registrar un Project local.
2. Mostrar Tasks activas, fase, gates y estado Git.
3. Permitir crear o reanudar una Task.
4. Observar ejecución, logs, cambios y Review.
5. Exponer `approve` y `ship` sólo cuando las gates lo permitan.

El shell debe funcionar sin cloud y conservar la capacidad de abrir el repositorio en un IDE o terminal externo.

## Information architecture

Las cinco áreas visibles son `PROJECT`, `WORK`, `KNOWLEDGE`, `CHANGES` y `RUNTIME`. El Project Hub comunica rama, estado Git, Tasks, agentes, cambios, gates, revisiones y servicios. La pantalla de resultado debe permitir entender una Task antes de abrir el diff.

### Project Hub

Es la entrada por defecto. Presenta Project, raíz del repositorio, branch detectada, estado Git, servicios activos y Tasks recientes. Una Task muestra intención, modo, fase, última evidencia, gate bloqueante y acción siguiente.

### Work

Permite crear, reanudar y observar Tasks y sus conversaciones. La conversación es una vista auxiliar: la identidad, estado y resultado se leen del agregado Task y sus registros relacionados.

### Knowledge

Muestra documentos seleccionados, motivo de inclusión, clase (`canonical`, `operational`, `agent`) e impacto pendiente. Los documentos canónicos se abren para consulta y sus cambios pasan por la gate documental.

### Changes

Presenta resumen semántico, impacto, findings, archivos, diff, ChangeSets y checkpoints en ese orden. Las acciones de corregir, aceptar riesgo, descartar y re-review deben mostrar actor, razón y evidencia.

### Runtime

Muestra sesiones, servicios, procesos, puertos, healthchecks, terminal, stdout/stderr y tests. Un estado `RUNNING` debe provenir de evidencia de runtime, no de una inferencia visual.

## Interaction states

Toda vista relevante debe representar explícitamente `loading`, `ready`, `empty`, `blocked`, `failed` y `stale`. Los fallos muestran causa, evidencia y punto de reentrada recomendado. Las operaciones largas ofrecen cancelación y mantienen visible el último estado confirmado.

Las acciones peligrosas requieren confirmación contextual con comando, directorio, impacto y posibilidad de cancelación. El shell no oculta stdout/stderr ni reemplaza el diff por un resumen del agente.

## Project Structure

```text
src/ui/project/       → Project Hub
src/ui/work/          → Tasks, conversaciones y agentes
src/ui/knowledge/     → Documentos y skills
src/ui/changes/       → Resumen, diff, review y commit
src/ui/runtime/       → Servicios, terminal, tests y logs
tests/ui/              → Tests de flujos críticos
```

## Commands

La elección de Tauri/Electron queda abierta, pero el shell debe proporcionar comandos equivalentes a:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:package
```

Mientras el shell no exista, el contrato se verifica con `npm run build && npm test` y los flujos CLI descritos en las specs de runtime y governance.

## Code Style

La revisión se presenta de mayor a menor nivel de detalle: resumen semántico, impacto, findings, archivos, diff. El visor necesita syntax highlighting, búsqueda, navegación, diff y apertura externa; no completado ni language server propio.

## Testing Strategy

Tests de componentes para estados de Task y gates; tests de integración para crear Project, crear/reanudar Task, observar ChangeSet y revisar; test end-to-end del flujo principal con adapters fake; smoke test del shell en el sistema operativo objetivo; y test de escape hatch para IDE/terminal.

La primera vertical de UI debe probar: abrir Project → crear Task → observar Implementer → consultar Review → reconciliar documentación → aprobar → preparar commit. No se exige editor, autocompletado ni colaboración realtime.

## Boundaries

- **Always:** Project Hub primero; hacer visible estado Git, Task, agentes, gates y runtime; ofrecer escape hatch a IDE/terminal.
- **Ask first:** adoptar editor completo, soporte cloud, cuentas, sync o colaboración realtime.
- **Never:** esconder operaciones peligrosas detrás de una acción ambigua; convertir la conversación en única representación del trabajo.

## Success Criteria

Un usuario puede abrir un repositorio, crear una Task, observar la implementación, revisar el resumen y diff, consultar logs/tests y aprobar un commit sin abandonar ADE para el flujo normal.

## v0.1 decisions

- El shell es deliberadamente fino: presenta estado y orquesta casos de uso, pero no contiene un editor completo ni lógica de dominio duplicada.
- La primera plataforma objetivo será macOS, por ser el entorno validado del proyecto; la abstracción debe dejar abierta la portabilidad posterior.
- El escape hatch mínimo abre la raíz del Project en el terminal y permite configurar un comando externo de IDE; la integración profunda con IntelliJ/VS Code queda fuera.
- La elección Tauri/Electron se decidirá mediante un spike posterior con criterios de arranque, filesystem, procesos, empaquetado, seguridad y ergonomía de desarrollo.

## Open Questions

- ¿Tauri o Electron tras el spike comparativo?
- ¿Qué mecanismo de eventos usa la UI: polling, SSE local o un event bus nativo?
- ¿Qué esquema de navegación permite observar varias Tasks sin perder el contexto de la activa?
