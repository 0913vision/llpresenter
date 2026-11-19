import type {PictureRequest} from '@core/schema/picture';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {FontCatalogSnapshot} from '@core/schema/fontCatalog';
import type {SongSlideSource} from '@core/schema/showService';
import {pictureKey} from '@core/output/pictureKey';
import {themeOverlay} from '@core/themes/content';
import {LocalPicturePainter} from './localPicturePainter';

/** What the output compositor draws into a still. */
export type PictureSpec = PictureRequest['spec'] & {
  readonly songSource?: SongSlideSource | undefined;
};

type Listener = () => void;

export interface PictureImage {
  readonly source: string | HTMLCanvasElement;
  readonly bytes: number;
}

export interface PictureDisplay {
  readonly picture: PictureImage;
  readonly element: HTMLImageElement;
  readonly consume: () => void;
}

interface DisplayTicket {
  readonly ready: Promise<PictureDisplay | undefined>;
  readonly display: PictureDisplay | undefined;
}

function canPreparePicture(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.llp?.picture !== undefined &&
    typeof URL.createObjectURL === 'function'
  );
}

class Entry {
  private readonly listeners = new Set<Listener>();
  readonly ready: Promise<void>;
  private finish = (): void => undefined;
  private finishAttempt: (ok: boolean) => void = () => undefined;
  attempt = this.newAttempt();
  image: PictureImage | undefined;
  done = false;
  editing = false;
  editorDraw: Promise<HTMLCanvasElement> | undefined;
  immediate = false;
  failures = 0;
  retryAt = 0;
  repaint = false;
  readonly spec: PictureSpec;
  readonly inputs: string;
  private revision = 0;

