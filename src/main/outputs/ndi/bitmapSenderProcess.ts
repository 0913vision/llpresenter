import {utilityProcess, type UtilityProcess} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../../base/log';
import type {OutputScreen} from '../screens';
import {ndiSenderEnv, stopSender} from './ndiWindow';

/**
 * How long the NDI sender may take to answer a frame, or to send its heartbeat,
 * before it counts as failed, in milliseconds.
 */
export const NDI_SEND_TIMEOUT_MS = 5000;
/**
 * How long a stopping NDI sender gets to exit before it is ended, in
 * milliseconds.
 */
export const NDI_STOP_TIMEOUT_MS = 2000;

/** One area of the page, as the sender process takes it. */
export interface BitmapFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

/** What a sender process tells its output. */
export interface SenderProcessEvents {
  /** It can take frames now. */
  readonly ready: () => void;
  /** The frame on its way went out. */
  readonly sent: () => void;
  /**
   * It failed, stopped answering or exited, and is stopped already.
   *
   * @param missing - The NDI runtime is not installed.
   */
  readonly failed: (missing: boolean) => void;
}

/** A message of the NDI utility process. */
interface SenderMessage {
  readonly type: string;
  readonly message?: string;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * One utility process that sends bitmap frames to NDI. It owns the process and
 * its two watchdogs: one per frame on its way, and the heartbeat that follows
 * the first frame, so a sender that stops answering, even while idle, fails.
 * After {@link stop} it says nothing more.
 */
export class BitmapSenderProcess {
  private readonly worker: UtilityProcess;
  private ready = false;
  private stopped = false;
  private frameWatchdog: Timer | null = null;
  private heartbeatWatchdog: Timer | null = null;

  constructor(
    screen: OutputScreen,
    private readonly events: SenderProcessEvents,
    private readonly log: Logger,
  ) {
    this.worker = utilityProcess.fork(join(__dirname, 'ndi/utility.cjs'), [], {
      serviceName: 'NDI output',
      env: ndiSenderEnv(screen),
    });
    this.worker.on('message', (message: SenderMessage) => {
      if (!this.stopped) this.onMessage(message);
    });
    this.worker.on('exit', code => {
      if (this.stopped) return;
      this.log.error('NDI sender exited', code);
      this.stop(true);
      this.events.failed(false);
    });
  }

  /** Whether it can take frames. */
  get isReady(): boolean {
    return this.ready;
  }

  /** Sends one frame; it fails when no answer comes in time. */
  send(frame: BitmapFrame): void {
    try {
      this.worker.postMessage({type: 'frame', data: frame});
      this.frameWatchdog = setTimeout(
        () => this.fail('send timed out'),
        NDI_SEND_TIMEOUT_MS,
      );
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Stops the process, or only lets it go when it `exited` already. No event
   * follows. Stopping again does nothing.
   */
  stop(exited = false): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ready = false;
    this.clearWatchdogs();
    if (!exited) {
      stopSender(this.worker, {timeoutMs: NDI_STOP_TIMEOUT_MS, log: this.log});
    }
  }

  private fail(reason: unknown, missing = false): void {
    if (this.stopped) return;
    this.log.error('NDI sender failed', reason);
    this.stop();
    this.events.failed(missing);
  }

  private onMessage(message: SenderMessage): void {
    switch (message.type) {
      case 'native-loaded':
        this.log.info('NDI native module loaded');
        return;
      case 'ready':
        this.ready = true;
        this.events.ready();
        return;
      case 'sent':
        this.frameSent();
        return;
      case 'heartbeat':
        if (this.heartbeatWatchdog !== null) this.watchHeartbeat();
        return;
      case 'error':
        this.fail(
          message.message,
          message.message?.includes('NDI_RUNTIME_MISSING') === true,
        );
        return;
      default:
        // NOTE(0913vision): utility.cjs sends no other message.
        return;
    }
  }

  /** A frame went out: the heartbeat is watched from the first one on. */
  private frameSent(): void {
    if (this.heartbeatWatchdog === null) this.watchHeartbeat();
    if (this.frameWatchdog !== null) clearTimeout(this.frameWatchdog);
    this.frameWatchdog = null;
    this.events.sent();
  }

  private watchHeartbeat(): void {
    if (this.heartbeatWatchdog !== null) clearTimeout(this.heartbeatWatchdog);
    this.heartbeatWatchdog = setTimeout(
      () => this.fail('sender heartbeat timed out'),
      NDI_SEND_TIMEOUT_MS,
    );
  }

  private clearWatchdogs(): void {
    if (this.frameWatchdog !== null) clearTimeout(this.frameWatchdog);
    this.frameWatchdog = null;
    if (this.heartbeatWatchdog !== null) clearTimeout(this.heartbeatWatchdog);
    this.heartbeatWatchdog = null;
  }
}
