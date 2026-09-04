# Plan: Desktop shell vertical mínima

<!-- Spec: docu/specs/SPEC-desktop-shell.md#shell-contract -->
<!-- ADR: docu/adr/0008-thin-desktop-shell.md -->

**Estado:** completado y validado en macOS. Este plan conserva el orden histórico de implementación de la vertical desktop.

## Objective

Construir la primera experiencia visible de ADE alrededor de un Project y una Task, mostrando estado, ejecución, evidencia y gates sin convertirse en un editor.

## Vertical slice

```text
OPEN PROJECT → CREATE TASK → OBSERVE BUILD → REVIEW CHANGE
       → RECONCILE DOCS → HUMAN APPROVAL → PREPARE SHIP
```

La primera entrega debe poder ejecutarse con adapters fake y sustituirlos por los adapters reales sin cambiar la navegación.

## Screens and responsibilities

1. **Project Hub:** Project, raíz Git, branch, Tasks activas, servicios y gate bloqueante.
2. **Work:** crear/reanudar Task, intención, modo, fase y actividad de la sesión.
3. **Changes:** ChangeSet, diff, Review, findings y acciones con razón.
4. **Knowledge:** documentos seleccionados, motivo de inclusión e impacto pendiente.
5. **Runtime:** procesos, health, logs, tests y cancelación.

## Implementation order

1. Shell estático con navegación y estados `loading/ready/empty/blocked/failed/stale`. ✅
2. Project Hub conectado a consultas de Project y Task. ✅
3. Work conectado a creación/reanudación y eventos de runtime. ✅
4. Changes conectado a ChangeSet/Review y gates. ✅
5. Knowledge y Runtime con datos reales de sus puertos. ✅
6. Aprobación humana y preparación de `ship` con guardas visibles. ✅

## Acceptance criteria

- Un usuario puede abrir un repositorio y ver su Project sin salir del shell.
- Puede crear una Task con intención y observar el último estado confirmado.
- Puede consultar ChangeSet, Review y findings sin abrir un editor externo.
- Una gate fallida muestra evidencia y fase de reentrada.
- `ship` permanece deshabilitado sin aprobación humana o con gates pendientes.
- Terminal/IDE externo se abre sobre la raíz del Project como escape hatch.

## Verification

```bash
npm run build
npm test
npm run desktop:test
```

El test end-to-end de la vertical usa adapters fake y cubre el recorrido completo. El smoke test posterior se ejecuta en macOS con el framework desktop elegido.

## Out of scope

Editor completo, language server, autocompletado general de comandos, colaboración realtime, cloud y worktrees paralelos.
