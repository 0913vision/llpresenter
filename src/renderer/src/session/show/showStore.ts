import {create} from 'zustand';
import type {ShowLibrarySong} from '@core/schema/songs/showLibrarySong';
import type {BibleSource} from './bibleSource';
import type {ItemId, ServiceRow, SlideTile} from '@core/presentation';

/**
 * What 진행 shows: the open 예배 순서, its tiles, and the passages and song opened
 * by themselves.
 */
export interface ShowView {
  /** The passages opened by themselves, the last one first. */
  readonly bibleSources: readonly BibleSource[];
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
  readonly selectedTile: number;
}

/** The parts of the 진행 view while no 예배 순서 is open. */
export const noService = {
  revision: null,
  serviceId: null,
  serviceName: '',
  readOnly: false,
  rows: [],
  tiles: {},
} as const satisfies Partial<ShowView>;

/** The 진행 view of this window. */
export const useShow = create<ShowView>(() => ({
  ...noService,
  serviceEpoch: 0,
  librarySong: null,
  bibleSources: [],
  openItemId: null,
  selectedTile: 0,
}));
