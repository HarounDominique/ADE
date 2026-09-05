import type {
  AgentRuntimePort,
  FileDiff,
  RuntimeEvent,
  SessionHandle,
  StructuredPrompt,
} from "../ports/agent-runtime.js";

type FetchLike = typeof fetch;

export class OpenCodeHttpRuntime implements AgentRuntimePort {
  private readonly fetcher: FetchLike;
  private activeDirectory: string | undefined;

  constructor(
    private readonly baseUrl = "http://127.0.0.1:4096",
    fetcher: FetchLike = fetch,
  ) {
    this.fetcher = fetcher;
  }

  async health(): Promise<{ healthy: boolean; version?: string }> {
    const response = await this.request("/global/health");
    return (await response.json()) as { healthy: boolean; version?: string };
  }

  async createSession(input: { directory: string; title?: string }): Promise<SessionHandle> {
    const response = await this.request("/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opencode-directory": input.directory,
      },
      body: JSON.stringify({ title: input.title }),
    });
    const session = (await response.json()) as { id?: string };
    if (!session.id) throw new Error("OpenCode returned a session without an id");
    this.activeDirectory = input.directory;
    return { id: session.id, directory: input.directory };
  }

  async prompt(session: SessionHandle, input: { text: string; agent?: string; model?: string }): Promise<unknown> {
    const response = await this.request(`/session/${encodeURIComponent(session.id)}/prompt_async`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opencode-directory": session.directory,
      },
      body: JSON.stringify({
        parts: [{ type: "text", text: input.text }],
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.model ? { model: input.model } : {}),
      }),
    });
    if (response.status !== 204) {
      throw new Error(`Unexpected prompt response: ${response.status}`);
    }
    return undefined;
  }

  async promptAndWait(session: SessionHandle, input: StructuredPrompt): Promise<unknown> {
    const response = await this.request(`/session/${encodeURIComponent(session.id)}/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opencode-directory": session.directory,
      },
      body: JSON.stringify({
        parts: [{ type: "text", text: input.text }],
        format: input.format,
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.model ? { model: input.model } : {}),
      }),
    });
    return response.json();
  }

  async *events(signal?: AbortSignal): AsyncIterable<RuntimeEvent> {
    const response = await this.request("/event", {
      ...(signal ? { signal } : {}),
      ...(this.activeDirectory ? { headers: { "x-opencode-directory": this.activeDirectory } } : {}),
    });
    if (!response.body) throw new Error("OpenCode event stream has no body");
    yield* parseSse(response.body, signal);
  }

  async diff(session: SessionHandle): Promise<readonly FileDiff[]> {
    const response = await this.request(`/session/${encodeURIComponent(session.id)}/diff`);
    return (await response.json()) as FileDiff[];
  }

  async abort(session: SessionHandle): Promise<void> {
    await this.request(`/session/${encodeURIComponent(session.id)}/abort`, {
      method: "POST",
    });
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, init);
    if (!response.ok) throw new Error(`OpenCode request failed: ${response.status} ${path}`);
    return response;
  }
}

async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<RuntimeEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal?.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const messages = buffer.split(/\r?\n\r?\n/);
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const data = message
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) continue;
        yield { type: "opencode.event", payload: JSON.parse(data) as unknown };
      }
    }
  } finally {
    await reader.cancel();
  }
}
