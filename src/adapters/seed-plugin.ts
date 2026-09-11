import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/** Assay carries the workflow plugin itself.

    It used to be something the operator had to have installed, which meant a
    Claude turn inside Assay either found it or invented an answer about what
    "seed" might mean. The plugin now ships in the repository and in the bundle,
    and every Claude turn is told where it is, so its presence is a property of
    Assay rather than of the machine (ADR-0057). */

const PLUGIN_NAME = "seed";

function candidates(): readonly string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    /** Running from source: src/adapters -> the repository root. */
    resolve(here, "..", "..", "plugins", PLUGIN_NAME),
    /** Packaged: the sidecar runs beside the resources Tauri copied in. */
    resolve(here, "..", PLUGIN_NAME),
    resolve(here, PLUGIN_NAME),
  ];
}

/** Where Assay looks, so a miss can be read rather than guessed at. An explicit
    override replaces the search instead of extending it: an app that says where
    it put the plugin and is wrong should fail loudly, not quietly fall back to
    a copy that happens to be lying around. */
export function seedPluginSearchPath(): readonly string[] {
  const override = process.env.ADE_SEED_PLUGIN_DIR;
  return override ? [override] : candidates();
}

/** The directory to hand `claude --plugin-dir`, or undefined when Assay is not
    carrying one. Checked for the manifest rather than for the directory: a
    `plugins/seed` that exists but holds no plugin is not an answer. */
export function resolveSeedPluginDir(): string | undefined {
  return seedPluginSearchPath().find((candidate) => existsSync(join(candidate, ".claude-plugin", "plugin.json")));
}
