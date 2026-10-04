import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';

self.addEventListener('message', (_ev: MessageEvent<WorkerInitMessage>) => {
  self.postMessage({ type: 'phase', phase: 'running' } satisfies WorkerToHostMessage);
  self.postMessage({
    type: 'output',
    channel: 'stderr',
    data: 'ruby runtime not implemented yet\n'
  } satisfies WorkerToHostMessage);
  self.postMessage({
    type: 'exit',
    code: 1,
    error: 'ruby runtime not implemented yet'
  } satisfies WorkerToHostMessage);
});
