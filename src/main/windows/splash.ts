import {BrowserWindow} from 'electron';
import type {LaunchTaskId} from '@core/schema/app/launch';
import type {WindowMode} from '../base/renderers/testWindows';
import {splashHtml} from './splashPage';

/** What the launch window shows of the launch. */
export interface LaunchPlan {
  /** How long the launch has run, in ms. */
  readonly elapsed: number;
  /** The tasks, in the order they are expected to end. */
  readonly tasks: ReadonlyArray<{
    readonly id: LaunchTaskId;
    readonly label: string;
    readonly name: string;
    readonly endsAt: number;
    /** The page shows how many of its parts are done. */
    readonly counted: boolean;
  }>;
}

/** The shortest time between two counts that the page is told, in ms. */
const COUNT_INTERVAL_MS = 30;

/** The windows whose page can be told something. */
const loaded = new WeakSet<BrowserWindow>();

/** Shows the launch window while the control window starts. */
export function createSplash(mode: WindowMode): BrowserWindow {
  const window = new BrowserWindow({
    width: 560,
    height: 240,
    frame: false,
    show: false,
    resizable: false,
    skipTaskbar: mode === 'offscreen',
    backgroundColor: '#1f4170',
    webPreferences: {
      offscreen: mode === 'offscreen',
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  if (mode === 'normal') {
    window.once('ready-to-show', () => {
      if (!window.isDestroyed()) window.show();
    });
  }
  window.webContents.once('did-finish-load', () => {
    loaded.add(window);
  });
  window
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`)
    .catch((error: unknown) => console.error('Could not load splash', error));
  return window;
}

/** Tells the launch window how the launch goes. */
export class LaunchBar {
  private readonly waiting: string[] = [];
  private lastCountAt = 0;

  constructor(
    private readonly window: BrowserWindow,
    plan: LaunchPlan,
  ) {
    if (!window.isDestroyed() && !loaded.has(window)) {
      window.webContents.once('did-finish-load', () => {
        for (const call of this.waiting.splice(0)) this.run(call);
      });
    }
    this.call('begin', plan);
  }

  /** So many of the parts of a task are done. */
  advance(task: LaunchTaskId, done: number, total: number): void {
    const now = performance.now();
    if (done < total && now - this.lastCountAt < COUNT_INTERVAL_MS) return;
    this.lastCountAt = now;
    this.call('advance', task, done, total);
  }

  /** A task ended. */
  end(task: LaunchTaskId, failed: boolean): void {
    this.call('end', task, failed);
  }

  private call(name: string, ...values: readonly unknown[]): void {
    const call = `launch.${name}(${values.map(value => JSON.stringify(value)).join(',')})`;
    if (loaded.has(this.window)) this.run(call);
    else this.waiting.push(call);
  }

  private run(call: string): void {
    if (this.window.isDestroyed()) return;
    this.window.webContents.executeJavaScript(call).catch(() => undefined);
  }
}
