# ADR-0001 — Documentation-first

## Status

Accepted

## Date

2026-09-02

## Context

ADE coordina intención humana, agentes, cambios, runtime y verificación. Sin documentación estructurada, el contexto se pierde, el onboarding depende de conocimiento tribal y los agentes no comparten una fuente de intención estable.

## Decision

La primera fase del proyecto se dedica a documentación tipo specs. La documentación se versiona junto al proyecto bajo `docu/`: `specs/` contiene el nexus y los contratos verificables, `adr/` conserva decisiones y `knowledge/` albergará conocimiento de producto y operación. El nexus centraliza el brief de producto, el alcance, el contrato del MVP y las decisiones abiertas.

Las decisiones no tomadas permanecen explícitas y no se convierten en supuestos ocultos. Toda modificación de una spec ejecuta el protocolo de sincronización de Spector.

## Alternatives considered

### Mantener `docs/` y `docu/specs/` en paralelo

- **Ventaja:** separación aparente entre documentación general y specs.
- **Rechazo:** duplica la fuente de verdad y permite que requisitos, MVP y arquitectura diverjan.

### Un único documento fundacional monolítico

- **Ventaja:** contexto completo en un solo lugar.
- **Rechazo:** dificulta revisar módulos, dependencias, criterios y cambios de forma independiente.

## Consequences

- `docu/` es la única jerarquía normativa; `docu/specs/` es la única fuente de specs y `docu/adr/` el único registro de decisiones.
- README e índices apuntan a esas rutas, no mantienen resúmenes normativos duplicados.
- Las specs son más largas y deben mantenerse sincronizadas mediante nexus y headings estables.
- El informe fundacional original permanece como fuente histórica externa, mientras la información operativa queda consolidada y versionable en el repositorio.
