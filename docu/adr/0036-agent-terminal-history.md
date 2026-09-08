# ADR-0036 — Historial sólo para terminales que ejecutan agentes

## Status

Accepted

## Date

2026-09-08

## Context

El dock de terminal es una superficie general: persistir todo lo que el usuario
escribe convertiría actividad manual y posiblemente sensible en historial de
Assay. Sin embargo, las conversaciones de agentes CLI son evidencia útil y se
pierden al cerrar la pestaña.

## Decision

Assay captura una sesión únicamente desde la primera invocación simple de
`claude`, `codex` o `opencode`. La conversación se guarda por Project al cerrar
la pestaña y se consulta desde un popup del dock; el transcript guardado nunca
se reproduce como PTY.

Al guardar, Assay resuelve además el identificador nativo de la conversación
leyendo el almacén de sesiones del propio agente —`~/.claude/projects/<cwd>/
<uuid>.jsonl` para Claude y la línea `session_meta` de `~/.codex/sessions/...`
para Codex—, exigiendo que la conversación *naciera* dentro de la sesión de la
terminal y en su directorio de trabajo. La fecha de modificación no sirve: una
sesión de agente viva en el mismo directorio se reescribe sin parar y ganaría
siempre. Reabrir una
sesión ejecuta `claude --resume <id>` o `codex resume <id>`, de modo que el
historial lo restaura el agente, no Assay. Sin coincidencia inequívoca se cae al
selector nativo del provider.

El título se solicita asíncronamente al mismo provider, usando Haiku para Claude
y Luna para Codex; OpenCode conserva su modelo local default. El fallback local
permite conservar la sesión aunque el provider no esté disponible.

## Alternatives considered

### Guardar toda terminal

Rechazado: confunde uso manual con conversaciones de agente y aumenta sin
necesidad la superficie de privacidad.

### Inferir al agente desde la salida del PTY

Rechazado: banners y texto pueden simularse; la orden ejecutable es una señal
más estrecha y auditable. Por lo mismo, el identificador de conversación se lee
del almacén del agente y nunca se extrae de los bytes del PTY.

### Reproducir el transcript guardado en la terminal reabierta

Rechazado: el proceso del agente no recuerda ese texto y su TUI lo sobrescribe
en cuanto pinta su pantalla alternativa. Aparenta una conversación reanudada sin
serlo, y al persistir de nuevo duplica la fila.

### Lanzar el agente con `--session-id` acuñado por Assay

Rechazado en este corte: el operador escribe la orden en un PTY y sus bytes ya
salieron cuando se reconoce el ejecutable. Cambiaría además el contrato de
elegibilidad, que exige decisión explícita.

## Consequences

- Aliases, wrappers y pipelines pueden no reconocerse hasta tener un contrato
  explícito; se prefiere el falso negativo.
- Los transcripts quedan locales, aislados por Project y eliminables.
- El resumen no puede ejecutar comandos ni modificar el Project.
- OpenCode guarda sus sesiones en SQLite y no expone reanudación por id en su
  CLI: conserva `--continue`, que retoma la última conversación del Project.
- Dos terminales del mismo Project abiertas a la vez pueden no distinguirse; el
  id ya asignado a otra fila se descarta y, ante la duda, se ofrece el selector.
- Una conversación reanudada dentro de la terminal (`claude --resume` a mano) no
  nace en la ventana, así que no se le atribuye id: se ofrece el selector.
- Un sistema de archivos sin fecha de creación fiable nunca resuelve id.
