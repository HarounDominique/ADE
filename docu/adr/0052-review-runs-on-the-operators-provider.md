# ADR-0052 — La review corre en el proveedor del operador

## Status

Accepted

## Date

2026-09-09

## Amends

El Reviewer de [ADR-0007](0007-gated-change-review.md) y [ADR-0004](0004-runtime-port-and-opencode-http.md), que sólo existía sobre OpenCode, y completa lo que [ADR-0043](0043-agent-turn-as-pipeline-entry.md) hizo con el Implementer.

## Context

ADR-0043 liberó al Implementer: un turno entra al pipeline lo ejecute Claude, Codex u OpenCode. La review no se tocó. `task.rereview` instanciaba `OpenCodeReviewer` con `OpenCodeHttpRuntime` en la propia línea, de modo que la gate que decide si el trabajo pasa era alcanzable por un único runtime.

La consecuencia para un operador que trabaja con Claude Code o Codex —hoy la mayoría— es que puede producir cambios que el producto no sabe revisar: `agent-review` queda sin productor y el flujo muere antes de la aprobación. *Provider-agnostic* es un principio declarado en `PRODUCT.md`, y se rompía justo en la pieza que da nombre al producto.

Además la elección del runtime por proveedor estaba escrita cuatro veces en el sidecar. Una capacidad soportada para turnos y no para review es precisamente lo que produce esa duplicación.

## Decision

`ReviewerPort` tiene dos implementaciones sobre un mismo contrato:

- `OpenCodeReviewer`, que aprovecha la salida estructurada por schema de OpenCode.
- `CliReviewer`, para Claude Code y Codex, que pide el mismo JSON y lo encuentra en la respuesta del CLI.

El contrato —schema, prompt y validación de findings— vive en un único módulo. Una Task revisada por Claude y otra revisada por OpenCode producen la misma clase de documento; sin eso serían dos cosas distintas llamadas igual.

La respuesta se **busca**, no se parsea de tres formas: los proveedores contestan con el objeto estructurado, con texto —a veces envuelto en prosa o en un bloque cercado— o con un transcript JSONL donde el texto vive dentro de un evento. Una respuesta que no contiene una review se rechaza; nunca se inventa una.

Qué proveedor revisa: el que el operador pida, y si no, **el que ha estado haciendo el trabajo de esa Task**. OpenCode deja de ser la regla y pasa a ser el último recurso cuando no hay nada que indique otra cosa.

La independencia no la da que el proveedor sea distinto, sino que el reviewer vea evidencia e intención y nunca la conversación del implementer. Eso se mantiene igual. Un turno de review no concede ningún permiso: un reviewer no puede "arreglar" lo que se le pidió juzgar.

Una única fábrica responde «qué runtime es este proveedor» para todos los seams.

## Alternatives Considered

### Exigir OpenCode como reviewer siempre, por independencia

Rechazado: convierte una dependencia opcional en obligatoria para el flujo entero y contradice *provider-agnostic*. La independencia que importa es la del contexto, y esa se conserva.

### Pedir al CLI que escriba el JSON en un fichero y leerlo

Rechazado: exige permiso de escritura para un turno cuya única garantía es que no escribe.

### Un parser por proveedor

Rechazado: tres formas de leer la misma review es cómo se acaba con tres reviews distintas. La forma de la respuesta varía; el contenido no.

### Elegir siempre un proveedor distinto al que implementó

Rechazado por ahora: obligaría a tener dos proveedores configurados para poder cerrar una Task. Queda como opción de policy si algún día se quiere independencia de proveedor además de independencia de contexto.

## Consequences

- La gate `agent-review` es alcanzable con Claude Code y con Codex, no sólo con OpenCode.
- Una review se lee igual venga de donde venga, y una respuesta ilegible falla en vez de producir una review vacía que pasaría por buena.
- La elección de runtime por proveedor deja de estar copiada por el sidecar.
- El reviewer sigue sin decir qué criterio de aceptación incumple cada finding: eso queda abierto desde [ADR-0051](0051-acceptance-criteria-belong-to-the-task.md).
- Un CLI sin salida estructurada garantizada puede contestar algo que no es JSON; entonces la review falla explícitamente y se puede reintentar, que es preferible a una review inventada.
