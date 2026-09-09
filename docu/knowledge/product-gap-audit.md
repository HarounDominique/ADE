---
id: product-gap-audit
class: operational
status: open
updatedAt: 2026-09-08
source: ADE-source-audit
---

# Auditoría de huecos de producto — 2026-09-08

## Propósito y método

Este documento registra los huecos entre lo que Assay promete en `PRODUCT.md`, `SPEC-NEXUS` y sus specs, y lo que el código sostiene hoy. No propone superficie nueva: nombra lo que impide que el bucle `intención → cambio → verificación → review → aprobación → commit` se cierre, con la evidencia en el propio repositorio.

Cada hueco cita fichero y línea de la revisión del 2026-09-08. Las líneas se mueven; el hecho descrito es lo que hay que verificar antes de darlo por cerrado.

## G1 — El workbench y el pipeline de gobierno no se tocan *(cerrado el 2026-09-09)*

**Qué pasa.** `Agents` —la superficie de trabajo diaria, con Claude Code y Codex— persiste mensajes y muestra el diff del turno, pero no crea `ChangeSet`, ni evidencia, ni gates, ni review. El pipeline que sí lo hace (`task.run` → `runSpike`) instancia `OpenCodeHttpRuntime` de forma fija en `src/desktop-sidecar.ts` y se apoya en `runtime.events()`, que los adapters CLI devuelven vacío (`src/adapters/claude-cli-runtime.ts`, `src/adapters/codex-cli-runtime.ts`).

**Consecuencia de producto.** El diferenciador declarado —la `Task` trazable de la intención a la review— sólo existe con el proveedor que el usuario menos ejecuta, y nunca desde la pantalla donde trabaja. Sin esto, el resto del producto es un IDE con chat.

**Dirección.** Un turno de `Agents` que toca el repositorio debe producir el mismo `ChangeSet` y la misma evidencia que produce `task.run`, sea cual sea el proveedor. El puerto ya expone `diff`; lo que falta es la aplicación que lo convierte en ChangeSet ligado a la Task activa.

**Cerrado el 2026-09-09** por [ADR-0043](../adr/0043-agent-turn-as-pipeline-entry.md): la captura vive en `src/application/agents/capture-turn-change-set.ts`, un turno con cambios produce ChangeSet por turno y evidencia `agent.turn`, la Task avanza sólo por transiciones legales, y `task.run` usa el proveedor que la petición pida en lugar de OpenCode fijo. Queda abierto que el ChangeSet retrata el working tree completo y no el delta del turno, lo que depende de G6.

## G2 — La gate `tests` no puede pasar y `build` no comprueba nada *(cerrado el 2026-09-09)*

**Qué pasa.** `src/application/change-review-read-model.ts` da `tests` por pasada cuando existe evidencia de tipo `verification`, y ningún punto del código escribe ese tipo. La gate `build` se da por pasada por la mera existencia de un `ChangeSet`, que no es una build.

**Consecuencia de producto.** Con la policy por defecto (`build, tests, agent-review, documentation-review, human-approval`) la aprobación humana queda bloqueada de forma permanente: el bucle no cierra. Contradice el principio *Verification-first* y la fila del Truth model que reserva a tests y runtime el papel de evidencia comportamental.

**Dirección.** `build` y `tests` deben venir de una ejecución real con código de salida y salida capturada, no de un proxy estructural. Una gate sin productor no debería ser `required` por defecto.

**Cerrado el 2026-09-09** por [ADR-0044](../adr/0044-verification-gates-from-real-runs.md): las gates leen la evidencia `verification.<qué>.pass|fail` más reciente y una gate sin ejecución queda `pending`.

## G3 — Assay ya sabe ejecutar build y tests, y no lo conecta *(cerrado el 2026-09-09)*

**Qué pasa.** `run-configurations` detecta y ejecuta build, test y lint para Node, Python, Maven/Gradle, Rust, Go y .NET, con consola por ejecución (`src/application/local-runtime/`). Ni el código de salida ni la salida alimentan evidencia ni gates.

**Consecuencia de producto.** El camino más corto y barato para arreglar G2 ya está construido y desconectado.

**Dirección.** Una ejecución de configuración marcada como verificación escribe `RuntimeEvidence` con su código de salida y una cola de salida acotada, ligada a la Task activa; `build` y `tests` leen esa evidencia.

**Cerrado el 2026-09-09**: `verifies` viaja en la configuración, la detección lo propone para build y test, y el sidecar escribe la evidencia al terminar el proceso.

## G4 — Aprobar no publica nada *(cerrado el 2026-09-09)*

**Qué pasa.** No existe un seam `ship`. `task.approve` persiste la aprobación humana y ahí termina; el commit se hace a mano desde `Version control`.

**Consecuencia de producto.** La cadena `intención → commit` se rompe justo en el último eslabón, que es el que el usuario recordará.

**Cerrado el 2026-09-09** por [ADR-0045](../adr/0045-ship-the-approved-task.md): `task.ship` commitea sólo con aprobación y gates en `passed`/`waived`, registra la operación contra la Task, y `Approve`/`Ship`/`Re-review` recuperan superficie en el detalle de la Task. Al cablearlo se descubrió que ese panel había desaparecido de la shell y que aprobar era inejecutable.

