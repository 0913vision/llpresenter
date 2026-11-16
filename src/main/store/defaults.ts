import type {Label} from '@core/schema/labels';
import type {MediaList} from '@core/schema/mediaList';

/**
 * The 이름표 list before the operator changes it (`docs/spec/02-data.md`,
 * "이름표 list").
 */
export const DEFAULT_LABELS: readonly Label[] = [
  {name: '전주', color: '#7D8FD6'},
  {name: '1절', color: '#5FB8C2'},
  {name: '2절', color: '#5FB8C2'},
  {name: '3절', color: '#5FB8C2'},
  {name: '4절', color: '#5FB8C2'},
  {name: '프리코러스', color: '#8FBF7A'},
  {name: '후렴', color: '#D6B35F'},
  {name: '포스트코러스', color: '#D68F5F'},
  {name: '브리지', color: '#A99AE0'},
  {name: '간주', color: '#A3A3A3'},
  {name: '후주', color: '#7D8FD6'},
];

/** The media list before the first import: no media and no playlists. */
export const EMPTY_MEDIA_LIST: MediaList = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
