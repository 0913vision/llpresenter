import {create} from 'zustand';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {BibleSource} from '@core/bible/source';
import type {ItemId, ServiceRow, SlideTile} from '@core/presentation/model';

export interface ShowView {
  readonly bibleSource: BibleSource | null;
  readonly liveBibleSource: BibleSource | null;
  readonly liveBibleExtension?: {
    readonly itemId: ItemId;
    readonly position: number;
    readonly source: BibleSource;
  } | null;
  readonly requestedBibleSource: BibleSource | null;
  readonly librarySong: ShowLibrarySong | null;
  readonly revision: number | null;
  readonly serviceId: string | null;
  /** Changes whenever the open service identity changes. */
  readonly serviceEpoch: number;
  readonly serviceName: string;
  readonly readOnly: boolean;
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  readonly openItemId: ItemId | null;
  readonly readyItemId?: ItemId | null;
  readonly readyPassage?: {
    readonly id: ItemId;
    readonly previous: ItemId | null;
    readonly previousSource: BibleSource | null;
    readonly title: string;
  } | null;
  readonly selectedTile: number;
  /** Maps physical key codes to 이름표 names. */
}

export const noService = {
  revision: null,
  serviceId: null,
  serviceName: '',
  readOnly: false,
  rows: [],
  tiles: {},
} as const satisfies Partial<ShowView>;

export const useShow = create<ShowView>(() => ({
  ...noService,
  serviceEpoch: 0,
  librarySong: null,
  bibleSource: null,
  liveBibleSource: null,
  requestedBibleSource: null,
  openItemId: null,
  readyItemId: null,
  selectedTile: 0,
}));
