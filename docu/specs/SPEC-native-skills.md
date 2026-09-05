# Spec: Native Skills

<!-- Nexus: SPEC-NEXUS.md | Module id: native-skills -->

## Objective

Distribuir un catálogo nativo de skills comunes y permitir instalar, actualizar, modificar o crear skills sin romper la trazabilidad del workflow.

## Initial Catalog

Prompt engineering, PR review, Spector/spec-driven development, workflow adaptativo, UML, documentación funcional para QA, estimación de tareas, Git/GitHub y reconciliación documental.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`. El catálogo y la ejecución se consultan mediante las operaciones `skills.list`, `skills.run`, `skills.install` y `skills.update` del sidecar; la CLI `npm run ade` no expone todavía un subcomando de skills.

## Project Structure

`.ade/skills/` contiene skills del Project; el paquete nativo vive en `skills/`; el registro y runners viven en `src/application/skills/`; el sidecar expone el contrato a la shell. La vista primaria `Agents` no incluye gestión de skills para preservar el espacio de conversación; las skills siguen disponibles para Tasks y operaciones del sidecar.

## Code Style

```json
{
  "id": "spector",
  "version": "1.0.0",
  "inputs": ["intent", "changed_specs"],
  "outputs": ["specs", "nexus_updates", "findings"],
  "permissions": ["read_project", "write_docs"]
}
```

Los manifests se instalan desde un `.json` local o un repositorio Git (URL o `owner/repository`) mediante `skills.install`; ADE escribe `.ade/skills/<id>.json`, conserva el origen, la fecha y `installedFrom`. Una fuente de red se identifica antes de clonar y exige `confirmed`: sin consentimiento explícito el sidecar responde `SKILL_INSTALL_CONFIRMATION_REQUIRED` y no ejecuta ninguna operación de red.

`skills.update` vuelve a obtener una skill de Project desde `installedFrom` y rechaza un manifest con otro `id`. Si ese origen es remoto, exige el mismo consentimiento explícito antes de clonar; una skill antigua sin origen queda ejecutable, pero informa que no puede actualizarse automáticamente. El catálogo/sidecar distingue skills nativas y de Project, conserva su origen y sólo permite actualizar cuando la procedencia es trazable.

## Testing Strategy

Validación de manifest, compatibilidad, permisos, inputs/outputs, instalación y regresión de skills nativas.

## Boundaries

- Always: versionar, atribuir y poder desactivar cada skill; `read_project` y `write_docs` se conceden dentro del Project porque las modificaciones documentales son intención explícita de producto.
- Ask first: conceder por ejecución `write_code`, `run_commands` o `network`; ADE muestra los permisos solicitados y persiste la sesión con estado `RUNNING`, `COMPLETED` o `FAILED`.
- Never: ejecutar una skill sin declarar permisos ni ocultar qué produjo.

## Success Criteria

Un Project nuevo tiene un catálogo de skills y el usuario puede añadir o actualizar una skill propia con versión, permisos y trazabilidad de origen.

## Open Questions

- ¿Formato único compatible con Codex, OpenCode y otros agentes?
- ¿Marketplace remoto o sólo repositorios locales/Git?
