import {transitionPicturePlan} from '@core/presentation/transitionPictures';
import type {ServiceRow, SlideTile, TileCursor} from '@core/presentation/model';
import {TransitionPictureCache} from './transitionPictureCache';

const keyOf = (cursor: TileCursor): string =>
  JSON.stringify([cursor.itemId, cursor.index]);

/** Renders requested service pictures one at a time and discards stale work. */
export class ServicePicturePreloader {
  private readonly pictures = new TransitionPictureCache();
  private queue: TileCursor[] = [];
  private eligible = new Set<string>();
  private generation = 0;
  private busy = false;
  private inFlight: string | null = null;
  private disposed = false;

  constructor(
    private readonly render: (cursor: TileCursor) => Promise<string | null>,
  ) {}

  refresh(
    rows: readonly ServiceRow[],
    tiles: Readonly<Record<string, readonly SlideTile[]>>,
  ): void {
    if (this.disposed) return;
    this.generation += 1;
    this.pictures.clear();
    this.queue = [...transitionPicturePlan(rows, tiles)];
    this.eligible = new Set(this.queue.map(keyOf));
    this.pump();
  }

  get(cursor: TileCursor): string | undefined {
    return this.pictures.get(keyOf(cursor));
  }

  request(cursor: TileCursor): void {
    if (
      this.disposed ||
      !this.eligible.has(keyOf(cursor)) ||
      this.get(cursor) !== undefined
    ) {
      return;
    }
    const key = keyOf(cursor);
    if (
      this.inFlight !== key &&
      !this.queue.some(item => keyOf(item) === key)
    ) {
      this.queue.unshift(cursor);
    }
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.queue = [];
    this.eligible.clear();
    this.pictures.clear();
  }

  private pump(): void {
    if (this.disposed || this.busy) return;
    const cursor = this.queue.shift();
    if (cursor === undefined) return;
    const generation = this.generation;
    this.busy = true;
    this.inFlight = keyOf(cursor);
    void Promise.resolve()
      .then(() => this.render(cursor))
      .then(picture => {
        if (
          !this.disposed &&
          this.generation === generation &&
          picture !== null
        ) {
          this.pictures.put(keyOf(cursor), picture);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.busy = false;
        this.inFlight = null;
        this.pump();
      });
  }
}
