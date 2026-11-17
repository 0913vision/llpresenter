/** A finished picture that can leave the page and come back unchanged. */
export interface ParkedPicture {
  readonly dispose: () => void;
}

/**
 * Keeps finished slide pictures for a while after their tile unmounts, keyed
 * by what they show, so a grid that mounts again (진행 after 준비) shows them in
 * its first frame instead of an empty canvas. The oldest leave first.
 */
export class PicturePark<View extends ParkedPicture> {
  private readonly views = new Map<string, View[]>();
  private size = 0;
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  get count(): number {
    return this.size;
  }

  park(key: string, view: View): void {
    const list = this.views.get(key) ?? [];
    this.views.delete(key);
    this.views.set(key, [...list, view]);
    this.size += 1;
    while (this.size > this.limit) this.evictOldest();
  }

  take(key: string): View | undefined {
    const list = this.views.get(key);
    if (list === undefined) return undefined;
    const view = list.pop();
    if (list.length === 0) this.views.delete(key);
    if (view !== undefined) this.size -= 1;
    return view;
  }

  private evictOldest(): void {
    const oldest = this.views.entries().next();
    if (oldest.done === true) {
      this.size = 0;
      return;
    }
    const [key, list] = oldest.value;
    const view = list.shift();
    if (list.length === 0) this.views.delete(key);
    if (view === undefined) return;
    this.size -= 1;
    view.dispose();
  }
}
