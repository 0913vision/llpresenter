type StageElementKind =
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

export const STAGE_BAR_GROUP_TOP_WITH_MESSAGE = 2;

export const STARTER_STAGE_ELEMENTS = [
  element('currentLabel', [865, 26, 190, 48]),
  element('stageMessage', [770, 53, 400, 42]),
  element('timer', [1210, 20, 220, 65]),
  element('clock', [1460, 20, 400, 80]),
  element('currentSlide', [154, 130, 1612, 568]),
  element('nextSlide', [154, 706, 1612, 272]),
] as const;
