# ADR-0027: Selección de modelo dependiente del provider

## Status

Accepted

## Date

2026-09-05

## Context

La vista `Agents` permite alternar entre OpenCode, Codex y Claude Code. Un selector global de modelos produciría elecciones incompatibles o engañosas porque cada runtime reconoce aliases y configuraciones diferentes. Además, al cambiar de conversación el modelo visible debe seguir representando al agente activo.

## Decision

`AgentProvider` declara un catálogo de modelos para su selector. Todos incluyen `Provider default`, que no envía override y deja la configuración al runtime. Codex expone los aliases `gpt-5.5`, `gpt-5.4` y `gpt-5.4-mini`; Claude Code expone `opus`, `sonnet` y `haiku`; OpenCode ofrece inicialmente sólo el default porque su descubrimiento de modelos queda pendiente de un contrato estable del endpoint.

El selector vive junto a los permisos en el footer del composer. Al cambiar provider o conversación se reconstruye inmediatamente y se descarta cualquier alias que no pertenezca al nuevo catálogo. El valor no-default se incluye en `AgentPromptInput` y el sidecar lo traduce a `--model` para CLIs o `model` para HTTP. La elección se mantiene en memoria por conversación durante la sesión de ADE, sin añadir credenciales ni configuración privada a SQLite.

## Alternatives Considered

### Un catálogo global común

Rechazado: mezcla modelos que no necesariamente existen en el provider activo y permite enviar opciones inválidas.

### Descubrir siempre modelos desde cada proveedor

Diferido: Claude Code y Codex no ofrecen en este seam una lista portable de modelos autenticados, y OpenCode requiere acordar el formato de su endpoint. El catálogo inicial usa aliases documentados por cada CLI y conserva `Provider default` como opción segura.

### Persistir el modelo en cada sesión

Diferido: la persistencia actual de sesiones no necesita ampliar SQLite para esta primera iteración; el modelo se mantiene en memoria y se restablece a default al rehidratar una conversación sin selección local.

## Consequences

- El usuario puede elegir un modelo desde el mismo lugar que los permisos, sin abandonar la conversación.
- Codex y Claude Code reciben realmente el alias elegido; OpenCode queda preparado para descubrimiento futuro sin inventar opciones.
- Cambiar de conversación no arrastra un modelo incompatible.
- Si el alias no está habilitado por la cuenta o instalación, el runtime devuelve el error y ADE lo muestra como feedback del turno.
