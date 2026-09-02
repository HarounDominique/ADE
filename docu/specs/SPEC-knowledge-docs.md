# Spec: Knowledge and Documentation

<!-- Nexus: SPEC-NEXUS.md | Module id: knowledge-docs -->

## Objective

Convertir documentación, skills e instrucciones en contexto seleccionable y gobernado para cada Task, evitando contexto excesivo y documentation drift.

## Knowledge contract

La documentación se organiza en tres clases: `canonical` (visión, arquitectura, dominio, seguridad y ADRs), `operational` (roadmap, estado, problemas y deuda) y `agent` (convenciones, testing, mapa e instrucciones). La recuperación combina intención, rutas afectadas, módulos, referencias explícitas, metadata e historial; embeddings son una evolución, no un requisito de v0.1.

Una modificación puede producir impacto `required`, `recommended` o `none`. ADE detecta drift potencial y presenta evidencia y opciones; no modifica documentación canónica silenciosamente.

## Document contract

Todo documento gobernado por ADE debe tener metadata mínima:

```yaml
id: stable-document-id
class: canonical | operational | agent
status: draft | active | deprecated
updatedAt: 2026-09-02
source: human | agent | external
```

Las specs y ADRs mantienen su formato actual y sus headings estables; esta metadata se aplicará primero a documentos nuevos de `docu/knowledge/`. Cada documento debe declarar propósito, audiencia y enlaces a otros módulos mediante `module-id#heading-slug`.

La resolución devuelve documentos completos identificados por `id`, motivo de selección y señales usadas (`explicit-reference`, `path`, `module`, `intent` o `metadata`). El resolver no devuelve contenido sin trazabilidad de por qué fue incluido.

## Impact and drift contract

El impacto documental se calcula determinísticamente en v0.1:

- `required`: cambia contrato público, estado, gate, decisión arquitectónica o comportamiento descrito por una spec.
- `recommended`: cambia una ruta, comando, ejemplo, limitación o explicación operativa.
- `none`: no cambia significado documental.

Un enlace a un heading inexistente es un drift bloqueante para `required` y una alerta para `recommended`. La reconciliación registra documento afectado, impacto, decisión (`updated`, `not-applicable` o `deferred`), actor, razón y evidencia. No se aceptan embeddings ni un índice propietario como requisito del MVP.

## Project Structure

```text
docu/specs/                 → Specs y nexus
docu/adr/                   → Decisiones arquitectónicas
docu/knowledge/             → Conocimiento canónico/operativo del producto
.ade/                       → Configuración portable futura
```

Taxonomía: `canonical`, `operational` y `agent`. El código, docs y skills permanecen en Git cuando sea posible.

## Commands

Mientras no exista el resolver ejecutable, las comprobaciones documentales reproducibles son:

```bash
rg --files docu/specs docu/adr docu/knowledge
rg -n 'SPEC-[^)]*#[a-z0-9-]+' docu/specs docu/adr
git diff --check
npm run build && npm test
```

La futura CLI `npm run docs:check` debe agrupar validación de metadata, headings, enlaces y drift sin modificar documentos.

## Code Style

Cada documento debe declarar propósito, estado, fecha, fuente y enlaces por heading estable. Las specs citan `SPEC-<id>.md#heading-slug`, no líneas.

## Testing Strategy

Tests de resolver para referencia explícita, rutas, módulos y metadata; tests de enlaces y headings; fixtures de cada nivel de drift; tests de que documentos `canonical` nunca se modifican silenciosamente; revisión manual de documentos canónicos. Embeddings quedan fuera del MVP.

## Boundaries

- **Always:** distinguir conocimiento de memoria histórica; versionar documentos; mostrar evidencia del impacto documental.
- **Ask first:** cambiar documentos canónicos automáticamente, imponer taxonomía, añadir proveedor de embeddings o formato propietario.
- **Never:** reemplazar documentación por una memoria IA opaca; inyectar todo el repositorio en cada prompt; actualizar canonical sin política.

## Success Criteria

Una Task puede resolver un conjunto pequeño y justificable de documentos relevantes; un cambio puede marcar impacto `required`, `recommended` o `none`; un gate documental impide completar cuando el impacto requerido no está reconciliado.

## v0.1 decisions

- Las reglas deterministas bastan para v0.1; el resolver debe explicar sus señales y no simular relevancia semántica.
- La metadata mínima es `id`, `class`, `status`, `updatedAt` y `source`, más propósito y audiencia en el cuerpo.
- `docu/knowledge/` es la convención por defecto para conocimiento nuevo; specs y ADRs conservan sus carpetas normativas.

## Open Questions

- ¿Qué heurística de rutas y módulos se configura por Project?
- ¿Cómo se aprueba una reconciliación `deferred` y durante cuánto tiempo puede permanecer abierta?
- ¿Qué formato portable tendrá la configuración `.ade/` cuando se implemente el resolver?
