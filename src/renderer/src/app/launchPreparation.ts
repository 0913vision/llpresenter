import type {LlpApi} from '@contracts/ipc/api';
import type {LoadCount, LoadReadiness} from '@renderer/ui/loadReadiness';

/** The longest the last picture waits for a quiet moment, in ms. */
const IDLE_LIMIT_MS = 1000;
const NONE: LoadCount = {done: 0, total: 0};

type Api = Pick<LlpApi, 'service' | 'log'>;
type ViewTask = Parameters<Api['service']['preparing']>[0]['task'];

function fontsReady(): Promise<unknown> {
  try {
    return document.fonts.ready;
  } catch {
    return Promise.resolve();
  }
}

/** Decodes every picture that shows now. */
function decodeShownPictures(): ReadonlyArray<Promise<void>> {
  const images = [...document.images].filter(
    image =>
      image.getClientRects().length > 0 &&
      (image.currentSrc !== '' || (image.getAttribute('src') ?? '') !== ''),
  );
  return images.map(image =>
    typeof image.decode === 'function'
      ? Promise.resolve().then(() => image.decode())
      : Promise.resolve(),
  );
}

/**
 * Prepares the first view of the control window: its data, the pictures of the
 * slides, the fonts, and its first drawing. It tells main how far each of them
 * is, and when the window can show.
 */
export class LaunchPreparation {
  private stopped = false;
  private sent = false;
  private isLoaded = false;
  private preparing = false;
  private frame: number | undefined;
  private idle: number | undefined;
  private stopReadiness: (() => void) | undefined;

  constructor(
    private readonly api: Api,
    private readonly readiness: LoadReadiness | undefined,
  ) {}

  start(): void {
    this.stopReadiness = this.readiness?.subscribe(() => this.changed());
    const loaded = (): void => {
      this.isLoaded = true;
      this.changed();
    };
    this.tellLoads();
    this.api.service.get().then(loaded, (error: unknown) => {
      this.warn('Could not confirm launch service readiness', error);
      loaded();
    });
  }

  stop(): void {
    this.stopped = true;
    this.stopReadiness?.();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    if (this.idle !== undefined) cancelIdleCallback(this.idle);
  }

  private hasLoaded(): boolean {
    return this.isLoaded && (this.readiness?.getSnapshot() ?? 0) === 0;
  }

  private changed(): void {
    this.tellLoads();
    this.attempt();
  }

  private tell(task: ViewTask, {done, total}: LoadCount, ended: boolean): void {
    if (this.stopped || this.sent) return;
    this.api.service.preparing({task, done, total, ended});
  }

  private tellLoads(): void {
    const reads = this.readiness?.count('read') ?? NONE;
    const pictures = this.readiness?.count('picture') ?? NONE;
    const isRead = this.isLoaded && reads.done === reads.total;
    const data = {
      done: reads.done + (this.isLoaded ? 1 : 0),
      total: reads.total + 1,
    };
    this.tell('data', data, isRead);
    this.tell('pictures', pictures, this.hasLoaded());
  }

  private attempt(): void {
    if (this.stopped || this.sent || this.preparing || !this.hasLoaded()) {
      return;
    }
    this.preparing = true;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (this.stopped) return;
      if (!this.hasLoaded()) {
        this.preparing = false;
        return;
      }
      this.prepareView();
    });
  }

  private prepareView(): void {
    const fonts = fontsReady();
    this.tell('fonts', {done: 0, total: 1}, false);
    const fontsSettled = (): void => {
      this.tell('fonts', {done: 1, total: 1}, true);
      this.tell('drawing', NONE, false);
    };
    fonts.then(fontsSettled, fontsSettled);
    Promise.allSettled([fonts, ...decodeShownPictures()]).then(
      () => this.draw(),
      (error: unknown) => {
        this.preparing = false;
        this.warn('Could not prepare the control view', error);
      },
    );
  }

  private draw(): void {
    if (this.stopped) return;
    if (!this.hasLoaded()) {
      this.preparing = false;
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.idle = requestIdleCallback(() => this.finish(), {
        timeout: IDLE_LIMIT_MS,
      });
    });
  }

  private finish(): void {
    this.idle = undefined;
    this.preparing = false;
    if (this.stopped || this.sent || !this.hasLoaded()) return;
    this.sent = true;
    this.api.service.ready();
  }

  private warn(message: string, error: unknown): void {
    this.api.log.write({level: 'warn', message, detail: String(error)});
  }
}
