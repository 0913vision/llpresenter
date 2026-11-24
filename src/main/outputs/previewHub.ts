import {BrowserWindow, type WebContents} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import type {
  PreviewControl,
  PreviewFrame,
} from '@core/schema/live/previewMirror';
import {pushToWindow} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {LiveStore} from '../live/store';
import {createAlphaMirror} from './alphaMirror';
import {
  ackPresenterMirror,
  hasPresenterMirror,
  subscribePresenterMirror,
} from './presenterMirror';
import {PreviewFrameFanout} from './previewFrameFanout';
import type {OutputScreen} from './screens';

/** The least time between two frames that a window passes on to others. */
const RELAY_INTERVAL_MS = 100;

type Frame = Uint8Array | null;

/** The one window that captures an output itself, and passes it on. */
interface CaptureOwner {
  readonly contents: WebContents;
  relaying: boolean;
  nextFrameAt: number;
}

/** The pictures of one output, and the windows that show them. */
interface Mirror {
  readonly fanout: PreviewFrameFanout;
  /** What stops watching each window that shows this output. */
  readonly clients: Map<number, () => void>;
  owner: CaptureOwner | null;
  /** The frames of the output itself while a window shows them. */
  upstream: Upstream | null;
}

interface Upstream {
  readonly publish: (frame: Frame) => void;
  stop: () => void;
  alpha: ReturnType<typeof createAlphaMirror> | null;
  /** A frame is out that no window has drawn yet. */
  waiting: boolean;
}

export interface PreviewHubContext {
  readonly control: BrowserWindow;
  readonly store: Pick<LiveStore, 'state'>;
  readonly screens: () => readonly OutputScreen[];
  /** The page that draws an output, or null while it has none. */
  readonly contentsOf: (screenId: string) => WebContents | null | undefined;
  readonly log: Logger;
}

function pageOf(contents: WebContents): URL | null {
  try {
    return new URL(contents.getURL());
  } catch {
    return null;
  }
}

function liveWindows(): readonly BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(
    win => !win.isDestroyed() && !win.webContents.isDestroyed(),
  );
}

function outputPage(screenId: string): WebContents | undefined {
  return liveWindows().find(({webContents}) => {
    const page = pageOf(webContents);
    return (
      page?.pathname.endsWith('/output.html') === true &&
      page.searchParams.get('screen') === screenId
    );
  })?.webContents;
}

/**
 * Gives the windows of the operator the pictures of the outputs. One window
 * captures an output page and passes its frames on to the others; an output
 * that no window can capture (a presenter, NDI) sends its own frames.
 */
export class PreviewHub {
  private readonly mirrors = new Map<string, Mirror>();

  constructor(private readonly context: PreviewHubContext) {}

  /** How a window gets the pictures of a screen; null while it has none. */
  sourceOf(screenId: string, caller: WebContents): string | null {
    const {control, store, screens} = this.context;
    if (!this.mayShow(caller) || control.isDestroyed()) return null;
    if (!screens().some(({id}) => id === screenId)) return null;
    if (store.state.outputs[screenId] !== true) return null;
    if (this.startAlpha(screenId)) return 'alpha';
    const mirror = this.mirrorOf(screenId);
    if (mirror.owner !== null && mirror.owner.contents !== caller) {
      this.updateRelay(screenId, mirror);
      return 'relay';
    }
    const source = outputPage(screenId)?.getMediaSourceId(caller) ?? null;
    if (source !== null) {
      mirror.owner ??= {contents: caller, relaying: false, nextFrameAt: 0};
      this.updateRelay(screenId, mirror);
    }
    return source;
  }

  /** Passes a frame that the capturing window drew on to the others. */
  publish({screenId, frame}: PreviewFrame, caller: WebContents): void {
    const owner = this.mirrors.get(screenId)?.owner;
    if (
      frame === null ||
      !this.mayShow(caller) ||
      owner?.contents !== caller ||
      this.context.store.state.outputs[screenId] !== true ||
      performance.now() < owner.nextFrameAt
    ) {
      return;
    }
    owner.nextFrameAt = performance.now() + RELAY_INTERVAL_MS;
    this.mirrors.get(screenId)?.fanout.publish(frame, caller.id);
  }

  /** Starts, stops, or goes on with the pictures of a screen in a window. */
  control({screenId, action}: PreviewControl, caller: WebContents): void {
    if (this.context.control.isDestroyed() || !this.mayShow(caller)) return;
    if (action === 'ack') {
      const mirror = this.mirrors.get(screenId);
      mirror?.fanout.ack(caller.id);
      if (mirror?.fanout.hasCapacity === true) this.askForMore(screenId);
      return;
    }
    this.remove(screenId, caller.id);
    if (
      action === 'start' &&
      this.context.screens().some(({id}) => id === screenId)
    ) {
      this.add(screenId, caller);
    }
  }

  stop(): void {
    for (const mirror of this.mirrors.values()) {
      for (const stop of mirror.clients.values()) stop();
      mirror.upstream?.stop();
    }
    this.mirrors.clear();
  }

