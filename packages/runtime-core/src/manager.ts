import type { Runtime, RuntimeState, ExecutionSession } from './types.js';

export type StateListener = (runtimeId: string, state: RuntimeState) => void;

export class RuntimeManager {
  private runtimes = new Map<string, Runtime>();
  private states = new Map<string, RuntimeState>();
  private listeners = new Set<StateListener>();

  register(runtime: Runtime): void {
    const id = runtime.descriptor.id;
    this.runtimes.set(id, runtime);
    this.setState(id, 'not-installed');
  }

  getState(runtimeId: string): RuntimeState {
    return this.states.get(runtimeId) ?? 'not-installed';
  }

  getRuntime(runtimeId: string): Runtime | undefined {
    return this.runtimes.get(runtimeId);
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(id: string, state: RuntimeState): void {
    this.states.set(id, state);
    for (const listener of this.listeners) {
      try {
        listener(id, state);
      } catch (err) {
        console.error('Error in RuntimeManager state listener:', err);
      }
    }
  }

  async prepare(runtimeId: string, onProgress?: (p: number) => void): Promise<void> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime "${runtimeId}" not found in manager.`);
    }

    const currentState = this.getState(runtimeId);
    if (currentState === 'ready') return;

    if (currentState === 'not-installed') {
      this.setState(runtimeId, 'installing');
      await runtime.install(onProgress ?? (() => {}));
      this.setState(runtimeId, 'installed');
    }

    this.setState(runtimeId, 'warming');
    await runtime.warm();
    this.setState(runtimeId, 'ready');
  }

  async startSession(
    runtimeId: string,
    spec: { files: Record<string, string>; entry: string; limits: { wallMs: number } }
  ): Promise<ExecutionSession> {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime "${runtimeId}" not found.`);
    }

    if (this.getState(runtimeId) !== 'ready') {
      await this.prepare(runtimeId);
    }

    return runtime.start(spec);
  }

  async disposeAll(): Promise<void> {
    for (const [id, runtime] of this.runtimes.entries()) {
      await runtime.dispose();
      this.setState(id, 'not-installed');
    }
  }
}
