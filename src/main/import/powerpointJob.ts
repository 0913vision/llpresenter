import {join} from 'node:path';
import {Worker} from 'node:worker_threads';

export type PowerPointJob =
  | {readonly kind: 'read'; readonly path: string}
  | {
      readonly kind: 'layers';
      readonly path: string;
      readonly digest: string;
      readonly number: number;
    }
  | {
      readonly kind: 'match';
      readonly path: string;
      readonly candidates: ReadonlyArray<{
        readonly id: string;
        readonly path: string;
      }>;
    }
  | {
      readonly kind: 'background';
      readonly path: string;
      readonly digest: string;
      readonly index: number;
      readonly target: string;
    };

/** Runs each bounded archive operation away from the main event loop. */
export class PowerPointJobs {
  private readonly workers = new Set<Worker>();
  private disposed = false;

  run(job: PowerPointJob): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new Error('PowerPoint import closed'));
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(__dirname, 'powerpointWorker.js'), {
        workerData: job,
      });
      this.workers.add(worker);
      let answered = false;
      worker.once('message', (value: unknown) => {
        answered = true;
        resolve(value);
      });
      worker.once('error', reject);
      worker.once('exit', code => {
        this.workers.delete(worker);
        if (!answered) reject(new Error(`PowerPoint worker exited: ${code}`));
      });
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const worker of this.workers) {
      worker.terminate().catch(() => undefined);
    }
  }
}
