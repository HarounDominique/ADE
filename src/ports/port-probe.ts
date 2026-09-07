export interface PortProbePort {
  /** True when something already listens on the port. The probe answers for
      the loopback interface, which is where a declared local service binds. */
  inUse(port: number): Promise<boolean>;
}