  /** Whether a window is one of the operator's that shows previews. */
  private mayShow(contents: WebContents): boolean {
    const {control} = this.context;
    if (contents.isDestroyed()) return false;
    if (contents === control.webContents) return true;
    const win = liveWindows().find(({webContents}) => webContents === contents);
    const page = pageOf(contents);
    return (
      win?.getParentWindow() === control &&
      page?.pathname.endsWith('/index.html') === true &&
      page.searchParams.get('window') === 'settings'
    );
  }

  private mirrorOf(screenId: string): Mirror {
    let mirror = this.mirrors.get(screenId);
    if (mirror === undefined) {
      mirror = {
        fanout: new PreviewFrameFanout(),
        clients: new Map(),
        owner: null,
        upstream: null,
      };
      this.mirrors.set(screenId, mirror);
    }
    return mirror;
  }

  private add(screenId: string, caller: WebContents): void {
    const {log} = this.context;
    const mirror = this.mirrorOf(screenId);
    const {id} = caller;
    const gone = (): void => this.remove(screenId, id);
    caller.once('destroyed', gone);
    mirror.clients.set(id, () => caller.removeListener('destroyed', gone));
    mirror.fanout.add(id, frame => {
      const value = {screenId, frame};
      if (!pushToWindow(caller, outputEndpoints.previewFrame, {value, log})) {
        gone();
      }
    });
    this.updateRelay(screenId, mirror);
    mirror.upstream ??= this.openUpstream(screenId, mirror);
  }

  private remove(screenId: string, client: number): void {
    const mirror = this.mirrors.get(screenId);
    if (mirror === undefined) return;
    mirror.clients.get(client)?.();
    mirror.clients.delete(client);
    mirror.fanout.remove(client);
    if (mirror.owner?.contents.id === client) {
      mirror.owner = null;
      mirror.fanout.publish(null);
    } else this.updateRelay(screenId, mirror);
    if (!mirror.fanout.empty) {
      if (mirror.fanout.hasCapacity) this.askForMore(screenId);
      return;
    }
    mirror.upstream?.stop();
    mirror.upstream = null;
    if (mirror.owner === null) this.mirrors.delete(screenId);
  }

  /** Takes the frames of an output that draws them itself. */
  private openUpstream(screenId: string, mirror: Mirror): Upstream {
    const upstream: Upstream = {
      publish: frame => {
        upstream.waiting = frame !== null;
        mirror.fanout.publish(frame);
        if (frame !== null && mirror.fanout.hasCapacity) {
          this.askForMore(screenId);
        }
      },
      stop: () => undefined,
      alpha: null,
      waiting: false,
    };
    mirror.upstream = upstream;
    const unsubscribe = subscribePresenterMirror(
      screenId,
      upstream.publish,
      available => {
        if (!available) {
          this.startAlpha(screenId);
          return;
        }
        if (mirror.owner !== null) {
          this.tellRelay(screenId, mirror.owner, false);
          mirror.owner = null;
        }
        this.stopAlpha(upstream);
      },
    );
    upstream.stop = () => {
      unsubscribe();
      this.stopAlpha(upstream);
    };
    return upstream;
  }

  /** Lets the output send its next frame. */
  private askForMore(screenId: string): void {
    const upstream = this.mirrors.get(screenId)?.upstream;
    if (upstream?.waiting !== true) return;
    upstream.waiting = false;
    if (upstream.alpha === null) ackPresenterMirror(screenId);
    else upstream.alpha.ack();
  }

  /**
   * Whether the output draws its own frames, which start then.
   */
  private startAlpha(screenId: string): boolean {
    const {screens, store, contentsOf} = this.context;
    const needed =
      screens().find(({id}) => id === screenId)?.target === 'ndi' ||
      contentsOf(screenId)?.isOffscreen() === true;
    const upstream = this.mirrors.get(screenId)?.upstream ?? null;
    if (upstream === null) return needed;
    if (store.state.outputs[screenId] !== true) {
      this.stopAlpha(upstream);
      return needed;
    }
    if (needed && upstream.alpha === null && !hasPresenterMirror(screenId)) {
      upstream.alpha = createAlphaMirror({
        source: () => contentsOf(screenId) ?? null,
        outputActive: () => store.state.outputs[screenId] === true,
        send: upstream.publish,
      });
    }
    return needed;
  }

  private stopAlpha(upstream: Upstream): void {
    upstream.alpha?.stop();
    upstream.alpha = null;
  }

  /** Has the capturing window pass its frames on while others show them. */
  private updateRelay(screenId: string, {owner, fanout}: Mirror): void {
    if (owner === null) return;
    const relaying = fanout.size > 1;
    if (owner.relaying === relaying) return;
    this.tellRelay(screenId, owner, relaying);
  }

  private tellRelay(
    screenId: string,
    owner: CaptureOwner,
    enabled: boolean,
  ): void {
    owner.relaying = enabled;
    pushToWindow(owner.contents, outputEndpoints.previewRelay, {
      value: {screenId, enabled},
      log: this.context.log,
    });
  }
}
