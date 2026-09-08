# Spec: Agent Terminal History

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-terminal-history -->

**Estado:** done — implementada y verificada el 2026-09-08.

## Objective

Persistir, por Project, el historial de las terminales integradas que ejecutaron
Claude Code, Codex/ChatGPT Code u OpenCode. El usuario puede consultar y borrar
esas sesiones desde un popup del dock, con fecha/hora y título breve. Una
terminal manual nunca se guarda ni se resume.

Al finalizar una sesión elegible, Assay pide al mismo provider un título de
menos de 60 caracteres con su modelo económico: Claude `haiku`, Codex
`gpt-5.6-luna` y OpenCode su default local. Si no está disponible, conserva un
título local seguro y no bloquea el historial.

## Tech Stack

Tauri PTY y `xterm.js`; sidecar TypeScript, SQLite y los adapters de agentes
existentes. El resumen queda detrás del adapter del provider y no puede ejecutar
comandos ni alterar archivos.

## Commands

- `npm run build`
- `npm test`
- `node --check desktop/src/main.js`
- `cargo test --manifest-path desktop/src-tauri/Cargo.toml`

## Project Structure

- `desktop/src/`: botón, popup accesible, reanudación por id y borrado.
- `src/persistence/`: tabla, migración y operaciones por Project.
- `src/application/` y `src/adapters/`: detección, título seguro y resolución
  del id de conversación desde el almacén del agente.
- `src/desktop-sidecar.ts`: listar, leer y borrar, siempre validados por Project.
- `tests/`: migración, aislamiento, detección, fallback y contrato de UI.

## Code Style

```ts
if (session.projectId !== params.projectId) throw new Error("This terminal session belongs to another Project");
row.innerHTML = `<strong>${escapeHTML(session.title)}</strong>`;
```

Fechas ISO-8601 UTC, IDs opacos y operaciones de persistencia explícitas.

## Product Contract

### Elegibilidad y captura

- La sesión empieza como terminal manual no persistida.
- Se vuelve elegible cuando la entrada invoca `claude`, `codex` u `opencode`,
  incluyendo `.cmd`, `.exe` o una ruta que termine en dichos ejecutables. La
  detección se hace sobre el ejecutable, nunca sobre argumentos ni salida.
- La primera invocación reconocida fija el provider y sólo entonces se captura
  entrada/salida, con un límite explícito y marca de truncamiento.
- Al cerrar la tab o detener la app, una sesión elegible se persiste con
  `startedAt`, `endedAt`, provider, título, transcript y el id de conversación
  del agente cuando se resuelve. Una manual no genera fila ni llamada al modelo.

### Historial y UI

- El dock no añade un panel permanente. Un botón `Terminal history` junto a `+`
  abre un popup anclado, con `aria-expanded`, navegación de teclado, Escape y
  cierre por click exterior.
- Lista sólo sesiones del Project activo, recientes primero: título, provider y
  fecha/hora local. Abrir una sesión crea una terminal real y reanuda *esa*
  conversación por su identificador nativo: `claude --resume <id>` o
  `codex resume <id>`. El historial de mensajes lo restaura el agente, no Assay.
- El identificador se resuelve al guardar, leyendo el almacén de sesiones del
  propio agente (`~/.claude/projects/`, `~/.codex/sessions/`) acotado por
  directorio de trabajo y ventana temporal; nunca se extrae de los bytes del
  PTY. Sin coincidencia inequívoca se abre el selector nativo del provider.
- OpenCode no expone reanudación por id en su CLI: usa `--continue`, que retoma
  su última sesión del Project.
- No se intenta reconstruir un TUI desde bytes PTY: sus pantallas alternativas
  no representan una conversación recuperable.
- Borrar pide confirmación y elimina transcript/metadatos sin tocar repositorio
  ni sesiones de Agents. Cambiar Project cierra el popup y aísla los datos.

## Testing Strategy

Tests SQLite de migración, orden, lectura, borrado y aislamiento; detección de
ejecutables frente a argumentos; resolución del id de conversación por
directorio, ventana temporal e ids ya asignados; resumen acotado y fallback;
sidecar que rechaza acceso cruzado y persiste aunque la resolución falle; y
contrato UI para popup, fecha, accesibilidad, reanudación por id y ausencia de
superficie persistente.

## Boundaries

- **Always:** aislar por Project, mostrar fecha/hora, permitir borrar y escapar
  contenido persistido.
- **Ask first:** añadir providers, aumentar el límite de transcript o resumir
  con un provider distinto.
- **Never:** guardar terminales manuales, reproducir un transcript PTY para
  fingir una conversación reanudada, deducir el id de sesión de la salida del
  PTY, ejecutar comandos durante el resumen ni mostrar datos de otro Project.

## Success Criteria

- Una terminal con `claude`, `codex` u `opencode` cerrada aparece con título y
  fecha/hora; una manual no aparece.
- El título usa el provider de la sesión o un fallback visible.
- Reabrir una sesión de Claude o Codex restaura sus mensajes anteriores sin
  pasar por el selector; una sesión sin id resuelto abre el selector nativo.
- Reabrir una sesión no hace crecer su transcript almacenado.
- Se puede borrar la conversación tras confirmar.
- El historial sobrevive al reinicio y no afecta a Agents, archivos u otros
  Projects; el popup no ocupa espacio cerrado.

## Open Questions

Ninguna para este corte: la captura empieza en la primera orden reconocida y
termina al cerrar la pestaña o la aplicación.
