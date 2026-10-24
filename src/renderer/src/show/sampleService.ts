import type {ItemId, LabelColor, ServiceRow, SlideTile} from './model';

// TODO(0913vision): Replace this invented service with the open 예배 순서 from
// the data layer once the main process serves it.
export const sampleRows: readonly ServiceRow[] = [
  {kind: 'header', id: 'before', title: '예배 전'},
  {kind: 'media', id: 'countdown', title: '예배 전 카운트다운'},
  {kind: 'header', id: 'praise', title: '찬양'},
  {kind: 'song', id: 'song-morning', title: '아침이 밝아 오네'},
  {kind: 'song', id: 'song-river', title: '맑은 시냇물'},
  {kind: 'header', id: 'word', title: '말씀'},
  {kind: 'bible', id: 'psalm-23', title: '시편 23편 1절부터 6절'},
  {kind: 'header', id: 'closing', title: '마무리'},
  {kind: 'slot', id: 'slot-offering', title: '헌금 찬양'},
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
    labelColor: label ? (labelColors[label] ?? 'gray') : null,
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

export const sampleTiles: Readonly<Record<ItemId, readonly SlideTile[]>> = {
  'song-morning': morning,
  'song-river': river,
  'psalm-23': psalm,
  countdown: [tile(null)],
  'notice-sunday': [tile(null, '주일 광고')],
};
