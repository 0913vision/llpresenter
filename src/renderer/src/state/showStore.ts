import {create} from 'zustand';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {BibleSource} from '@renderer/show/bible/source';
import type {ItemId, ServiceRow, SlideTile} from '@renderer/show/model';

export interface ShowView {
  readonly bibleSource: BibleSource | null;
  readonly liveBibleSource: BibleSource | null;
  readonly requestedBibleSource: BibleSource | null;
  readonly librarySong: ShowLibrarySong | null;
  readonly revision: number | null;
  readonly serviceId: string | null;
  readonly serviceName: string;
  readonly readOnly: boolean;
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  readonly openItemId: ItemId | null;
  readonly selectedTile: number;
  /** Maps physical key codes to 이름표 names. */
  readonly jumpKeys: Readonly<Record<string, string>>;
}

export const noService = {
  revision: null,
  serviceId: null,
  serviceName: '',
  readOnly: false,
  rows: [],
  tiles: {},
  jumpKeys: {},
} as const satisfies Partial<ShowView>;

export const useShow = create<ShowView>(() => ({
  ...noService,
  librarySong: null,
  bibleSource: null,
  liveBibleSource: null,
  requestedBibleSource: null,
  openItemId: null,
  selectedTile: 0,
}));
