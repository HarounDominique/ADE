# Spec: Desktop Shell and Review UX

<!-- Nexus: SPEC-NEXUS.md | Module id: desktop-shell -->

## Objective

Ofrecer una superficie desktop centrada en proyectos y Tasks, con navegación por Knowledge, Changes y Runtime, sin construir un editor completo.

## Information architecture

Las cinco áreas visibles son `PROJECT`, `WORK`, `KNOWLEDGE`, `CHANGES` y `RUNTIME`. El Project Hub comunica rama, estado Git, Tasks, agentes, cambios, gates, revisiones y servicios. La pantalla de resultado debe permitir entender una Task antes de abrir el diff.

## Project Structure

```text
src/ui/project/       → Project Hub
src/ui/work/          → Tasks, conversaciones y agentes
src/ui/knowledge/     → Documentos y skills
src/ui/changes/       → Resumen, diff, review y commit
src/ui/runtime/       → Servicios, terminal, tests y logs
tests/ui/              → Tests de flujos críticos
```

## Commands

Pendientes hasta resolver Tauri/Electron. Deben existir comandos completos para desarrollo, build, test, lint y empaquetado multiplataforma.

## Code Style

La revisión se presenta de mayor a menor nivel de detalle: resumen semántico, impacto, findings, archivos, diff. El visor necesita syntax highlighting, búsqueda, navegación, diff y apertura externa; no completado ni language server propio.

## Testing Strategy

Tests de componentes para estados de gates; tests de integración para crear Task y revisar ChangeSet; un test end-to-end del flujo principal con adapters fake; smoke test del shell en el sistema objetivo.

## Boundaries

- **Always:** Project Hub primero; hacer visible estado Git, Task, agentes, gates y runtime; ofrecer escape hatch a IDE/terminal.
- **Ask first:** adoptar editor completo, soporte cloud, cuentas, sync o colaboración realtime.
- **Never:** esconder operaciones peligrosas detrás de una acción ambigua; convertir la conversación en única representación del trabajo.

## Success Criteria

Un usuario puede abrir un repositorio, crear una Task, observar la implementación, revisar el resumen y diff, consultar logs/tests y aprobar un commit sin abandonar ADE para el flujo normal.

## Open Questions

- ¿Tauri o Electron?
- ¿Qué plataforma se prioriza en el primer spike?
- ¿Qué integración externa mínima se necesita para abrir IntelliJ, VS Code o terminal?
