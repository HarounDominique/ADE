# ADR-0045 — Publicar la Task aprobada y atribuir su commit

## Status

Accepted

## Date

2026-09-09

## Amends

La aprobación humana de [ADR-0007](0007-gated-change-review.md) y la superficie de Version control de [ADR-0028](0028-github-desktop-version-control-parity.md).

## Context

Descrito como G4 y G5 en [product-gap-audit](../knowledge/product-gap-audit.md). Aprobar una Task la marcaba `COMPLETED` y ahí terminaba el rastro: el trabajo seguía sin commitear en el disco y el commit que el operador hacía después desde `Version control` no llevaba `taskId`, de modo que nada enlazaba ese commit con la Task, la review ni las gates que lo autorizaron.

Al cablearlo apareció algo que la auditoría no había registrado: el panel de gobernanza —gates, findings, ChangeSet, `Approve`, `Re-review`— ya no existe en la shell. `renderChangeReview` y los manejadores de esas acciones leían `#changes-task-id`, un elemento que la reorganización de `Version control` retiró. La aprobación no es que no publicara: es que no se podía ejecutar.

## Decision

Existe un seam `task.ship` que sólo commitea cuando hay aprobación humana registrada y ninguna gate requerida está sin pasar, y que rechaza también cuando no hay nada que publicar. Un rechazo se distingue de un fallo: `SHIP_BLOCKED` es el pipeline funcionando, no un error que reintentar.

El commit resultante se registra como operación Git de la Task, con la referencia del commit y el estado de las gates en el momento de publicar. El rastro de intención a cambio publicado deja de depender de la memoria de ADE.

Un commit hecho desde `Version control` con una Task seleccionada envía su `taskId`, así que también entra en la traza de esa Task. Sin Task seleccionada sigue siendo un commit del repositorio y nada lo reclama.

Las acciones de gobernanza vuelven a tener superficie, en el detalle de la Task dentro de `Projects`, que es donde ya se leen sus gates, ChangeSets y evidencia: `Approve`, `Ship` y `Re-review`. Un control que no se puede usar aparece deshabilitado y explica por qué —qué gate falta, o que la Task todavía no está lista para un humano— en lugar de desaparecer.

`Ship` reutiliza el diálogo de commit con el asunto sembrado desde la intención de la Task. El diálogo sabe cuál de las dos cosas está haciendo; publicar una Task aprobada y commitear el working tree no se presentan como la misma acción.

## Alternatives Considered

### Que la aprobación commitee sola

Rechazado: aprobar es aceptar el trabajo; publicar es una segunda decisión con su propio mensaje. Fundirlas quita al operador el único punto donde elige qué dice el commit.

### Devolver el panel de review a `Version control`

Rechazado: esa vista es Git, y volver a mezclar gobernanza de Task con working tree es lo que la reorganización deshizo. El detalle de la Task ya reúne su evidencia; las acciones pertenecen allí.

### Ocultar los controles cuando no se pueden usar

Rechazado: un botón ausente no enseña nada. Uno deshabilitado que nombra la gate que falta convierte el bloqueo en información.

### Atribuir a la Task activa todo commit del Project

Rechazado: un commit no relacionado quedaría colgado de una Task por el mero hecho de estar seleccionada. La atribución sigue a la selección explícita del operador en el momento de commitear.

## Consequences

- La cadena `intención → cambio → verificación → review → aprobación → commit atribuido` se puede recorrer entera dentro de Assay.
- Un commit publicado por `Ship` guarda qué gates lo autorizaron; un commit normal bajo una Task guarda su pertenencia.
- `Approve` y `Re-review` vuelven a ser ejecutables después de haber quedado inertes al retirarse su panel.
- `Ship` commitea todo el working tree, como hace el commit normal: no separa lo que la Task tocó de lo que había suelto. Distinguirlo depende de G6.
- Publicar sigue sin empujar a remoto: `Push origin` es una decisión aparte y no la toma esta.
