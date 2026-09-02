# Plan: Project and Repository v0.1

<!-- Spec: docu/specs/SPEC-project-task-workflow.md#project-and-repository-contract -->
<!-- ADR: docu/adr/0002-project-repository-identity.md -->

## Objective

Registrar un repositorio Git local como Project estable y dejar preparada la referencia desde Task, sin crear branches/worktrees ni acoplar el dominio a OpenCode.

## Contract

```ts
type Project = {
  id: string;
  name: string;
  repositoryPath: string;
  createdAt: string;
};

type Repository = {
  path: string;
  gitRoot: string;
  branch?: string;
};
```

El caso de uso recibe `name` y `repositoryPath`, normaliza la ruta, valida que existe y consulta `git rev-parse --show-toplevel` mediante un puerto. Persiste `gitRoot` canónico y rechaza duplicados en la misma base ADE.

## Implementation order

1. Añadir entidades y validación pura de `Project` y `Repository`.
2. Definir `GitRepositoryPort` para detectar raíz y branch sin modificar el árbol.
3. Añadir tablas y migración SQLite para Project/Repository.
4. Añadir caso de uso `registerProject` y consultas por id/ruta.
5. Añadir `projectId` opcional a Task y preservar compatibilidad con Tasks existentes.
6. Integrar la CLI sólo después de completar los tests del caso de uso.

## Failure contract

- Ruta vacía, relativa o inexistente: error de validación.
- Directorio fuera de alcance del workspace permitido: error de policy.
- No es un repositorio Git: error `repository_not_found`.
- Raíz ya registrada: error `project_already_exists` con el Project existente.
- Fallo del comando Git: error de adapter con comando y salida redactada.

## Verification

```bash
npm run build
npm test
git diff --check
```

La suite debe cubrir rutas equivalentes, subdirectorios Git, repositorio no Git, duplicados, migración y rehidratación. Ningún test debe escribir sobre un repositorio de usuario; usar fixtures temporales.

## Out of scope

Branches, worktrees, multi-repository Projects, sincronización cloud, credenciales y cambios automáticos en el árbol de trabajo.
