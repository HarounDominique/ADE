# ADR-0010: Workspace nativo y proveedores agénticos desacoplados

## Status

Accepted

## Date

2026-09-03

## Context

El flujo diario mezcla terminal, exploración de archivos, agentes con licencia del usuario, skills, Git y documentación. ADE debe reducir cambios de contexto sin convertirse en propietario de las cuentas de cada proveedor.

## Decision

La v0.3 usará Tauri 2 para terminal/PTY y filesystem local con validación nativa. Los agentes se integrarán detrás de `AgentRuntimePort` mediante adapters detectables; ADE conservará referencias de proveedor y sesión, nunca credenciales.

## Alternatives Considered

- Web-only workspace: rechazado porque no ofrece acceso local natural a terminal, filesystem y procesos.
- Acoplar ADE a un único agente: rechazado porque contradice el principio provider-agnostic.
- Gestionar credenciales en ADE: rechazado porque duplica la superficie de seguridad del proveedor.

## Consequences

La primera UX será nativa y local. Cada proveedor requiere contract tests y diagnóstico propio. La seguridad de terminal/filesystem y el aislamiento de sesiones son contratos públicos.
