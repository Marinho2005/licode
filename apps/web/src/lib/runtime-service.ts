import { RuntimeManager } from '@licode/runtime-core';
import { JavaScriptRuntime } from '@licode/runtime-js';
import { SandboxBridge } from './sandbox-bridge.js';

export function createIDEEnvironment(iframeEl: HTMLIFrameElement, sandboxOrigin?: string) {
  const bridge = new SandboxBridge({ sandboxOrigin });
  bridge.attachIframe(iframeEl);

  const jsRuntime = new JavaScriptRuntime(bridge);
  const manager = new RuntimeManager();
  manager.register(jsRuntime);

  return {
    manager,
    jsRuntime,
    bridge
  };
}
