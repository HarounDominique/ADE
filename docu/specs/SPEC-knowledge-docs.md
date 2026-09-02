# Spec: Knowledge and Documentation

<!-- Nexus: SPEC-NEXUS.md | Module id: knowledge-docs -->

## Objective

Convertir documentación, skills e instrucciones en contexto seleccionable y gobernado para cada Task, evitando contexto excesivo y documentation drift.

## Knowledge contract

La documentación se organiza en tres clases: `canonical` (visión, arquitectura, dominio, seguridad y ADRs), `operational` (roadmap, estado, problemas y deuda) y `agent` (convenciones, testing, mapa e instrucciones). La recuperación combina intención, rutas afectadas, módulos, referencias explícitas, metadata e historial; embeddings son una evolución, no un requisito de v0.1.

Una modificación puede producir impacto `required`, `recommended` o `none`. ADE detecta drift potencial y presenta evidencia y opciones; no modifica documentación canónica silenciosamente.

## Project Structure

```text
docu/specs/                 → Specs y nexus
docu/adr/                   → Decisiones arquitectónicas
docu/knowledge/             → Conocimiento canónico/operativo del producto
.ade/                       → Configuración portable futura
```

Taxonomía: `canonical`, `operational` y `agent`. El código, docs y skills permanecen en Git cuando sea posible.

## Commands

Pendientes: el spike debe definir comandos de validación de enlaces, formato y detección de drift.

## Code Style

Cada documento debe declarar propósito, estado, fecha, fuente y enlaces por heading estable. Las specs citan `SPEC-<id>.md#heading-slug`, no líneas.

## Testing Strategy

Tests de resolver que comprueben selección por referencia explícita, rutas y módulos; tests de enlaces; fixtures de drift; revisión manual de documentos canónicos. Embeddings quedan fuera del MVP.

## Boundaries

- **Always:** distinguir conocimiento de memoria histórica; versionar documentos; mostrar evidencia del impacto documental.
- **Ask first:** cambiar documentos canónicos automáticamente, imponer taxonomía, añadir proveedor de embeddings o formato propietario.
- **Never:** reemplazar documentación por una memoria IA opaca; inyectar todo el repositorio en cada prompt; actualizar canonical sin política.

## Success Criteria

Una Task puede resolver un conjunto pequeño y justificable de documentos relevantes; un cambio puede marcar impacto `required`, `recommended` o `none`; un gate documental impide completar cuando el impacto requerido no está reconciliado.

## Open Questions

- ¿Reglas deterministas bastan para v0.1?
- ¿Qué metadata mínima tendrá un Document?
- ¿`docu/knowledge/` debe ser una carpeta obligatoria o sólo una convención configurable?
