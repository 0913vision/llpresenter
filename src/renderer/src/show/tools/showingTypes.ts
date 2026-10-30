import type {Screen} from '@core/schema/screens';
import type {LooksFile} from '@core/schema/looks';
import type {LiveState} from '@core/live/state';
import type {MediaItem} from '@core/schema/mediaList';
import type {PropsFile} from '@core/schema/props';
import type {NoticesFile} from '@core/schema/notices';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {ServiceRow, ItemId} from '@renderer/show/model';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {BibleSource} from '@renderer/show/bible/source';

export type ShowingKind =
  'text' | 'media' | 'msg' | 'prop' | 'notice' | 'stagemsg' | 'clock';

export type DismissDescriptor =
  | {readonly kind: 'slide'}
  | {readonly kind: 'media'}
  | {readonly kind: 'message'; readonly messageId: string}
  | {readonly kind: 'prop'; readonly propId: string}
  | {readonly kind: 'notice'}
  | {readonly kind: 'stage-message'};

export interface ShowingItem {
  readonly id: string;
  readonly kind: ShowingKind;
  readonly kindLabel: string;
  readonly icon: string;
  readonly iconTooltip?: string | undefined;
  readonly title: string;
  readonly time?: string | undefined;
  readonly dismiss?: DismissDescriptor | undefined;
}

export interface ShowingGroup {
  readonly screenId: string;
  readonly screenName: string;
  readonly items: readonly ShowingItem[];
}

export interface ComputeShowingOptions {
  readonly screens: readonly Screen[];
  readonly looks: LooksFile | null;
  readonly liveState: LiveState | null;
  readonly now: number;
  readonly rows?: readonly ServiceRow[] | undefined;
  readonly openItemId?: ItemId | null | undefined;
  readonly librarySong?: ShowLibrarySong | null | undefined;
  /** The Bible passage the live slide comes from, when it is one. */
  readonly liveBibleSource?: BibleSource | null | undefined;
  readonly mediaItems?: readonly MediaItem[] | undefined;
  readonly missingMediaIds?: ReadonlySet<string> | undefined;
  readonly propsFile?: PropsFile | null | undefined;
  readonly noticesFile?: NoticesFile | null | undefined;
  readonly stageLayoutsFile?: StageLayoutsFile | null | undefined;
}