## G5 — El commit principal no se atribuye a la Task *(cerrado el 2026-09-09)*

**Qué pasa.** El envío de `git.commit.create` desde `Version control` no incluye `taskId` (`desktop/src/main.js`), y el sidecar sólo registra la operación Git contra la Task cuando ese parámetro llega (`src/desktop-sidecar.ts`).

**Consecuencia de producto.** `PRODUCT.md` promete commits atribuidos a Tasks; el camino que el usuario usa a diario no los atribuye.

**Cerrado el 2026-09-09**: el commit de `Version control` envía `taskId` cuando hay una Task seleccionada.

## G6 — Un turno con escritura no es reversible *(cerrado el 2026-09-09)*

**Qué pasa.** Un turno con `write_code` modifica el árbol sin punto de retorno propio. Deshacer es un trabajo manual de Git.

**Consecuencia de producto.** El principio *Observable and reversible* queda sostenido sólo por Git y por la disciplina del usuario. Los checkpoints automáticos están fuera de alcance declarado; un checkpoint explícito por turno con escritura no lo está.

**Cerrado el 2026-09-09** por [ADR-0048](../adr/0048-checkpoint-before-a-writing-turn.md): antes de un turno con `write_code`/`write_docs` sobre una Task, `src/application/agents/turn-checkpoint.ts` fotografía el working tree completo como commit sin rama bajo `refs/ade/checkpoints/`, sin tocar `HEAD`, la rama ni el índice del operador. La Task lista sus checkpoints y restaurar exige confirmación explícita, dejando a su vez un checkpoint del estado que descarta. Queda abierta la retención de esas referencias y el cálculo del delta del turno que ahora sería posible.

## G7 — El coste del trabajo agéntico es invisible *(cerrado el 2026-09-09)*

**Qué pasa.** Desde [ADR-0040](../adr/0040-agent-turn-accounting.md) cada turno registra su consumo en `agent_turn_usage`. Ninguna superficie lo lee.

**Consecuencia de producto.** Una workstation agéntica que no sabe decir lo que costó una Task deja sin responder una pregunta que el usuario se hace a diario.

**Cerrado el 2026-09-09** por [ADR-0049](../adr/0049-turn-cost-read-where-the-work-is.md): el consumo se lee por turno en su traza, por conversación bajo los diales del rail y por Task en su detalle, con la cache dicha aparte de la entrada. Una unidad sin contabilidad —OpenCode hoy— se muestra como desconocida y nunca como cero, y un total con turnos sin precio dice de cuántos turnos habla.

## G8 — Instalar y actualizar es manual

**Qué pasa.** El `.dmg` sigue diferido por el fallo de `bundle_dmg.sh` del entorno y no hay mecanismo de actualización: instalar una versión nueva es reemplazar el bundle a mano en `/Applications`.

**Consecuencia de producto.** Cada iteración cuesta una operación manual y no hay forma de saber, desde la app, si está desactualizada.

## Orden propuesto

| Prioridad | Hueco | Razón |
|---|---|---|
| ~~P0~~ | ~~G1~~ | Cerrado el 2026-09-09 — [ADR-0043](../adr/0043-agent-turn-as-pipeline-entry.md) |
| ~~P0~~ | ~~G2 + G3~~ | Cerrado el 2026-09-09 — [ADR-0044](../adr/0044-verification-gates-from-real-runs.md) |
| ~~P1~~ | ~~G4 + G5~~ | Cerrado el 2026-09-09 — [ADR-0045](../adr/0045-ship-the-approved-task.md) |
| ~~P1~~ | ~~G6~~ | Cerrado el 2026-09-09 — [ADR-0048](../adr/0048-checkpoint-before-a-writing-turn.md) |
| ~~P2~~ | ~~G7~~ | Cerrado el 2026-09-09 — [ADR-0049](../adr/0049-turn-cost-read-where-the-work-is.md) |
| P2 | G8 | Fricción de distribución, no de producto |

## Fuera de alcance de esta auditoría

Retrieval semántico, cloud, colaboración en tiempo real, editor completo y enrutado automático de modelos siguen diferidos por decisión previa; ninguno de ellos es la causa de los huecos anteriores. Añadir superficie nueva antes de cerrar G1–G3 aumenta la distancia entre lo prometido y lo sostenible.

## Riesgo de documentación

`PRODUCT.md` y `SPEC-NEXUS` describen el flujo completo como capacidad disponible. Con G1 a G5 cerrados el 2026-09-09 esa afirmación se sostiene de la intención al commit atribuido; con G6 cerrado el mismo día la reversibilidad del turno deja de depender de la disciplina del operador; y con G7 el coste del trabajo agéntico deja de ser invisible; lo que sigue abierto es la distribución (G8). En un producto cuyo argumento es la verificabilidad, esa distancia es el riesgo más caro del inventario y se corrige nombrándola, no parcheándola en silencio.
