# ADE Desktop Shell

Shell desktop de ADE para macOS, construida con Tauri 2, HTML/CSS/JavaScript y un sidecar TypeScript/Node. La aplicación ofrece Project Hub, Work, Knowledge, Changes, Runtime, Explorer local y terminal PTY nativa.

## Desarrollo

Desde la raíz del repositorio:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:package:app
```

La shell mantiene una única navegación lateral etiquetada. El Explorer puede alternar entre la rama compacta del archivo activo y el árbol completo; el dock de terminal inferior es redimensionable y conserva una sesión PTY persistente.

## Entorno recomendado

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
