import type {PictureRequest} from '@core/schema/picture';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {FontCatalogSnapshot} from '@core/schema/fontCatalog';
import type {SongSlideSource} from '@core/schema/showService';
import {pictureKey} from '@core/output/pictureKey';
import {themeOverlay} from '@core/themes/content';
import {flushSync} from 'react-dom';
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

class Entry {
  private readonly listeners = new Set<Listener>();
  readonly ready: Promise<void>;
  private finish = (): void => undefined;
  image: PictureImage | undefined;
  done = false;
  editing = false;
  private revision = 0;

  constructor(
    readonly key: string,
    readonly spec: PictureSpec,
    readonly inputs: string,
  ) {
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

  complete(image: PictureImage | undefined): void {
    this.image = image;
    this.done = true;
    Reflect.set(this.ready, 'status', 'fulfilled');
    Reflect.set(this.ready, 'value', undefined);
    this.finish();
    this.publish();
  }

  replace(image: PictureImage): void {
    this.image = image;
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

/** Shares decoded sources and gives visible requests priority over preload. */
class PictureService {
  private readonly entries = new Map<string, Entry>();
  private readonly foreground = new Set<Entry>();
  private readonly background = new Set<Entry>();
  private readonly inputListeners = new Set<Listener>();
  private readonly pins = new Map<PictureImage, number>();
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
  private editing = Promise.resolve();

  warmEditor(spec: PictureSpec): void {
    if (!LocalPicturePainter.available()) return;
    this.editing
      .then(() => {
        this.editorPainter ??= new LocalPicturePainter();
        this.editorPainter.warm(spec);
      })
      .catch((error: unknown) => console.error(error));
  }

  readonly subscribeInputs = (listener: Listener): (() => void) => {
    this.inputListeners.add(listener);
    return () => this.inputListeners.delete(listener);
  };

  inputs(spec: PictureSpec): string {
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
      entry = new Entry(key, spec, inputs);
      if (
        window.llp?.picture === undefined ||
        typeof URL.createObjectURL !== 'function'
      ) {
        entry.complete(undefined);
      } else {
        this.background.add(entry);
      }
    } else {
      this.entries.delete(key);
    }
    this.entries.set(key, entry);
    entry.editing ||= editing;
    if (immediate && this.background.delete(entry)) this.foreground.add(entry);
    this.schedule();
    return entry;
  }

  /** Resolves once the image has finished decoding. */
  whenDrawn(spec: PictureSpec): Promise<void> {
    return this.request(spec, this.inputs(spec)).ready;
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
      const limit = queue === this.foreground ? FOREGROUND_LIMIT : 1;
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
    try {
      await this.inputsReady;
      const inputs = this.inputs(entry.spec);
      if (inputs !== entry.inputs) {
        const next = this.request(entry.spec, inputs, {editing: entry.editing});
        next.ready
          .then(() => {
            entry.complete(next.image);
            this.entries.delete(entry.key);
          })
          .catch((error: unknown) => console.error(error));
        return;
      }
      if (entry.editing && LocalPicturePainter.available()) {
        const draw = this.editing.then(() => {
          this.editorPainter ??= new LocalPicturePainter();
          return this.editorPainter.paint(entry.spec);
        });
        this.editing = draw.then(
          () => undefined,
          () => undefined,
        );
        const canvas = await draw.catch(() => undefined);
        if (canvas !== undefined) {
          const bytes = canvas.width * canvas.height * 4;
          this.bytes += bytes;
          flushSync(() => entry.complete({source: canvas, bytes}));
          requestIdleCallback(() => this.remember(canvas, entry), {
            timeout: 1000,
          });
          this.prune();
          return;
        }
      }
      const bytes = await window.llp?.picture.paint({spec: entry.spec, inputs});
      if (bytes === undefined) {
        entry.complete(undefined);
        return;
      }
      const src = await this.decode(
        new Blob([new Uint8Array(bytes)], {
          type: bytes[0] === 0x89 ? 'image/png' : 'image/jpeg',
        }),
      );
      this.bytes += bytes.byteLength;
      entry.complete({source: src, bytes: bytes.byteLength});
    } catch (error) {
      console.error('Picture preparation failed', error);
      entry.complete(undefined);
    }
    this.prune();
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
        this.keepEncoded(entry, blob).catch((error: unknown) =>
          console.error(error),
        );
      }, 'image/png');
    } catch (error) {
      console.error('Could not encode the edited picture', error);
    }
  }

  private async keepEncoded(entry: Entry, blob: Blob): Promise<void> {
    const data = await blob.arrayBuffer();
    window.llp?.picture.remember({
      picture: {spec: entry.spec, inputs: entry.inputs},
      image: new Uint8Array(data),
    });
    const src = await this.decode(blob);
    if (this.entries.get(entry.key) !== entry) {
      URL.revokeObjectURL(src);
      return;
    }
    this.bytes += blob.size - (entry.image?.bytes ?? 0);
    entry.replace({source: src, bytes: blob.size});
    this.prune();
  }

  private prune(): void {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= ENTRY_LIMIT && this.bytes <= BYTE_LIMIT) break;
      if (
        !entry.done ||
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
