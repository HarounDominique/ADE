import type { ChildProcess, SpawnOptionsWithoutStdio } from "node:child_process";
import crossSpawn from "cross-spawn";

export type CommandResult = { stdout: string };
export type StartedCommand = { child: ChildProcess; completion: Promise<CommandResult> };

/**
 * Starts a command with platform-aware executable resolution while keeping argv
 * structured. `cross-spawn` quotes Windows cmd shims itself, including shell
 * metacharacters, instead of exposing application input to `cmd.exe`.
 */
export function startSafeCommand(
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio & { maxBuffer?: number; onStdout?: (text: string) => void },
): StartedCommand {
  const { maxBuffer = 4 * 1024 * 1024, onStdout, ...spawnOptions } = options;
  const child = crossSpawn(command, [...args], { ...spawnOptions, stdio: ["pipe", "pipe", "pipe"] });
  child.stdin?.end();

  let stdout = "";
  let stderr = "";
  let settled = false;
  const completion = new Promise<CommandResult>((resolve, reject) => {
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const collect = (target: "stdout" | "stderr") => (chunk: Buffer | string) => {
      const text = chunk.toString();
      if (target === "stdout") stdout += text;
      else stderr += text;
      if (target === "stdout") onStdout?.(text);
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBuffer) {
        child.kill("SIGKILL");
        fail(new Error(`Command output exceeded ${maxBuffer} bytes`));
      }
    };
    child.stdout?.on("data", collect("stdout"));
    child.stderr?.on("data", collect("stderr"));
    child.once("error", fail);
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout });
      else reject(new Error(`Command failed (${signal ?? code ?? "unknown"}): ${stderr.trim()}`));
    });
  });
  return { child, completion };
}
