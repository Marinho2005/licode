import { RuntimeManager } from '@licode/runtime-core';
import { JavaScriptRuntime } from '@licode/runtime-js';
import { PythonRuntime } from '@licode/runtime-python';
import { RubyRuntime } from '@licode/runtime-ruby';
import { SandboxBridge } from './sandbox-bridge.js';

export function createIDEEnvironment(iframeEl: HTMLIFrameElement, sandboxOrigin?: string) {
  const bridge = new SandboxBridge({ sandboxOrigin });
  bridge.attachIframe(iframeEl);

  const jsRuntime = new JavaScriptRuntime(bridge);
  const pythonRuntime = new PythonRuntime(bridge);
  const manager = new RuntimeManager();
  manager.register(jsRuntime);
  manager.register(pythonRuntime);
  const rubyRuntime = new RubyRuntime(bridge);
  manager.register(rubyRuntime);

  return {
    manager,
    jsRuntime,
    pythonRuntime,
    rubyRuntime,
    bridge
  };
}
