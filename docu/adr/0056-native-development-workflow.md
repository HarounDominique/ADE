# ADR-0056 — El workflow adaptativo se implementa nativamente y viene activado

## Status

Accepted

## Date

2026-09-11

## Amends

[ADR-0003](0003-adaptive-workflow.md), que decidió el workflow adaptativo y no llegó a construirse. Este ADR no cambia aquella decisión: la ejecuta y añade el interruptor que le faltaba.

## Context

`SPEC-development-workflow` especifica ocho fases orientativas, cuatro modos adaptativos, seis gates mínimas, una matriz de transiciones, reentrada con historial y un contrato `WorkflowResult`. `SPEC-NEXUS` marcaba el módulo `development-workflow` como `done`.

No existía. La auditoría del 2026-09-11 comprobó que `src/application/workflow/`, `src/domain/workflow/`, `src/skills/workflow/` y `tests/workflow/` no estaban en el árbol, y que `FRAME`, `RECONCILE`, `reenter`, `design-heavy` y `WorkflowResult` no aparecían en una sola línea de `src/` ni de `tests/`. La `Project Structure` de la propia spec declaraba cuatro rutas inexistentes.

Lo único que quedaba del módulo era una entrada en el catálogo de skills nativas:

```ts
{ id: "adaptive-workflow", label: "Adaptive workflow", description: "Select phase, mode and re-entry without rigid ceremony." }
```

`runNativeSkill` toma el `label` y la `description` de ese manifiesto, los mete en un prompt de cinco líneas y se lo manda al proveedor. Ejecutar la skill era enviarle al modelo una frase de una línea. La misma forma tiene `spector`, que promete generar y reconciliar specs vivas.

Existe una implementación probada de esta metodología fuera de ADE: SEED, un plugin de Claude Code que lleva el flujo `spec → plan → creative → build → reflect → archive` con enrutado por complejidad, un guard TDD determinista, escalada de modelo por reintento y un bucle de aprendizaje entre tareas. Comparte con ADE el formato de corpus de specs —`SPEC-NEXUS.md`, specs de módulo, cita por `module id + heading`, estados `draft/ready/blocked/in-progress/done`— hasta el punto de que las dos tablas de módulos son intercambiables. Sus seis fases encajan dentro de las ocho de ADE sin residuo.

## Decision

El workflow adaptativo se implementa en el dominio de ADE, con SEED como implementación de referencia de sus mecanismos, y viene activado por defecto.

**Las fases son estado de workflow, no estados del agregado `Task`.** `SPEC-development-workflow` ya lo decidió y se mantiene: `TaskStatus` describe el ciclo de vida de la Task (`DRAFT → READY → IN_PROGRESS → … → COMPLETED`); la fase describe en qué está el trabajo dentro de ese ciclo. Son ortogonales y se persisten por separado. Una Task `IN_PROGRESS` puede estar en `BUILD`, en `VERIFY` o reentrando en `EXPLORE` sin que su estado de ciclo de vida cambie.

**Cuatro mecanismos llegan desde SEED:**

- *Guard TDD.* Antes de que un cambio pase `VERIFY`, un chequeo determinista sobre el diff staged comprueba que todo fichero de producción añadido o modificado lleva un fichero de test en el mismo diff, y que la verificación declarada del Project terminó en 0. Un borrado puro no exige test: limpiar no es un cambio sin probar. El veredicto lo da código, no el juicio de un agente, porque un modelo bajo presión racionaliza la excepción y un booleano no.
- *Modos adaptativos.* `quick`, `standard`, `design-heavy` y `recovery` proponen recorridos distintos sobre las mismas ocho fases. El modo puede escalar durante la ejecución; no puede omitir un invariante.
- *Escalada por reintento.* Cada fase cuenta sus intentos. El primero corre en el tier por defecto; el segundo sube de tier una vez; el tercero no se despacha: para la fase y pide decisión humana. No es un presupuesto de reintentos que se pueda subir — es la parada prevista.
- *Bucle de aprendizaje.* `RECONCILE` extrae de la Task cerrada reglas reutilizables con evidencia y prioridad, que las fases posteriores de otras Tasks cargan antes de trabajar.

