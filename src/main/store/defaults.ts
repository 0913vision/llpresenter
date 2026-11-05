import type {Label} from '@core/schema/labels';
import type {MediaList} from '@core/schema/mediaList';

/**
 * The 이름표 list before the operator changes it (`docs/spec/02-data.md`,
 * "이름표 list"). Jump keys start empty.
 */
export const DEFAULT_LABELS: readonly Label[] = [
  {name: '전주', color: 'slate', key: null},
  {name: '1절', color: 'teal', key: null},
  {name: '2절', color: 'teal', key: null},
  {name: '3절', color: 'teal', key: null},
  {name: '4절', color: 'teal', key: null},
  {name: '프리코러스', color: 'green', key: null},
  {name: '후렴', color: 'yellow', key: null},
  {name: '포스트코러스', color: 'orange', key: null},
  {name: '브리지', color: 'violet', key: null},
  {name: '간주', color: 'gray', key: null},
  {name: '후주', color: 'slate', key: null},
];

/** The media list before the first import: no media and no playlists. */
export const EMPTY_MEDIA_LIST: MediaList = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
