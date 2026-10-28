import type {LabelColor} from '@shared/colors';
import type {ShowService} from '@shared/schema/showService';
import {applyService} from '@renderer/state/show';
import type {ItemId, ServiceRow, SlideTile} from '../model';

const sampleRows: readonly ServiceRow[] = [
  {kind: 'header', id: 'before', title: '예배 전'},
  {kind: 'media', id: 'countdown', title: '예배 전 카운트다운'},
  {kind: 'header', id: 'praise', title: '찬양'},
  {kind: 'song', id: 'song-morning', title: '아침이 밝아 오네'},
  {kind: 'song', id: 'song-river', title: '맑은 시냇물'},
  {kind: 'header', id: 'word', title: '말씀'},
  {kind: 'bible', id: 'psalm-23', title: '시편 23편 1절부터 6절'},
  {kind: 'header', id: 'offering', title: '헌금 찬양'},
  {kind: 'header', id: 'closing', title: '마무리'},
  {kind: 'notice', id: 'notice-sunday', title: '주일 광고'},
];

const labelColors: Readonly<Record<string, LabelColor>> = {
  '1절': 'teal',
  '2절': 'teal',
  후렴: 'orange',
  브리지: 'violet',
};

function tile(label: string | null, ...lines: string[]): SlideTile {
  return {
    label,
    labelColor: label ? (labelColors[label] ?? 'gray') : 'none',
    lines,
  };
}

const morning = [
  tile('1절', '아침이 밝아 오네', '새로운 노래를 부르리'),
  tile('후렴', '함께 불러요 함께 노래해요'),
  tile('2절', '낮은 언덕을 넘어', '바람이 불어 오네'),
  tile('후렴', '함께 불러요 함께 노래해요'),
];

const river = [
  tile('1절', '맑은 시냇물 흐르는 곳', '푸른 풀밭에 쉬게 하네'),
  tile('후렴', '고요한 물가로 이끄시네'),
  tile('브리지', '이끄시네 이끄시네'),
];

const psalm = [
  tile(null, '여호와는 나의 목자시니', '내가 부족함이 없으리로다'),
  tile(null, '그가 나를 푸른 풀밭에 누이시며'),
  tile(null, '쉴 만한 물 가으로 인도하시는도다'),
];

const sampleTiles: Readonly<Record<ItemId, readonly SlideTile[]>> = {
  'song-morning': morning,
  'song-river': river,
  'psalm-23': psalm,
  countdown: [tile(null)],
  'notice-sunday': [tile(null, '주일 광고')],
};

const sampleJumpKeys: Readonly<Record<string, string>> = {
  KeyC: '후렴',
  Digit1: '1절',
  Digit2: '2절',
};

export const sampleService: ShowService = {
  revision: 1,
  id: 'sample',
  name: '주일 예배',
  readOnly: false,
  rows: sampleRows,
  tiles: sampleTiles,
  jumpKeys: sampleJumpKeys,
};

/** Opens the invented sample service in the show store, for tests. */
export function seedSampleService(): void {
  applyService(null);
  applyService(sampleService);
}
