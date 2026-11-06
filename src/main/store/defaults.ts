import type {Label} from '@core/schema/labels';
import type {MediaList} from '@core/schema/mediaList';

/**
 * The 이름표 list before the operator changes it (`docs/spec/02-data.md`,
 * "이름표 list"). Jump keys start empty.
 */
export const DEFAULT_LABELS: readonly Label[] = [
  {name: '전주', color: '#7D8FD6', key: null},
  {name: '1절', color: '#5FB8C2', key: null},
  {name: '2절', color: '#5FB8C2', key: null},
  {name: '3절', color: '#5FB8C2', key: null},
  {name: '4절', color: '#5FB8C2', key: null},
  {name: '프리코러스', color: '#8FBF7A', key: null},
  {name: '후렴', color: '#D6B35F', key: null},
  {name: '포스트코러스', color: '#D68F5F', key: null},
  {name: '브리지', color: '#A99AE0', key: null},
  {name: '간주', color: '#A3A3A3', key: null},
  {name: '후주', color: '#7D8FD6', key: null},
];

/** The media list before the first import: no media and no playlists. */
export const EMPTY_MEDIA_LIST: MediaList = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
