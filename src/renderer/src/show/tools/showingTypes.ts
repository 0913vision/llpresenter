import type {Screen} from '@shared/schema/screens';
import type {LooksFile} from '@shared/schema/looks';
import type {LiveState} from '@shared/live';
import type {MediaItem} from '@shared/schema/mediaList';
import type {PropsFile} from '@shared/schema/props';
import type {NoticesFile} from '@shared/schema/notices';
import type {StageLayoutsFile} from '@shared/schema/stageLayouts';
import type {ServiceRow, ItemId} from '@renderer/show/model';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
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
