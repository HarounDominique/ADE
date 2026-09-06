# ADR-0029: Workbench de Agents inspirado en ChatGPT Desktop

## Status

Accepted

## Date

2026-09-06

## Context

ADE ya puede crear y reanudar sesiones locales de Codex, Claude Code y OpenCode, persistir mensajes y seleccionar un modelo dependiente del provider. Su composición actual mantiene un rail plano de conversaciones y un thread central, pero aún no traduce con suficiente claridad el trabajo de un desarrollador dirigido por agentes: recuperar conversaciones relacionadas con una Task, concentrarse en el hilo y distinguir un turno en ejecución sin convertir la vista en un inspector de IDE.

La auditoría [ChatGPT Desktop para Agents](../knowledge/chatgpt-desktop-agents-audit.md) estudia las referencias oficiales y adapta sus patrones a los límites de ADE. A diferencia de ChatGPT, ADE ya tiene una autoridad global para Project, Task y branch, y debe mantener varias familias de providers/runtimes locales.

## Decision

`Agents` conserva un workbench de dos zonas: rail de conversaciones y thread central. El rail se limita al Project activo y organiza las conversaciones por `Task`, con un grupo `General` para prompts sin Task. Project, branch, Git y diffs no aparecen como una tercera columna ni como un inspector lateral permanente.

Cada conversación se vincula a un provider al crear la sesión. El usuario puede cambiar de modelo para el siguiente turno dentro del catálogo de ese provider; cambiar de provider crea una conversación nueva, posiblemente asociada a la misma Task, para no corromper la reanudación real de sesiones heterogéneas.

La topbar concentra la Task activa y el thread concentra provider, modelo y permisos del turno. Una conversación nueva hereda la Task global; una sesión existente conserva la suya. Los estados y la evidencia verificable se adjuntan al turno que los genera mediante bloques plegables. ADE no muestra razonamiento privado.

## Alternatives considered

### Replicar la agrupación por Project de ChatGPT

Rechazado: duplicaría `Projects` y el selector global de ADE, y permitiría confundir conversaciones de distintos repositorios locales.

### Mantener una lista plana de sesiones

Rechazado: escala mal cuando un Project contiene varias Tasks y hace difícil recuperar la intención de una conversación.

### Añadir Git, archivos modificados y skills como inspector derecho

Rechazado: reduce el espacio de lectura y duplica Version control/Tasks. La evidencia relevante se vincula al turno y el detalle conserva su superficie propia.

### Permitir cambiar de provider dentro de una sesión existente

Rechazado: Codex, Claude Code y OpenCode no comparten identificadores ni protocolos de reanudación. Presentarlo como continuación sería falso.

## Consequences

- El modelo de persistencia deberá consultar sesiones por Project y Task, incluidas sesiones sin Task.
- La UI necesitará estados explícitos para Task sin conversaciones, conversación no reanudable, provider no disponible y cambio de Project durante una respuesta asíncrona.
- El thread gana espacio y continuidad; la navegación gana contexto semántico de Task.
- Se requerirán pruebas de agrupación, selección, invalidación de contexto, provider/modelo y accesibilidad del rail.

## Implementation evidence

La entrega persiste `project_id` y `title` en `agent_sessions`, migra bases existentes y mantiene compatibilidad de lectura con sesiones heredadas por directorio. El sidecar filtra sesiones por Project, rechaza acceso/borrado cruzado y no permite reanudar una sesión con otro provider. La shell agrupa el rail por Task/General, preselecciona la Task global para conversaciones nuevas, bloquea cambiar la asociación de una conversación ya existente y descarta respuestas que lleguen tras cambiar de Project. `Current task` ofrece un máximo de 12 registros por creación descendente y refresca las superficies dependientes. `npm test` pasa con 117 tests TypeScript y `npm run build`/`npm --prefix desktop run build` pasan.

## Acceptance criteria for implementation

- El rail nunca muestra conversaciones de un Project distinto al activo.
- Task y `General` son los únicos grupos primarios del rail.
- Un cambio de provider inicia una conversación nueva; un cambio de modelo afecta sólo al siguiente turno del provider actual.
- La conversación central no comparte ancho con un inspector persistente de Git/actividad/skills.
- Estados observables de ejecución y evidencia por turno no revelan razonamiento privado.
- La implementación conserva la persistencia, borrado confirmado y permisos por turno ya existentes.
