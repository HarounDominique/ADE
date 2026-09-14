---
slug: terminal-attachments
spec: docu/specs/SPEC-terminal-attachments.md
status: draft
---

## Proposed Roadmap

## Technical Plan

1. Extraer y probar una normalización común de rutas y quoting POSIX/Windows.
2. Conectar `drop` al terminal PTY sin alterar las tabs `run` de solo salida.
3. Añadir referencias pendientes al composer y traducirlas al contrato común de prompt.
4. Cerrar con revisión de seguridad, matriz de plataformas y smoke manual.

- [ ] Phase 1 — Contrato de drop, normalización y quoting multiplataforma. Resolver
  rutas dentro del Project, rechazar carpetas o tipos según decisión final y cubrir
  POSIX/Windows con tests puros.
- [ ] Phase 2 — Drop en terminal PTY. Añadir target visual y accesible, inyectar la ruta
  mediante `terminal_input`, mantener intacta la consola `run` y cubrir el ciclo sin
  ejecución automática.
- [ ] Phase 3 — Drop en Agents. Añadir chips de referencias al composer, envío explícito
  y preservación ante errores; mantener el contrato común para Claude Code, Codex y
  OpenCode.
- [ ] Phase 4 — Revisión de seguridad, multiplataformidad y smoke manual. Verificar
  rutas con espacios/unicode, fuera de raíz, imagen/PDF/código y documentación de shell.

## Execution State

**Build Status**: NOT STARTED
**Can Resume**: NO — requiere validar las preguntas abiertas de la spec antes de implementar.

## Assumptions to confirm

- En terminal el drop inserta una ruta shell-quoted; no ejecuta nada.
- En Agents el drop crea una referencia local visible; no sube ni copia el fichero.
- El alcance inicial son ficheros del Project, no carpetas.
