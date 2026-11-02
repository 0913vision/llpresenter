import type {ItemOverlay} from '@core/schema/itemOverlays';
import type {MediaItem} from '@core/schema/mediaList';
import type {Screen} from '@core/schema/screens';

/** What the 오버레이 clips need from the item they sit under. */
export interface OverlayEditing {
  readonly overlays: readonly ItemOverlay[];
  /** How many slides the item plays. */
  readonly count: number;
  /** Why nothing can change now; undefined when edits are open. */
  readonly reason: string | undefined;
  readonly screens: readonly Screen[];
  /** The screens a new 오버레이 starts on. */
  readonly defaultScreens: ReadonlyArray<Screen['id']>;
  readonly media: readonly MediaItem[];
  readonly change: (
    change: (rows: readonly ItemOverlay[]) => readonly ItemOverlay[],
  ) => Promise<boolean>;
}
