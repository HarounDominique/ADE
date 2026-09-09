# ADR-0051 — La aceptación pertenece a la Task, y sin ella no se empieza

## Status

Accepted

## Date

2026-09-09

## Amends

El contrato de Task de [ADR-0002](0002-project-repository-identity.md) y [ADR-0003](0003-adaptive-workflow.md), que definían intención y transiciones sin un lugar donde el humano escribiera qué significa "hecho".

## Context

`PRODUCT.md` dice que el humano define «intención, restricciones y aceptación» y que la finalización del agente no equivale a aceptación. El dominio sólo tenía `intent`: una frase. El diálogo de creación tenía un campo. De esa frase colgaban el prompt del agente, el juicio del reviewer, las gates y la aprobación humana.

El resultado es que la parte más cara del producto —la verificación— comparaba contra algo que nadie había escrito. El reviewer recibía la intención y el diff y opinaba; el humano aprobaba de memoria; el agente trabajaba sin conocer el listón contra el que se le iba a medir. Varias pruebas del repositorio ya escribían como razón de transición «Acceptance criteria recorded» sobre Tasks que no tenían ninguno: la ficción estaba escrita en el propio código.

## Decision

La Task guarda `acceptanceCriteria`: una lista de afirmaciones comprobables, una por línea, sin blancos. Se escriben al crear la Task, junto a la intención.

**Una Task no pasa a `READY` sin al menos un criterio.** `READY` es el momento en que se acepta empezar el trabajo, y empezar sin listón es exactamente lo que este ADR corrige. Abortar no lo exige: sólo comprometerse a trabajar.

Cambiar los criterios es una decisión y queda en el historial de la Task como `task.acceptance_changed`, con actor y razón. Vaciarlos no es una forma de bajar el listón: la lista no puede quedar vacía una vez escrita.

Los criterios viajan a los tres sitios donde se juzga:

- **Al agente**, en el turno de una Task, junto al briefing estructural. Trabajar sin ver el listón contra el que se revisa es pedir que se acierte un blanco que no se ha enseñado. La conversación sigue persistiendo sólo el prompt del operador.
- **Al reviewer**, en su prompt, con la instrucción de que un criterio incumplido es un finding. Sin criterios, el prompt lo dice y el reviewer juzga sólo contra la intención, en vez de fingir un listón.
- **Al humano**, en el detalle de la Task, inmediatamente encima de `Approve` y `Ship`, porque aprobar es una comparación contra esa lista.

Una Task guardada antes de esta decisión no tiene criterios, se lee sin problema y los pide la próxima vez que quiera pasar a `READY`.

## Alternatives Considered

### Dejar la aceptación como prosa dentro de la intención

Rechazado: no es citable ni comprobable uno a uno, y es lo que ya había de hecho. Una lista permite decir qué criterio quedó sin cumplir.

### Pedir los criterios sólo al aprobar

Rechazado: llegan tarde. El agente ya trabajó y el reviewer ya juzgó; escribir el listón después de ver el resultado es escribirlo para que encaje.

### Exigirlos también para `IN_PROGRESS` o para cualquier turno

Rechazado: un turno de conversación exploratoria sobre una Task existente no debe bloquearse. La puerta está en `READY`, que es donde el humano se compromete.

### Gate automática que verifique cada criterio

Diferido: exige que el reviewer devuelva su veredicto por criterio, no un resumen con findings. Es la evolución natural y no se decide aquí.

## Consequences

- La cadena entera —agente, reviewer, gates, aprobación— compara contra algo escrito por un humano antes de empezar.
- Una Task vieja sin criterios sigue siendo legible, y el sistema los pide en el punto exacto donde hacen falta.
- Crear una Task cuesta un campo más. Es el coste deliberado: era demasiado fácil crear trabajo sin definición de hecho.
- El reviewer todavía no dice qué criterio incumple cada finding; el veredicto por criterio queda abierto.
- Los criterios no se versionan por ciclo: el historial guarda que cambiaron y por qué, no un diff entre listas.
