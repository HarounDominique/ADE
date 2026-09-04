export interface TerminalEmulatorOptions {
  rows?: number;
  columns?: number;
  onChange?: (text: string, terminal: TerminalEmulator) => void;
}

export declare class TerminalEmulator {
  constructor(options?: TerminalEmulatorOptions);
  write(chunk: string): void;
  clear(): void;
  text(): string;
}
