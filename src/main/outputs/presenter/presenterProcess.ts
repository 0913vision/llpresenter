import {utilityProcess, type UtilityProcess} from 'electron';
import {join} from 'node:path';

/** How long a presenter that was asked to stop may take before it is ended. */
const STOP_GRACE_MS = 2000;

/** A message of the presenter process (`presenter-utility.cjs`). */
export interface PresenterMessage {
  readonly type: string;
  readonly message?: string;
  readonly frame?: unknown;
  readonly was?: unknown;
  readonly id?: unknown;
}

/** What the presenter process tells its owner. */
export interface PresenterProcessEvents {
  readonly message: (message: PresenterMessage) => void;
  /** The process ended without being stopped. */
  readonly exited: (code: number) => void;
  /** It could not start, or a message could not reach it. */
  readonly failed: (reason: unknown) => void;
}

/**
 * The utility process that presents one screen. Messages posted before it has
 * spawned wait and go in order once it has. A stopped process gets 'stop' and
 * is ended after STOP_GRACE_MS if it is still there; its events stop then.
 */
export class PresenterProcess {
  private child: UtilityProcess | null = null;
  private spawned = false;
  private pending: Array<Record<string, unknown>> = [];

  constructor(private readonly events: PresenterProcessEvents) {}

  /** Whether the process was started and has not ended or been stopped. */
  get running(): boolean {
    return this.child !== null;
  }

  /** Starts the process unless it runs; false when it could not start. */
  start(): boolean {
    if (this.child !== null) return true;
    let worker: UtilityProcess;
    try {
      worker = utilityProcess.fork(
        join(__dirname, 'presenter/presenter-utility.cjs'),
        [],
        {serviceName: 'Output presenter'},
      );
    } catch (error) {
      this.events.failed(error);
      return false;
    }
    this.child = worker;
    worker.once('spawn', () => {
      if (this.child !== worker) return;
      this.spawned = true;
      const queued = this.pending;
      this.pending = [];
      for (const message of queued) this.post(message);
    });
    worker.on('message', (message: PresenterMessage) => {
      if (this.child === worker) this.events.message(message);
    });
    worker.on('exit', code => {
      if (this.child !== worker) return;
      this.child = null;
      this.events.exited(code);
    });
    return true;
  }

  /** Sends a message, after the spawn when it has not spawned yet. */
  post(message: Record<string, unknown>): void {
    const {child} = this;
    if (child === null) return;
    if (!this.spawned) {
      this.pending.push(message);
      return;
    }
    try {
      child.postMessage(message);
    } catch (error) {
      this.events.failed(error);
    }
  }

  /** Asks the process to stop and ends it if it does not; no event follows. */
  stop(): void {
    const old = this.child;
    this.child = null;
    if (old === null) return;
    try {
      old.postMessage({type: 'stop'});
    } catch {
      old.kill();
    }
    setTimeout(() => old.kill(), STOP_GRACE_MS).unref();
  }
}
