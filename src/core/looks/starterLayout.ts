import type {StageElement} from '../schema/stageLayouts';

export const STARTER_LYRIC_STYLE = {
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  lineHeight: 1.4,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 6,
  shadow: {
    on: true,
    blur: 8,
    distance: 4,
    angle: 45,
    opacity: 60,
    color: '#000000',
  },
  outline: {on: false, width: 3, color: '#000000'},
  referencePosition: 'bottomRight',
} as const;

const element = <TKind extends StageElement['kind']>(
  kind: TKind,
  name: string,
  [x, y, w, h]: readonly [number, number, number, number],
) => ({id: kind, name, kind, frame: {x, y, w, h}});

export const STARTER_STAGE_ELEMENTS = [
  element('currentLabel', '현재 이름표', [45, 49, 330, 39]),
  element('currentSlide', '현재 가사', [45, 100, 1194, 260]),
  element('clock', '시계', [1440, 60, 420, 120]),
  element('timer', '타이머', [1440, 189, 420, 60]),
  element('nextLabel', '다음 이름표', [45, 471, 1194, 38]),
  element('nextSlide', '다음 가사', [45, 520, 1194, 170]),
  element('stageMessage', '무대 메시지', [0, 960, 1920, 120]),
] as const;
