import type {Label} from '@shared/schema/labels';

/**
 * The 이름표 list before the operator changes it (`docs/spec/02-data.md`,
 * "이름표 list"). Jump keys start empty.
 */
export const DEFAULT_LABELS: readonly Label[] = [
  {name: '1절', color: 'teal', key: null},
  {name: '2절', color: 'teal', key: null},
  {name: '3절', color: 'teal', key: null},
  {name: '프리코러스', color: 'green', key: null},
  {name: '후렴', color: 'yellow', key: null},
  {name: '브리지', color: 'violet', key: null},
  {name: '간주', color: 'gray', key: null},
  {name: '엔딩', color: 'none', key: null},
];
