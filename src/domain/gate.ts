export type GateStatus = "pending" | "passed" | "failed" | "waived";

export type Gate = {
  id: string;
  required: boolean;
  status: GateStatus;
  evidenceIds: readonly string[];
  failureReason?: string;
};

export class GateSet {
  constructor(readonly gates: readonly Gate[]) {}

  requiredFailures(): readonly Gate[] {
    return this.gates.filter((gate) => gate.required && gate.status !== "passed" && gate.status !== "waived");
  }

  canShip(): boolean {
    return this.requiredFailures().length === 0;
  }

  assertCanShip(): void {
    const failures = this.requiredFailures();
    if (failures.length > 0) {
      throw new Error(`Required gates are not passed: ${failures.map((gate) => gate.id).join(", ")}`);
    }
  }
}
