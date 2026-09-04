# ADE Desktop Shell

Shell desktop de ADE para macOS, construida con Tauri 2, HTML/CSS/JavaScript y un sidecar TypeScript/Node. La aplicación ofrece Projects, Editor, Work, Knowledge, Changes, Runtime, Explorer local y terminal PTY nativa.

## Desarrollo

Desde la raíz del repositorio:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:package:app
```

La shell mantiene una única navegación lateral etiquetada, redimensionable entre 190 y 720 px y persistida por Project. `Projects` administra el catálogo local y la selección activa; la identidad seleccionada se propaga de forma consistente por topbar, breadcrumb, resumen, Editor, terminal y paneles, incluso cuando llegan refreshes asíncronos. El Explorer puede alternar entre la rama compacta del archivo activo y el árbol completo; su búsqueda muestra ficheros directamente, distingue homónimos con la ruta relativa y mantiene la escritura responsiva mediante índice reutilizable, debounce y spinner transitorio. Seleccionar un fichero de texto abre el Editor interno con `Save`, `Discard` y `⌘/Ctrl+S`; los binarios y ficheros grandes requieren una apertura externa explícita. El dock de terminal inferior es redimensionable y ofrece tabs con sesiones PTY independientes: cada una conserva su proceso, transcript, cwd, historial y completado al cambiar de tab.

La validación vigente pasa `npm run build`, `npm test` (94 tests TypeScript), `cargo test --manifest-path desktop/src-tauri/Cargo.toml` (18 tests Rust) y la generación del bundle `.app`. El arranque manual del bundle se ha ejecutado en macOS; el smoke gráfico automatizado queda pendiente.

## Entorno recomendado

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
