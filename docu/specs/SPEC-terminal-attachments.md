# Spec: Terminal and Agent Attachments

<!-- Nexus: SPEC-NEXUS.md | Module id: terminal-attachments -->

**Estado:** approved — alcance confirmado por el operador el 2026-09-14.

## Objective

Permitir que el operador arrastre un fichero —imagen, documento, código u otro fichero
del Project— a una terminal nativa o al compositor de `Agents`.

En la terminal, el resultado debe ser equivalente al drop en una terminal externa: se
inyecta la ruta absoluta del fichero con el quoting adecuado para el shell, sin ejecutar
ningún comando automáticamente. En `Agents`, el drop añade una referencia visible al
prompt que se está componiendo y el agente recibe la ruta local autorizada como contexto.

La feature no sube ficheros a un servicio remoto, no duplica contenido en ADE y no añade
una segunda forma de enviar el prompt: el operador sigue pulsando `Send prompt`.

## Commands

```bash
npm run build
node --test tests/desktop-ui-contract.test.ts
npm test
npm run desktop:package:app
```

No existe un script `lint` separado en este repositorio.

## Project Structure

```text
desktop/src/main.js              → drop targets, quoting y estado de adjuntos del composer
desktop/src/index.html           → atributos y affordances accesibles de drop
desktop/src/styles.css           → estados visuales de drop y chips
src/adapters/*-cli-runtime.ts    → conservación del contexto de rutas para runtimes CLI
src/ports/agent-runtime.ts       → contrato provider-neutral, si necesita ampliación
tests/                            → contratos de shell, quoting y límites de seguridad
docu/specs/                      → contrato y decisiones de producto
```

## Code Style

El drop se trata como una entrada de datos y se normaliza en una función pura antes de
conectarlo al DOM o al runtime:

```ts
function terminalDropText(path: string, platform: "windows" | "posix"): string {
  return platform === "windows" ? quoteWindowsPath(path) : quotePosixPath(path);
}
```

La UI conserva el nombre visible, la ruta relativa y un estado `pending`; nunca pinta una
ruta sin escapar dentro de HTML. La terminal recibe bytes de entrada mediante el mismo
`terminal_input` que el teclado.

## Testing Strategy

- Tests puros para quoting POSIX/Windows, rutas con espacios, comillas, unicode y rutas
  fuera del Project.
- Contrato de shell para comprobar que terminal y Agents tienen drop target, feedback
  visible, teclado equivalente y rechazo de tipos no soportados sin perder el prompt.
- Tests de integración del composer para que una referencia adjunta se envíe sólo al
  pulsar `Send prompt`, se limpie después de un envío aceptado y sobreviva a un error de
  transporte para poder reintentar.
- Tests de seguridad para impedir que una ruta inexistente, un directorio o una ruta no
  representable se inyecte en la terminal o se entregue al runtime; una ruta válida fuera
  del Project sí forma parte del contrato.
- Smoke manual en macOS, Windows y Linux cuando la matriz de plataforma esté disponible:
  drop de una imagen, un PDF y un fichero con espacios en terminal y Agents, sin ejecución
  automática ni fuga de contenido.

## Boundaries

- **Always:** validar que el path existe y es un fichero local antes de aceptarlo, aunque
  esté fuera del Project; mostrar feedback de drop; escapar según el shell; no ejecutar el
  contenido ni enviar el prompt hasta una acción explícita del operador; mantener la
  semántica provider-neutral.
- **Ask first:** añadir dependencias nativas, cambiar el protocolo de un runtime o subir
  contenido a Claude/Codex/OpenCode.
- **Never:** insertar una ruta sin quoting, ejecutar comandos derivados del nombre del
  fichero, leer bytes automáticamente para “ayudar” al agente, almacenar copias del
  adjunto o asumir que una extensión es segura.

## Success Criteria

1. Un fichero arrastrado desde Explorer al terminal activo aparece como ruta shell-quoted
   y no inicia ninguna orden por sí mismo.
2. El mismo drop funciona en una sesión donde Claude Code está ejecutándose, preservando
   flechas, espacios, unicode, imágenes y documentos como una terminal externa.
3. Un fichero arrastrado al composer de Agents aparece como chip accesible con nombre y
   ruta relativa; el prompt enviado contiene la referencia sólo tras `Send prompt`.
4. Codex, Claude Code y OpenCode reciben el mismo modelo de referencia local, sin que la
   UI se acople a un formato propietario.
5. Rutas inexistentes, duplicadas o no representables se rechazan con feedback accionable;
   las rutas locales válidas fuera del Project se aceptan y no llegan al PTY ni al runtime
   hasta la acción explícita correspondiente.
6. La operación es utilizable por teclado, anuncia el estado de drop a tecnologías
   asistivas y no rompe el compositor multilinea ni las terminales `run` de solo salida.

## Open Questions

- Confirmar que en `Agents` la referencia de ruta local es el comportamiento deseado, en
  vez de leer/subir el contenido del fichero al provider.
- El alcance inicial acepta cualquier fichero local de la máquina; las carpetas quedan
  fuera de alcance hasta una decisión posterior.
- Confirmar si en terminal se debe inyectar sólo la ruta o una forma provider-aware cuando
  Claude Code esté activo.
