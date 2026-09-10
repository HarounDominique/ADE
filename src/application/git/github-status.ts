import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCallback);

export async function inspectGitHub(): Promise<{ available: boolean; detail: string }> {
  try {
    const { stdout } = await execFile("gh", ["auth", "status"], { windowsHide: true });
    return { available: true, detail: stdout.trim() || "GitHub CLI authenticated" };
  } catch (error) {
    return { available: false, detail: error instanceof Error ? error.message : "GitHub CLI unavailable" };
  }
}
