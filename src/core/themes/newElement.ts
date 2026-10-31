import type {MediaId, ThemeElementId} from '../schema/ids';
import {roundGeometryFrame} from '../canvas/geometryValue';
import {checkPart} from '../schema/fileFormat';
import {themeElementSchema, type ThemeElement} from '../schema/themes';
import {DEFAULT_THEME_TEXT} from './defaults';
import {THEME_LIMITS, type ThemeElementKind} from './elementRules';

const TEXT_WIDTH = 800;
const TEXT_HEIGHT = 240;

/** Creates schema-checked defaults centered at a canvas point. */
export function newThemeElement({
  id,
  kind,
  point = {x: THEME_LIMITS.width / 2, y: THEME_LIMITS.height / 2},
  mediaId,
}: {
  readonly id: ThemeElementId;
  readonly kind: ThemeElementKind;
  readonly point?: {readonly x: number; readonly y: number};
  readonly mediaId?: MediaId;
}): ThemeElement | undefined {
  const full = ['media', 'background', 'overlay'].includes(kind);
  const w = full ? THEME_LIMITS.width : TEXT_WIDTH;
  const h = full ? THEME_LIMITS.height : TEXT_HEIGHT;
  const frame = roundGeometryFrame({
    x: Math.max(0, Math.min(THEME_LIMITS.width - w, point.x - w / 2)),
    y: Math.max(0, Math.min(THEME_LIMITS.height - h, point.y - h / 2)),
    w,
    h,
  });
  const base = {id, kind, frame};
  const text = {...DEFAULT_THEME_TEXT};
  const box = {on: true, fill: '#FFFFFF', opacity: 100, radius: 0};
  let value: unknown;
  switch (kind) {
    case 'currentText':
    case 'nextText':
      value = {...base, text: {...text, maxLines: 6}};
      break;
    case 'media':
    case 'background':
      value = {...base, fit: 'fit', radius: 0};
      break;
    case 'overlay':
      value = {...base, fit: 'fit'};
      break;
    case 'image':
      value = {...base, mediaId, fit: 'fit', radius: 0};
      break;
    case 'box':
      value = {...base, box};
      break;
    case 'text':
      value = {...base, text, content: '글'};
      break;
    case 'clock':
      value = {...base, text, clockFormat: '24h'};
      break;
    case 'reference':
    case 'label':
    case 'nextLabel':
    case 'itemName':
    case 'timer':
    case 'videoTimeLeft':
    case 'stageMessage':
    case 'memo':
      value = {...base, text};
      break;
  }
  const parsed = checkPart(themeElementSchema, value);
  return parsed.ok ? parsed.value : undefined;
}
