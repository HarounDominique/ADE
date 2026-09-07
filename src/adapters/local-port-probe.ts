import { createServer } from "node:net";
import type { PortProbePort } from "../ports/port-probe.js";

/** Binding is the portable answer: `lsof` and `netstat` differ per platform and
    are not guaranteed to exist, while a bind that fails with EADDRINUSE means
    the same thing on macOS, Windows and Linux. It says the port is taken, not
    who took it -- naming the holder is left to the platform work. */
export class LocalPortProbe implements PortProbePort {
  async inUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once("error", (error: NodeJS.ErrnoException) => {
        resolve(error.code === "EADDRINUSE" || error.code === "EACCES");
      });
      server.once("listening", () => {
        server.close(() => resolve(false));
      });
      server.listen(port, "127.0.0.1");
    });
  }
}
