type StageElementKind =
  | 'itemTitle'
  | 'position'
  | 'currentLabel'
  | 'currentSlide'
  | 'clock'
  | 'timer'
  | 'nextSlide'
  | 'stageMessage';

export const STARTER_TEXT_STYLE = {
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

const element = <TKind extends StageElementKind>(
  kind: TKind,
  [x, y, w, h]: readonly [number, number, number, number],
) => ({id: kind, kind, frame: {x, y, w, h}});

export const STAGE_BAR_HEIGHT = 100;

export const STARTER_STAGE_ELEMENTS = [
  element('itemTitle', [350, 26, 520, 48]),
  element('currentLabel', [875, 26, 170, 48]),
  element('stageMessage', [770, 53, 490, 42]),
  element('position', [1050, 26, 200, 48]),
  element('timer', [1640, 20, 220, 65]),
  element('clock', [1660, 1020, 200, 40]),
  element('currentSlide', [154, 130, 1612, 640]),
  element('nextSlide', [154, 840, 1612, 160]),
] as const;
