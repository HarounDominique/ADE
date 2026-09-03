# Spec: Native Skills

<!-- Nexus: SPEC-NEXUS.md | Module id: native-skills -->

## Objective

Distribuir un catálogo nativo de skills comunes y permitir instalar, actualizar, modificar o crear skills sin romper la trazabilidad del workflow.

## Initial Catalog

Prompt engineering, PR review, Spector/spec-driven development, workflow adaptativo, UML, documentación funcional para QA, estimación de tareas, Git/GitHub y reconciliación documental.

## Commands

`npm run build`; `npm test`; `npm run ade -- skill list`; `npm run desktop:dev`.

## Project Structure

`.ade/skills/` contiene skills del Project; el paquete nativo vive en `skills/`; el registro vive en `src/application/skills/`; la UI en `desktop/src/`.

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

Los manifests se instalan desde un `.json` local o un repositorio Git (URL o `owner/repository`) mediante `skills.install`; ADE los copia a `.ade/skills/<id>.json` y conserva el origen `project`.

## Testing Strategy

Validación de manifest, compatibilidad, permisos, inputs/outputs, instalación y regresión de skills nativas.

## Boundaries

- Always: versionar, atribuir y poder desactivar cada skill; `read_project` y `write_docs` se conceden dentro del Project porque las modificaciones documentales son intención explícita de producto.
- Ask first: conceder por ejecución `write_code`, `run_commands` o `network`; ADE muestra los permisos solicitados y persiste la sesión con estado `RUNNING`, `COMPLETED` o `FAILED`.
- Never: ejecutar una skill sin declarar permisos ni ocultar qué produjo.

## Success Criteria

Un Project nuevo tiene un catálogo de skills y el usuario puede añadir una skill propia con versión, permisos y trazabilidad.

## Open Questions

- ¿Formato único compatible con Codex, OpenCode y otros agentes?
- ¿Marketplace remoto o sólo repositorios locales/Git?
