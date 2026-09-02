import { LocalGitRepository } from "./adapters/local-git-repository.js";
import { registerProject } from "./application/tasks/project-commands.js";
import { advanceTask, createTask } from "./application/tasks/task-commands.js";
import { AdeStore } from "./persistence/sqlite-store.js";

const [command, action, ...args] = process.argv.slice(2);

if (!command || command === "help") {
  printUsage();
} else {
  const repositoryPath = command === "project" && action === "register"
    ? args[2]
    : command === "task" && action === "create"
      ? args[3]
      : undefined;
  const directory = repositoryPath ?? process.cwd();
  const store = new AdeStore(process.env.ADE_DB_PATH ?? `${directory}/.ade/ade.db`);
  try {
    if (command === "project" && action === "register") {
      const [id, name, repositoryPath] = args;
      if (!id || !name || !repositoryPath) throw new Error("Usage: project register <id> <name> <repository-path>");
      const project = await registerProject(store, new LocalGitRepository(), { id, name, repositoryPath });
      console.log(JSON.stringify(project, null, 2));
    } else if (command === "task" && action === "create") {
      const [id, intent, projectId, repositoryPath] = args;
      if (!id || !intent) throw new Error("Usage: task create <id> <intent> [project-id] [repository-path]");
      const task = createTask(store, { id, intent, ...(projectId ? { projectId } : {}), ...(repositoryPath ? { repositoryPath } : {}) });
      console.log(JSON.stringify({ id: task.id, status: task.currentStatus }, null, 2));
    } else if (command === "task" && action === "advance") {
      const [id, next, reason] = args;
      if (!id || !next || !reason) throw new Error("Usage: task advance <id> <status> <reason>");
      const task = advanceTask(store, { id, next: next as Parameters<typeof advanceTask>[1]["next"], reason });
      console.log(JSON.stringify({ id: task.id, status: task.currentStatus }, null, 2));
    } else {
      throw new Error(`Unknown command: ${command} ${action ?? ""}`.trim());
    }
  } finally {
    store.close();
  }
}

function printUsage(): void {
  console.log(`ADE CLI

  project register <id> <name> <repository-path>
  task create <id> <intent> [project-id] [repository-path]
  task advance <id> <status> <reason>

Environment:
  ADE_DB_PATH     SQLite path (default: <repository>/.ade/ade.db)
  OPENCODE_URL    OpenCode URL for the review flow
`);
}
