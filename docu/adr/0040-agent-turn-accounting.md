# ADR-0040 — Contabilidad de tokens por turno antes de enrutar modelos

## Status

Accepted

## Date

2026-09-08

## Amends

La selección de modelo de [ADR-0027](0027-provider-scoped-model-selection.md) y [ADR-0034](0034-agent-default-model.md), que hasta ahora era la única decisión de modelo del producto.

## Context

Otros entornos agénticos cambian de modelo a lo largo del flujo —uno barato para documentar o titular, uno potente para tareas complejas— y lo presentan como ahorro. En ADE la mecánica ya existe: `AgentPromptInput.model` viaja a `--model` en cada turno y el sidecar ya elige `haiku` o `gpt-5.6-luna` para titular un transcript de terminal. Elegir modelo por turno no requiere infraestructura nueva.

Lo que no existe es la medida. El evento `result` de `stream-json` y los eventos `token_count` de Codex traen el consumo del turno, y ADE los descartaba: `extractClaudeText` sólo buscaba texto. Sin esa medida, cualquier afirmación de ahorro es una creencia, y una regla de enrutado mal calibrada —un turno de documentación que en realidad exige leer código— se paga dos veces sin que nadie lo vea.

Además el ahorro no es de tokens sino de precio por token, y tiene un freno propio: el prompt cache es por modelo. Alternar modelos dentro de una conversación reenvía el transcript sin cache y puede costar más de lo que ahorra el modelo barato.

## Decision

Cada turno completado registra lo que el proveedor dice que costó, en una tabla `agent_turn_usage` con una fila por turno: tokens de entrada, de salida, leídos de cache, escritos en cache, coste declarado cuando lo hay, y el modelo del turno. La fila cuelga de `agent_sessions` y se borra con la conversación.

Los adapters traducen el formato del proveedor, no lo exponen: `extractClaudeUsage` prefiere el evento `result` —que ya agrega todas las peticiones del turno— y sólo suma el `usage` por petición cuando el turno terminó sin él. `extractCodexUsage` lee `total_token_usage`, que es acumulado del thread, y el sidecar resta lo ya registrado en la sesión para dejar la fila en el turno que acaba de correr. Los tokens cacheados de Codex se guardan aparte de la entrada porque Claude Code ya los reporta así; una fila significa lo mismo venga de donde venga.

Un turno que el proveedor no contabiliza no escribe fila. OpenCode no expone consumo en este seam y por tanto no registra nada: la ausencia de coste no es coste cero.

El enrutado automático de modelo **no se implementa todavía**. Se decide con los datos que esta contabilidad produzca.

## Alternatives Considered

### Enrutar el modelo ahora y medir después

Rechazado: sin línea base no se puede distinguir un ahorro de una regresión, y un misroute —modelo débil que falla y obliga a repetir con el fuerte— cuesta los dos turnos y contamina el transcript.

### Que el propio agente elija su modelo al empezar la tarea

Diferido, y es la variante peor de las tres. Juzgar bien la dificultad de una tarea exige el modelo fuerte, luego la autoselección es circular; una llamada clasificadora barata añade round-trip y falla justo en los casos frontera.

### Enrutado estructural determinista (opción preferida cuando haya datos)

Diferido, no descartado. La señal ya está en el turno y no cuesta tokens de decisión: los permisos concedidos —`write_docs`/`read_project` solos frente a `write_code`/`run_commands`—, los turnos sintéticos del propio sidecar (títulos, resúmenes, mensajes de commit) y la planificación o la gate ASK, que van siempre al tier fuerte. La regla que acompaña a esa decisión es cambiar de modelo en frontera de conversación, no dentro de un turno de una conversación viva, para no perder el prompt cache del provider. El operador debe seguir pudiendo fijar el modelo: el enrutado propondría el default, nunca ganaría a una elección explícita.

### Persistir el consumo en la fila de la conversación

Rechazado: agregaría el histórico y perdería la unidad que hace falta comparar, que es el turno; comparar modelos exige poder mirar turnos del mismo tipo.

## Consequences

- Cada conversación puede decir lo que consumió y cuánto de eso vino de cache, por turno y por modelo.
- La pregunta «¿ahorra enrutar modelos?» pasa a tener respuesta medible en este repositorio en lugar de heredada de otros productos.
- OpenCode queda sin contabilidad hasta que su seam exponga consumo; la tabla no inventa ceros por él.
- El total de Codex se reduce a turnos por diferencia; un thread que el CLI recuente desde cero registra lo que lee, nunca un turno negativo.
- La shell aún no muestra el consumo: la superficie se decide cuando haya historial suficiente para que signifique algo.
