/** Bounded least-recently-used storage for compressed picture data URLs. */
export class TransitionPictureCache {
  private readonly pictures = new Map<string, string>();
  private size = 0;

  constructor(
    readonly maxBytes = 64 * 1024 * 1024,
    readonly maxEntries = 64,
  ) {}

  get bytes(): number {
    return this.size;
  }
  get count(): number {
    return this.pictures.size;
  }

  get(key: string): string | undefined {
    const picture = this.pictures.get(key);
    if (picture !== undefined) {
      this.pictures.delete(key);
      this.pictures.set(key, picture);
    }
    return picture;
  }

  put(key: string, picture: string): void {
    this.remove(key);
    const bytes = picture.length * 2;
    if (bytes > this.maxBytes || this.maxEntries <= 0) return;
    while (this.size + bytes > this.maxBytes || this.count >= this.maxEntries) {
      const first = this.pictures.keys().next().value;
      if (first === undefined) break;
      this.remove(first);
    }
    this.pictures.set(key, picture);
    this.size += bytes;
  }

  clear(): void {
    this.pictures.clear();
    this.size = 0;
  }

  private remove(key: string): void {
    const picture = this.pictures.get(key);
    if (picture === undefined) return;
    this.pictures.delete(key);
    this.size -= picture.length * 2;
  }
}
