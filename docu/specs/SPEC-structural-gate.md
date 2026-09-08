# Spec: Structural Gate

<!-- Nexus: SPEC-NEXUS.md | Module id: structural-gate -->

## Objective

Convertir la evidencia estructural de un analizador externo en una gate citable de Assay, sin que Assay adopte el análisis ni el analizador adopte el workflow. El primer proveedor es ASK Engine (`ask pack gate`); el contrato admite otros.

## Commands

`npm run build`; `npm test`; `npm test tests/ask-gate.test.ts`. En runtime, la operación del sidecar es `gate.ask`:

```json
{"id":"g1","method":"gate.ask","params":{"repositoryPath":"/ruta/al/proyecto","since":"origin/main","taskId":"task-42","grantedPermissions":["run_commands"]}}
```

`since`, `profile` y `taskId` son opcionales. Sin `taskId` la respuesta es un veredicto de lectura; con `taskId` el veredicto se persiste como evidencia y la gate del Task lo refleja.

## Project Structure

`skills/ask-gate.json` es el manifest distribuible; `.ade/skills/ask-gate.json` es su instalación por Project. `src/adapters/ask-command.ts` resuelve el ejecutable y ejecuta; `src/application/gates/ask-gate.ts` traduce el pack a `Gate`; `src/application/change-review-read-model.ts` publica `structural-gate` desde la evidencia; `src/desktop-sidecar.ts` expone `gate.ask`.

## Verdict Contract

| ASK | Exit | `Gate.status` | Lectura |
| --- | --- | --- | --- |
| `PASS` | 0 | `passed` | ningún componente estableció bloqueo y todos pudieron decidir |
| `BLOCK` | 1 | `failed` | un componente estableció un cambio bloqueante en su payload |
| `UNVERIFIED` | 2 | `pending` | no se probó nada en ninguna dirección |

`UNVERIFIED` nunca se convierte en `passed`. Un veredicto que ASK no pudo imprimir es un error con lo que ASK dijo, no una gate que pasa. Un exit distinto de cero es una respuesta que leer, no un fallo que elevar: el veredicto se lee del payload, nunca del código de salida.

## Authorization

La skill de Project es la unidad de autorización. `gate.ask` exige que `.ade/skills/ask-gate.json` esté instalada y que la ejecución conceda `run_commands`; un Project que no la instala nunca lanza el proceso. La skill declara `read_project` y `run_commands`, no `network`: `ask pack gate` es análisis local.

## Opt-in por Project

`structural-gate` no está en la política por defecto. Un Project la exige declarándola en `.ade/policy.json`:

```json
{"requiredGates":["build","tests","agent-review","documentation-review","structural-gate","human-approval"]}
```

Un Project que no la declara conserva sus gates actuales y puede seguir ejecutando `gate.ask` como lectura.

## Executable Resolution

`ADE_ASK_COMMAND` gana sobre cualquier descubrimiento. Si no está, se recorre el `PATH` heredado antes que los prefijos estándar (`~/.local/bin`, Homebrew, `/usr/local/bin`, `%APPDATA%\Python\Scripts`): ASK se instala por intérprete y el `PATH` del operador es la mejor evidencia de qué build quiere. Un ejecutable ausente responde `ASK_UNAVAILABLE` con la instrucción de instalación.

## Autonomous use by the agent

Un agente no puede elegir una herramienta que no sabe que existe. Cuando el Project es Java —declarado por su propio build file o por un source root convencional— y `ask` está instalado en la máquina, `agent.prompt` antepone al turno un briefing corto: qué es ASK, los comandos que pagan, y su frontera. El agente decide si lo usa; ADE no ejecuta nada en su nombre.

El briefing se escribe **sólo** si se cumplen ambas condiciones, y nunca se persiste: la conversación guarda el prompt del operador, no el preámbulo. Un Project lo desactiva con `"structuralBriefing": false` en `.ade/policy.json`.

La detección es acotada porque corre en cada turno: seis niveles, 4.000 entradas, salida temprana al confirmar Java más build file, y directorios de build y dependencias excluidos. Java que sólo vive en un fixture de tests no es un repositorio Java: sin build file propio (raíz o módulo) ni `src/main/java`, no hay briefing. Medido: 7 ms en este repositorio, 12 ms en uno de ~4.000 ficheros.

Lo que esto **no** hace: no inyecta contexto pre-calculado, no llama a ASK por el agente, y no alcanza a las terminales PTY —ahí el agente lo lanza el operador y ADE no compone el prompt.

## Testing Strategy

`tests/ask-briefing.test.ts` cubre detección de Spring, Java sin Spring, fixture ajeno, módulo, source root convencional, exclusión de build/dependencias, desactivación por política y preservación literal del prompt. `tests/ask-gate.test.ts` cubre resolución de ejecutable por plataforma, mapeo de los tres veredictos, construcción del comando, ausencia de skill, permiso no concedido, salida ilegible, esquema inesperado, rechazo declarado por ASK y precedencia del veredicto más reciente en el read model. La ejecución real se prueba contra el binario instalado; los tests inyectan el runner y no dependen de que ASK esté presente.

## Boundaries

- Always: citar el veredicto con la evidencia que lo produjo, la versión de la herramienta y el comando exacto.
- Ask first: ejecutar el analizador — es `run_commands` por ejecución.
- Never: traducir `UNVERIFIED` a `passed`, ni sustituir el juicio humano por el veredicto de la herramienta.

## Success Criteria

Un Project con ASK instalado obtiene, sobre un cambio, un veredicto trazable que aparece como gate del Task con su evidencia; un Project sin ASK obtiene un error accionable y ninguna gate falsa.

## Open Questions

- ¿Debe la shell ofrecer el veredicto en `Version control` además de en la gate del Task?
- ¿Se generaliza el contrato a otros proveedores de evidencia estructural (`structural-gate` con `provider`) o queda ligado a ASK?
- ¿Se exporta el SARIF de `ask pack gate` como artefacto del ChangeSet?