**El flujo viene activado y se puede desactivar en dos sitios**, siguiendo los dos precedentes que el código ya tiene: `UserSettings` en la base de ADE lleva la preferencia del operador, igual que `turnChime` ([ADR-0053](0053-user-settings-live-in-ades-store.md)); `.ade/policy.json` lleva el override del Project, igual que `requiredGates` ([ADR-0044](0044-verification-gates-from-real-runs.md)). El Project gana cuando se pronuncia: un repositorio que exige el flujo lo exige a quien lo abra. Desactivado, ADE se comporta como hoy — Tasks, gates y review siguen existiendo; lo que desaparece es la conducción por fases, no la gobernanza.

**SEED sigue vivo como proyecto independiente, y eso es parte de la decisión, no un residuo de ella.** La metodología es un pilar de Assay a partir de esta iteración, y además una entidad propia: un desarrollador debe poder instalar SEED como plugin de su agente y usarlo en su trabajo sin adoptar Assay. Que el flujo esté implementado nativamente aquí no lo convierte en función de este producto.

Una metodología, dos superficies de distribución. No es deriva a vigilar: es portabilidad deliberada, y la razón por la que ninguna de las dos superficies puede exigir la otra. Assay toma SEED como referencia upstream de sus mecanismos; SEED no toma nada de Assay.

## Alternatives Considered

### Envolver SEED como skill nativa en lugar de implementarlo

Ventaja: coste bajo, la costura ya existe —catálogo de skills, `runNativeSkill`, adapter de Claude Code, permisos por ejecución.

Rechazado: ataría el diferenciador del producto a un proveedor concreto. El workflow es lo que ADE promete ser; delegarlo en un plugin de Claude Code significa que con Codex u OpenCode no hay workflow. Contradice *Provider-agnostic*, que es principio de producto, no preferencia.

### Reescribir la spec al modelo de seis fases de SEED

Ventaja: menos fases que implementar.

Rechazado: descarta diseño ya aprobado y revisado, y obliga a re-justificar `EXPLORE` y `VERIFY` como fases propias. Las seis de SEED encajan dentro de las ocho sin residuo; la dirección correcta es la contraria.

### Dejar el flujo desactivado por defecto

Ventaja: ningún usuario existente nota un cambio de comportamiento.

Rechazado: un diferenciador apagado por defecto es un diferenciador que nadie ve. Además contradice *Verification-first*, que no es un modo opcional del producto sino su postura. Se puede apagar; no se llega apagado.

### Hacer de la fase un valor más de `TaskStatus`

Rechazado: mezcla dos ejes. Una Task puede reentrar en `EXPLORE` cinco veces sin cambiar de estado de ciclo de vida, y `COMPLETED` no es una fase. `SPEC-development-workflow` ya lo había separado correctamente.

## Consequences

- El `done` de `development-workflow` en `SPEC-NEXUS` pasa a `in-progress` hasta que el módulo esté construido y verificado. Era el único estado falso del nexus y deja de serlo.
- `SPEC-development-workflow` § Project Structure declara rutas que van a existir, en lugar de rutas que nunca existieron.
- Una Task adquiere fase, modo, contador de intentos por fase e historial de transiciones, persistidos junto a la Task y separados de su `TaskStatus`.
- Las gates existentes no cambian de contrato: siguen leyendo `RuntimeEvidence`. Lo que cambia es que ahora hay una fase que sabe cuándo pedirlas y a qué fase volver cuando fallan.
- La skill nativa `adaptive-workflow` deja de ser un manifiesto sin cuerpo y pasa a despachar contra el dominio. `spector` queda pendiente del mismo tratamiento y se declara como tal, en vez de aparentar paridad con las skills que sí ejecutan algo.
- Un Project que desactiva el flujo conserva Tasks, gates, evidencia y review. La conducción por fases es lo único que se apaga.
- SEED se mantiene como plugin independiente y utilizable sin Assay. Las dos superficies comparten metodología y no comparten código; ninguna es requisito de la otra. Un cambio en la metodología se decide una vez y se aplica a las dos a mano, que es el precio de no atar al usuario a este producto para usarla.
