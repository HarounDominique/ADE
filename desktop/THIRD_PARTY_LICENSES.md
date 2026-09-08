# Third-party licenses

ADE distribuye estas dependencias directas en su shell desktop. Todas las dependencias incorporadas para el editor en esta iteración usan licencias permisivas y conservan sus avisos en el árbol de dependencias npm.

| Dependency | Purpose | License | Official source |
| --- | --- | --- | --- |
| [CodeMirror 6](https://github.com/codemirror/dev) | Editor, navegación y edición | MIT | [codemirror.net](https://codemirror.net/) |
| `@codemirror/lang-*` (JavaScript, TypeScript, C++, Java, PHP, Python, Rust, CSS, HTML, JSON, Markdown, SQL, XML, YAML) | Parsers y resaltado por lenguaje | MIT | [CodeMirror language packages](https://codemirror.com/docs/ref/#language) |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | Editor fallback y resaltado para lenguajes sin paquete CodeMirror oficial | MIT | [Monaco license](https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt) |
| [Prettier](https://github.com/prettier/prettier) | Formateado explícito de lenguajes compatibles | MIT | [prettier.io](https://prettier.io/docs) |
| [xterm.js](https://github.com/xtermjs/xterm.js) | Terminal PTY | MIT | [xtermjs.org](https://xtermjs.org/) |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Render de Markdown en el Editor (CommonMark + tablas), con HTML embebido deshabilitado | MIT | [markdown-it.github.io](https://markdown-it.github.io/) |

El inventario se limita a dependencias directas declaradas por `desktop/package.json`. Las definiciones de lenguaje básicas de Monaco forman parte de su distribución MIT y se cargan sólo para los lenguajes fallback declarados por ADE. Antes de distribuir una versión empaquetada se debe generar el aviso completo de dependencias transitivas a partir de `desktop/package-lock.json` y conservarlo junto al bundle.
