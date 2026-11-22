import type {SlideTile} from '@core/presentation/model';

/** Where each tile moves from when the list changes: its slide stays its slide. */
export function tileReflowIds(
  tiles: readonly SlideTile[],
  scope: string,
): readonly string[] {
  return tiles.map(tile => `${scope}:${tile.slide.id}`);
}
