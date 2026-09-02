import { GateSet } from "../../domain/gate.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { getTask } from "./task-commands.js";

export function approveTask(
  store: AdeStore,
  input: { id: string; reason: string; gates: GateSet },
): void {
  const task = getTask(store, input.id);
  input.gates.assertCanShip();
  task.transition("COMPLETED", input.reason, "human");
  store.saveTask(task);
}
