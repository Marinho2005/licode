export interface ISandboxBridge {
  ensureReady(): Promise<void>;
  getPort(): MessagePort;
}
