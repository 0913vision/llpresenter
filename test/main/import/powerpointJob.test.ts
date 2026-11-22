import {beforeEach, describe, expect, it, vi} from 'vitest';
import {PowerPointJobs} from '@main/import/powerpointJob';

const mocks = vi.hoisted(() => ({
  workers: new Array<{
    path: string;
    data: unknown;
    worker: {emit: (event: string, value: unknown) => boolean};
  }>(),
}));

vi.mock('node:worker_threads', async () => {
  const {EventEmitter} = await import('node:events');
  return {
    Worker: class extends EventEmitter {
      constructor(path: string, options: {workerData: unknown}) {
        super();
        mocks.workers.push({path, data: options.workerData, worker: this});
      }
      terminate(): Promise<number> {
        this.emit('exit', 1);
        return Promise.resolve(1);
      }
    },
  };
});

beforeEach(() => {
  mocks.workers.length = 0;
});

describe('PowerPoint worker jobs', () => {
  it('sends archive work to a worker and returns its reply', async () => {
    const jobs = new PowerPointJobs();
    const request = {kind: 'read', path: 'deck.pptx'} as const;
    const result = jobs.run(request);
    const worker = mocks.workers[0];
    expect(worker?.path.endsWith('powerpointWorker.js')).toBe(true);
    expect(worker?.data).toEqual(request);
    worker?.worker.emit('message', {slides: []});
    expect(await result).toEqual({slides: []});
    worker?.worker.emit('exit', 0);
    jobs.dispose();
  });

  it('rejects an unfinished job when the owner closes', async () => {
    const jobs = new PowerPointJobs();
    const result = jobs.run({kind: 'read', path: 'deck.pptx'});
    jobs.dispose();
    await expect(result).rejects.toThrow('PowerPoint worker exited');
    await expect(jobs.run({kind: 'read', path: 'deck.pptx'})).rejects.toThrow();
  });
});
