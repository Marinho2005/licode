import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';

self.addEventListener('message', (_ev: MessageEvent<WorkerInitMessage>) => {
  self.postMessage({ type: 'phase', phase: 'running' } satisfies WorkerToHostMessage);
  self.postMessage({
    type: 'output',
    channel: 'stderr',
    data: 'python runtime not implemented yet\n'
  } satisfies WorkerToHostMessage);
  self.postMessage({
    type: 'exit',
    code: 1,
    error: 'python runtime not implemented yet'
  } satisfies WorkerToHostMessage);
});
