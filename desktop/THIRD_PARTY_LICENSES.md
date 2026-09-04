# Third-party licenses

ADE distribuye estas dependencias directas en su shell desktop. Todas las dependencias incorporadas para el editor en esta iteración usan licencias permisivas y conservan sus avisos en el árbol de dependencias npm.

| Dependency | Purpose | License | Official source |
| --- | --- | --- | --- |
| [CodeMirror 6](https://github.com/codemirror/dev) | Editor, navegación y edición | MIT | [codemirror.net](https://codemirror.net/) |
| `@codemirror/lang-*` (JavaScript, Python, Rust, CSS, HTML, JSON, Markdown, SQL, XML, YAML) | Parsers y resaltado por lenguaje | MIT | [CodeMirror language packages](https://codemirror.com/docs/ref/#language) |
| [Prettier](https://github.com/prettier/prettier) | Formateado explícito de lenguajes compatibles | MIT | [prettier.io](https://prettier.io/docs) |
| [xterm.js](https://github.com/xtermjs/xterm.js) | Terminal PTY | MIT | [xtermjs.org](https://xtermjs.org/) |

El inventario se limita a dependencias directas declaradas por `desktop/package.json`. Antes de distribuir una versión empaquetada se debe generar el aviso completo de dependencias transitivas a partir de `desktop/package-lock.json` y conservarlo junto al bundle.
