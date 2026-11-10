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
  element('itemTitle', [70, 20, 470, 65]),
  element('currentLabel', [560, 20, 180, 65]),
  element('stageMessage', [770, 20, 490, 65]),
  element('position', [1280, 20, 125, 65]),
  element('timer', [1410, 20, 190, 65]),
  element('clock', [1640, 20, 220, 65]),
  element('currentSlide', [70, 130, 1780, 650]),
  element('nextSlide', [80, 850, 1760, 180]),
] as const;
