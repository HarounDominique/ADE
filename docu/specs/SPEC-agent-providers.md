# Spec: Agent Providers

<!-- Nexus: SPEC-NEXUS.md | Module id: agent-providers -->

## Objective

Permitir que ADE albergue agentes que el usuario ya puede utilizar, empezando por OpenCode y Codex, sin acoplar el workflow a un proveedor ni almacenar credenciales.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`.

## Project Structure

`src/ports/agent-runtime.ts` define capacidades; `src/adapters/` implementa proveedores; `src/application/` crea sesiones y asigna roles; `desktop/src/` muestra proveedor, sesión, permisos y estado.

## Code Style

```ts
type ProviderDescriptor = { id: string; label: string; capabilities: readonly string[]; auth: "local" | "external" };
```

## Testing Strategy

Fakes por capacidad, contract tests por adapter, detección de binario/endpoint y errores de autenticación. Nunca se requiere una cuenta real para tests.

## Boundaries

- Always: usar `AgentRuntimePort`, mostrar proveedor activo y atribuir operaciones.
- Ask first: conceder permisos de filesystem, red o ejecución ampliados.
- Never: copiar tokens a SQLite, logs, prompts persistidos o ChangeSets.

## Success Criteria

ADE detecta proveedores disponibles, permite elegir uno para una Task y mantiene el workflow aunque cambie el adapter.

## Open Questions

- ¿Qué proveedores entran en el paquete inicial?
- ¿Cómo mostrar el estado de una licencia sin duplicar el login?