  constructor(
    readonly key: string,
    {spec, inputs}: {spec: PictureSpec; inputs: string},
    readonly available: boolean,
  ) {
    this.spec = spec;
    this.inputs = inputs;
    this.ready = new Promise(resolve => {
      this.finish = resolve;
    });
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly snapshot = (): number => this.revision;

  get displayed(): boolean {
    return this.listeners.size > 0;
  }

  private newAttempt(): Promise<boolean> {
    return new Promise(resolve => {
      this.finishAttempt = resolve;
    });
  }

  retry(): void {
    this.retryAt = 0;
    this.attempt = this.newAttempt();
  }

  fail(): void {
    this.failures++;
    this.retryAt = performance.now() + Math.min(2000, 125 * 2 ** this.failures);
    this.finishAttempt(false);
  }

  cancel(): void {
    this.finishAttempt(false);
  }

  complete(image: PictureImage): void {
    this.image = image;
    this.done = true;
    Reflect.set(this.ready, 'status', 'fulfilled');
    Reflect.set(this.ready, 'value', undefined);
    this.finish();
    this.finishAttempt(true);
    this.publish();
  }

  private publish(): void {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
}

const ENTRY_LIMIT = 720;
const BYTE_LIMIT = 48 * 1024 * 1024;
const FOREGROUND_LIMIT = 2;
const UNMOUNTED_RETRIES = 2;

/** Shares decoded sources and gives visible requests priority over preload. */
export class PictureService {
  private readonly entries = new Map<string, Entry>();
  private readonly foreground = new Set<Entry>();
  private readonly background = new Set<Entry>();
  private readonly inputListeners = new Set<Listener>();
  private readonly pins = new Map<PictureImage, number>();
  private readonly displays = new WeakMap<Entry, Map<string, DisplayTicket>>();
  private media: MediaDocument | undefined;
  private records = new Map<string, MediaDocument['value']['items'][number]>();
  private fontStamp = '';
  private fontUpdate = 0;
  private initialized = false;
  private inputsReady = Promise.resolve();

  private active = 0;
  private bytes = 0;
  private scheduled = false;
  private editorPainter: LocalPicturePainter | undefined;
  private paintingEditor = false;
  private editing = Promise.resolve();
  private importScope = new AbortController();

  constructor(private readonly options: {waitForReady?: boolean} = {}) {}

  /** Handoffs need a renderer that lays out and prepares pictures. */
  get drawInPlace(): boolean {
    return navigator.userAgent.includes('jsdom') || !this.available;
  }

  private get available(): boolean {
    return this.options.waitForReady
      ? LocalPicturePainter.available()
      : canPreparePicture();
  }

  /** Releases the temporary compositor and stills owned by an import. */
  reset(): void {
    if (!this.options.waitForReady) return;
    this.importScope.abort();
    this.importScope = new AbortController();
    this.editorPainter?.dispose();
    this.editorPainter = undefined;
    this.foreground.clear();
    this.background.clear();
    for (const entry of this.entries.values()) {
      entry.cancel();
      const source = entry.image?.source;
      if (typeof source === 'string') URL.revokeObjectURL(source);
    }
    this.entries.clear();
    this.pins.clear();
    this.bytes = 0;
  }

  warmEditor(spec: PictureSpec): void {
    if (!LocalPicturePainter.available()) return;
    this.editing
      .then(() => {
        if (this.paintingEditor) return;
        this.editorPainter ??= new LocalPicturePainter();
        this.editorPainter.warm(spec);
      })
      .catch((error: unknown) => console.error(error));
  }

  /** Requests the editor's picture as part of accepting the native input. */
  prepareEditedLyrics(picture: PictureSpec, lines: readonly string[]): void {
    const {slide} = picture.layers;
    if (slide === null || !LocalPicturePainter.available()) return;
    const next = {
      ...picture,
      layers: {...picture.layers, slide: {...slide, lines}},
    };
    const entry = this.request(next, this.inputs(next), {editing: true});
    if (this.foreground.has(entry) && !this.paintingEditor) {
      entry.editorDraw ??= this.paintEditor(entry);
    }
  }

  private paintEditor(entry: Entry): Promise<HTMLCanvasElement> {
    const start = async (): Promise<HTMLCanvasElement> => {
      this.editorPainter ??= new LocalPicturePainter();
      this.paintingEditor = true;
      return this.editorPainter
        .paint(entry.spec, undefined, canvas => {
          const bytes = canvas.width * canvas.height * 4;
          this.bytes += bytes;
          entry.complete({source: canvas, bytes});
        })
        .finally(() => {
          this.paintingEditor = false;
        });
    };
    const result = this.paintingEditor ? this.editing.then(start) : start();
    this.editing = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  readonly subscribeInputs = (listener: Listener): (() => void) => {
    if (this.options.waitForReady) return pictures.subscribeInputs(listener);
    this.inputListeners.add(listener);
    return () => this.inputListeners.delete(listener);
  };

  inputs(spec: PictureSpec): string {
    if (this.options.waitForReady) return pictures.inputs(spec);
    this.initialize();
    const ids = new Set<string>();
    const mediaId = spec.layers.media?.mediaId;
    if (mediaId !== undefined) ids.add(mediaId);
    const {theme} = spec.appearance;
    for (const element of theme.layout.elements) {
      if (element.kind === 'image') ids.add(element.mediaId);
      if (element.kind === 'overlay') {
        const overlay = themeOverlay(
          theme.item,
          spec.layers,
          theme.sourceScreenId,
        );
        const content = overlay?.content;
        if (
          content !== undefined &&
          'media' in content &&
          typeof content.media === 'string'
        ) {
          ids.add(content.media);
        }
      }
    }
    return JSON.stringify([
      this.fontStamp,
      [...ids].sort().map(id => [id, this.records.get(id) ?? null]),
    ]);
  }

  request(
    spec: PictureSpec,
    inputs: string,
    {
      immediate = true,
      editing = false,
    }: {immediate?: boolean; editing?: boolean} = {},
  ): Entry {
    const key = JSON.stringify([pictureKey(spec), inputs]);
    let entry = this.entries.get(key);
    if (entry === undefined) {
      entry = new Entry(key, {spec, inputs}, this.available);
      if (entry.available) this.background.add(entry);
    } else {
      this.entries.delete(key);
    }
    this.entries.set(key, entry);
    entry.editing ||= editing;
    entry.immediate ||= immediate;
    if (immediate && entry.retryAt > 0 && performance.now() >= entry.retryAt) {
      entry.retry();
      this.foreground.add(entry);
    }
    if (immediate && this.background.delete(entry)) this.foreground.add(entry);
    this.schedule();
    return entry;
  }

  /** Reports whether this attempt finished with a decoded image. */
  async whenDrawn(spec: PictureSpec, switchSlot?: string): Promise<boolean> {
    const entry = this.request(spec, this.inputs(spec));
    if (!entry.available || !(await entry.attempt)) return false;
    if (switchSlot !== undefined) {
      await this.prepareDisplay(entry, switchSlot).ready;
    }
    return true;
  }

  /** Decodes the exact element that will be attached during an item switch. */
  prepareDisplay(entry: Entry, slot: string): DisplayTicket {
    const displays =
      this.displays.get(entry) ?? new Map<string, DisplayTicket>();
    this.displays.set(entry, displays);
    const earlier = displays.get(slot);
    if (earlier !== undefined) return earlier;
    let display: PictureDisplay | undefined;
    const ready: Promise<PictureDisplay | undefined> = entry.ready.then(
      async () => {
        const picture = entry.image;
        if (picture !== undefined && typeof picture.source === 'string') {
          const release = this.retain(picture);
          const element = await this.decodeDisplay(picture.source).finally(
            release,
          );
          display = {picture, element, consume: () => displays.delete(slot)};
        }
        // NOTE(0913vision): React can read a decoded display on its first render.
        Reflect.set(ready, 'status', 'fulfilled');
        Reflect.set(ready, 'value', display);
        return display;
      },
    );
    const ticket = {
      ready,
      get display() {
        return display;
      },
    };
    displays.set(slot, ticket);
    return ticket;
  }

  private async decodeDisplay(url: string): Promise<HTMLImageElement> {
    const element = new Image();
    element.alt = '';
    element.draggable = false;
    element.decoding = 'sync';
    element.src = url;
    try {
      await element.decode();
      return element;
    } catch (error) {
      console.error('Could not decode a slide display', error);
      await new Promise<void>(resolve => setTimeout(resolve, 250));
      return this.decodeDisplay(url);
    }
  }

  /** Prepares pictures while leaving room for the current view. */
  prepare(specs: readonly PictureSpec[]): void {
    for (const spec of specs) {
      this.request(spec, this.inputs(spec), {immediate: false});
    }
  }

  retain(image: PictureImage): () => void {
    this.pins.set(image, (this.pins.get(image) ?? 0) + 1);
    return () => {
      const remaining = (this.pins.get(image) ?? 1) - 1;
      if (remaining > 0) this.pins.set(image, remaining);
      else this.pins.delete(image);
    };
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    const api = window.llp;
    if (api?.picture === undefined) return;
    const notify = (): void => {
      for (const listener of this.inputListeners) listener();
    };
    const acceptMedia = (document: MediaDocument): void => {
      if (
        this.media !== undefined &&
        document.revision <= this.media.revision
      ) {
        return;
      }
      this.media = document;
      this.records = new Map(document.value.items.map(item => [item.id, item]));
      notify();
    };
    const acceptFonts = async (catalog: FontCatalogSnapshot): Promise<void> => {
      const update = ++this.fontUpdate;
      const bytes = new TextEncoder().encode(JSON.stringify(catalog.families));
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      if (update === this.fontUpdate) {
        this.fontStamp = Array.from(new Uint8Array(hash), value =>
          value.toString(16).padStart(2, '0'),
        ).join('');
        notify();
      }
    };
    api.media.subscribe(acceptMedia);
    api.fonts.subscribe(catalog => {
      acceptFonts(catalog).catch((error: unknown) => console.error(error));
    });
    this.inputsReady = Promise.all([
      api.media.get().then(acceptMedia, () => undefined),
      api.fonts
        .snapshot()
        .then(acceptFonts)
        .catch(() => undefined),
    ]).then(() => undefined);
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const queue =
        this.foreground.size > 0 ? this.foreground : this.background;
      const limit =
        queue === this.foreground && !this.options.waitForReady
          ? FOREGROUND_LIMIT
          : 1;
      while (this.active < limit) {
        const entry = queue.values().next().value;
        if (entry === undefined) return;
        queue.delete(entry);
        this.active++;
        this.load(entry)
          .finally(() => {
            this.active--;
            this.schedule();
          })
          .catch((error: unknown) => console.error(error));
      }
    });
  }

  private async load(entry: Entry): Promise<void> {
    const signal = this.importScope.signal;
    try {
      await (this.options.waitForReady
        ? pictures.inputsReady
        : this.inputsReady);
      signal.throwIfAborted();
      const inputs = this.inputs(entry.spec);
      if (inputs !== entry.inputs) {
        const next = this.request(entry.spec, inputs, {editing: entry.editing});
        next.attempt
          .then(ok => {
            if (!ok) entry.fail();
          })
          .catch((error: unknown) => console.error(error));
        next.ready
          .then(() => {
            if (next.image !== undefined) entry.complete(next.image);
            if (this.entries.get(entry.key) === entry) {
              this.entries.delete(entry.key);
            }
          })
          .catch((error: unknown) => console.error(error));
        return;
      }
      if (this.options.waitForReady) {
        // NOTE(0913vision): The import's temporary backgrounds belong to this
        // renderer. They never go into the shared painter or its disk cache.
        this.editorPainter ??= new LocalPicturePainter();
        const canvas = await this.editorPainter.paint(entry.spec, signal);
        signal.throwIfAborted();
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            image => {
              if (image === null) {
                reject(new Error('Could not encode import picture'));
              } else resolve(image);
            },
            'image/webp',
            0.92,
          );
        });
        signal.throwIfAborted();
        const source = await this.decode(blob);
        if (signal.aborted) {
          URL.revokeObjectURL(source);
          return;
        }
        this.bytes += blob.size;
        entry.complete({source, bytes: blob.size});
        this.prune();
        return;
      }
      if (entry.editing && LocalPicturePainter.available()) {
        const draw = entry.editorDraw ?? this.paintEditor(entry);
        const canvas = await draw.catch(() => undefined);
        entry.editorDraw = undefined;
        if (canvas !== undefined) {
          requestIdleCallback(() => this.remember(canvas, entry), {
            timeout: 1000,
          });
          this.prune();
          return;
        }
      }
      const bytes = await window.llp?.picture.paint({
        spec: entry.spec,
        inputs,
        ...(entry.repaint ? {repaint: true} : {}),
      });
      if (bytes === undefined) {
        throw new Error('The painter did not return a picture');
      }
      const src = await this.decode(
        new Blob([new Uint8Array(bytes)], {
          type: bytes[0] === 0x89 ? 'image/png' : 'image/jpeg',
        }),
      ).catch((error: unknown) => {
        entry.repaint = true;
        throw error;
      });
      this.bytes += bytes.byteLength;
      entry.complete({source: src, bytes: bytes.byteLength});
    } catch (error) {
      if (signal.aborted) return;
      if (entry.failures === 0) {
        console.error('Picture preparation failed', error);
      }
      entry.fail();
      this.retry(entry);
    }
    this.prune();
  }

  private retry(entry: Entry): void {
    const retryAt = entry.retryAt;
    setTimeout(
      () => {
        if (
          this.entries.get(entry.key) !== entry ||
          entry.retryAt !== retryAt
        ) {
          return;
        }
        if (
          entry.displayed ||
          (entry.immediate && entry.failures <= UNMOUNTED_RETRIES)
        ) {
          entry.retry();
          this.foreground.add(entry);
          this.schedule();
        } else if (!entry.immediate) {
          this.entries.delete(entry.key);
        }
      },
      Math.ceil(retryAt - performance.now()),
    );
  }

  private async decode(blob: Blob): Promise<string> {
    const src = URL.createObjectURL(blob);
    const decoded = new Image();
    decoded.src = src;
    try {
      await decoded.decode();
      return src;
    } catch (error) {
      URL.revokeObjectURL(src);
      throw error;
    }
  }

  private remember(canvas: HTMLCanvasElement, entry: Entry): void {
    try {
      canvas.toBlob(blob => {
        if (blob === null) return;
        this.storeEncoded(entry, blob).catch((error: unknown) =>
          console.error(error),
        );
      }, 'image/png');
    } catch (error) {
      console.error('Could not encode the edited picture', error);
    }
  }

  private async storeEncoded(entry: Entry, blob: Blob): Promise<void> {
    const data = await blob.arrayBuffer();
    window.llp?.picture.remember({
      picture: {spec: entry.spec, inputs: entry.inputs},
      image: new Uint8Array(data),
    });
  }

  private prune(): void {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= ENTRY_LIMIT && this.bytes <= BYTE_LIMIT) break;
      if (
        (!entry.done && entry.retryAt === 0) ||
        entry.displayed ||
        (entry.image !== undefined && this.pins.has(entry.image))
      ) {
        continue;
      }
      this.entries.delete(key);
      if (entry.image !== undefined) {
        this.bytes -= entry.image.bytes;
        if (typeof entry.image.source === 'string') {
          URL.revokeObjectURL(entry.image.source);
        }
      }
    }
  }
}

export const pictures = new PictureService();
