import {createHash, randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import {join} from 'node:path';
import type {PictureRequest} from '@core/schema/picture';
import {pictureKey} from '@core/output/pictureKey';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {PicturePainter} from './painter';

const VERSION = 'picture-10';
const MEMORY_LIMIT = 64 * 1024 * 1024;
const DISK_LIMIT = 500 * 1024 * 1024;
const PRUNE_INTERVAL_MS = 60_000;
const RESERVATION_MS = 5000;
const RESERVATION_LIMIT = 32;

interface Reservation {
  readonly owner: number;
  readonly request: PictureRequest;
  readonly resolve: (image: Buffer) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  waiting: boolean;
}

function keyOf(request: PictureRequest): string {
  return createHash('sha256')
    .update(VERSION)
    .update(
      request.spec.appearance.theme.themeId === SERMON_TITLE_THEME_ID &&
        request.spec.appearance.screen.kind === 'broadcast'
        ? ':sermon-ink-gap-1'
        : '',
    )
    .update(JSON.stringify([pictureKey(request.spec), request.inputs]))
    .digest('hex');
}

function encoded(image: Buffer, transparent: boolean): boolean {
  return transparent
    ? image.subarray(1, 4).toString() === 'PNG' &&
        image.subarray(-8, -4).toString() === 'IEND'
    : image[0] === 0xff &&
        image[1] === 0xd8 &&
        image.at(-2) === 0xff &&
        image.at(-1) === 0xd9;
}

/** Shares encoded pictures across every window and across app restarts. */
export class PictureCache {
  private readonly painter = new PicturePainter();
  private readonly memory = new Map<string, Buffer>();
  private readonly pending = new Map<string, Promise<Buffer>>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly writes = new Set<Promise<void>>();
  private bytes = 0;
  private lastPrune = 0;

  constructor(private readonly folder: string) {}

  /** Claims an uncached picture before the editor starts its immediate draw. */
  reserve(request: PictureRequest, owner: number): boolean {
    const key = keyOf(request);
    if (
      request.repaint === true ||
      this.reservations.size >= RESERVATION_LIMIT ||
      this.memory.has(key) ||
      this.pending.has(key) ||
      existsSync(this.fileOf(key, true)) ||
      existsSync(this.fileOf(key, false))
    ) {
      return false;
    }
    let resolve!: (image: Buffer) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Buffer>((accept, refuse) => {
      resolve = accept;
      reject = refuse;
    });
    this.pending.set(key, pending);
    void pending.then(
      () => {
        if (this.pending.get(key) === pending) this.pending.delete(key);
      },
      () => {
        if (this.pending.get(key) === pending) this.pending.delete(key);
      },
    );
    const timer = setTimeout(
      () => this.release(request, owner),
      RESERVATION_MS,
    );
    this.reservations.set(key, {
      owner,
      request,
      resolve,
      reject,
      timer,
      waiting: false,
    });
    return true;
  }

  /** Falls back to the shared painter if a claimed editor draw cannot finish. */
  release(request: PictureRequest, owner: number): void {
    const key = keyOf(request);
    const claim = this.reservations.get(key);
    if (claim?.owner !== owner) return;
    clearTimeout(claim.timer);
    this.reservations.delete(key);
    if (
      claim.waiting &&
      !request.spec.layers.media?.mediaId.startsWith('preview:')
    ) {
      void this.load(key, claim.request).then(claim.resolve, claim.reject);
    } else {
      this.pending.delete(key);
      claim.reject(new Error('Picture reservation released'));
    }
  }

  /** Reads only an existing picture; temporary import media cannot be drawn in main. */
  async peek(request: PictureRequest): Promise<Buffer | null> {
    const key = keyOf(request);
    const pending = this.pending.get(key);
    if (pending !== undefined) {
      const claim = this.reservations.get(key);
      if (claim !== undefined) claim.waiting = true;
      return pending.catch(() => null);
    }
    const cached = this.memory.get(key);
    if (cached !== undefined) return cached;
    const transparent = request.spec.appearance.screen.method === 'ndi';
    const image =
      (await this.read(this.fileOf(key, transparent), transparent)) ??
      (!transparent
        ? await this.read(this.fileOf(key, true), true)
        : undefined);
    if (image === undefined) return null;
    this.cacheInMemory(key, image);
    return image;
  }

  get(request: PictureRequest): Promise<Buffer> {
    const key = keyOf(request);
    const pending = this.pending.get(key);
    if (pending !== undefined) {
      const claim = this.reservations.get(key);
      if (claim !== undefined) claim.waiting = true;
      return pending;
    }
    const cached = request.repaint === true ? undefined : this.memory.get(key);
    if (cached !== undefined) {
      this.memory.delete(key);
      this.memory.set(key, cached);
      return Promise.resolve(cached);
    }
    const result = this.load(key, request);
    this.pending.set(key, result);
    void result.then(
      () => this.pending.delete(key),
      () => this.pending.delete(key),
    );
    return result;
  }

  /** Accepts the editor's already encoded source into the shared cache. */
  remember(request: PictureRequest, image: Buffer, owner?: number): void {
    const key = keyOf(request);
    const claim = this.reservations.get(key);
    if (claim !== undefined) {
      if (claim.owner !== owner) return;
      if (!encoded(image, true)) {
        this.release(request, owner);
        return;
      }
      clearTimeout(claim.timer);
      this.reservations.delete(key);
      this.cacheInMemory(key, image);
      this.write(this.fileOf(key, true), image);
      claim.resolve(image);
      return;
    }
    if (
      this.memory.has(key) ||
      this.pending.has(key) ||
      this.writes.size >= 16 ||
      !encoded(image, true)
    ) {
      return;
    }
    this.cacheInMemory(key, image);
    this.write(this.fileOf(key, true), image);
  }

  async dispose(): Promise<void> {
    for (const claim of this.reservations.values()) {
      clearTimeout(claim.timer);
      claim.reject(new Error('Picture cache closed'));
    }
    this.reservations.clear();
    this.painter.dispose();
    await Promise.allSettled(this.pending.values());
    await Promise.allSettled(this.writes);
    this.memory.clear();
    this.bytes = 0;
  }

  private async load(key: string, request: PictureRequest): Promise<Buffer> {
    const transparent = request.spec.appearance.screen.method === 'ndi';
    const file = this.fileOf(key, transparent);
    let image: Buffer | undefined;
    if (!request.repaint) {
      image = await this.read(file, transparent);
      if (image === undefined && !transparent) {
        image = await this.read(this.fileOf(key, true), true);
      }
    }
    if (image === undefined) {
      image = await this.painter.paint(request);
      this.write(file, image);
    }
    this.cacheInMemory(key, image);
    return image;
  }

  private async read(file: string, png: boolean): Promise<Buffer | undefined> {
    const image = await readFile(file).catch(() => undefined);
    if (image === undefined || !encoded(image, png)) return undefined;
    const now = new Date();
    void utimes(file, now, now).catch(() => undefined);
    return image;
  }

  private fileOf(key: string, transparent: boolean): string {
    return join(this.folder, `${key}.${transparent ? 'png' : 'jpg'}`);
  }

  private cacheInMemory(key: string, image: Buffer): void {
    if (image.length <= MEMORY_LIMIT) {
      this.bytes -= this.memory.get(key)?.length ?? 0;
      this.memory.delete(key);
      this.memory.set(key, image);
      this.bytes += image.length;
      while (this.bytes > MEMORY_LIMIT) {
        const oldest = this.memory.entries().next();
        if (oldest.done) break;
        this.memory.delete(oldest.value[0]);
        this.bytes -= oldest.value[1].length;
      }
    }
  }

  private write(file: string, image: Buffer): void {
    const write = this.persist(file, image).catch(() => undefined);
    this.writes.add(write);
    void write.then(
      () => this.writes.delete(write),
      () => this.writes.delete(write),
    );
  }

  private async persist(file: string, image: Buffer): Promise<void> {
    await mkdir(this.folder, {recursive: true});
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, image);
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    if (Date.now() - this.lastPrune < PRUNE_INTERVAL_MS) return;
    this.lastPrune = Date.now();
    await this.prune();
  }

  private async prune(): Promise<void> {
    const names = (await readdir(this.folder)).filter(name =>
      /^[a-f0-9]{64}\.(jpg|png)$/.test(name),
    );
    const files = await Promise.all(
      names.map(async name => {
        const path = join(this.folder, name);
        const info = await stat(path);
        return {path, size: info.size, time: info.atimeMs};
      }),
    );
    files.sort((a, b) => a.time - b.time);
    let size = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (size <= DISK_LIMIT) break;
      await unlink(file.path).catch(() => undefined);
      size -= file.size;
    }
  }
}
