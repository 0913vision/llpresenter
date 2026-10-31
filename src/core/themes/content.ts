import type {LiveLayers} from '../live/state';
import type {LiveThemeItem} from '../schema/liveTheme';
import type {ScreenId} from '../schema/ids';
import type {ThemeElement} from '../schema/themes';
import type {ItemOverlay} from '../schema/itemOverlays';

export function isThemeTextElement(
  element: ThemeElement,
): element is Extract<ThemeElement, {readonly text: unknown}> {
  return (
    element.kind !== 'media' &&
    element.kind !== 'background' &&
    element.kind !== 'overlay' &&
    element.kind !== 'image' &&
    element.kind !== 'box'
  );
}

/** The active overlay follows the source screen of a linked composition. */
export function themeOverlay(
  item: LiveThemeItem | null,
  layers: LiveLayers,
  screen: ScreenId,
): ItemOverlay | undefined {
  if (item?.contentCleared) return undefined;
  const slidePosition = item?.slidePosition ?? layers.slide?.position;
  if (slidePosition === undefined) return undefined;
  const position = slidePosition + 1;
  return item?.overlays?.find(
    overlay =>
      overlay.from <= position &&
      overlay.to >= position &&
      overlay.screens.includes(screen),
  );
}

export interface ThemeContent {
  readonly layers: LiveLayers;
  readonly item: LiveThemeItem | null;
  readonly stageMessage?: string | null | undefined;
  readonly clock?: string | undefined;
  readonly timer?: string | undefined;
  readonly videoTimeLeft?: string | undefined;
}

/** Resolves text sources once for output, previews, and editor thumbnails. */
export function themeElementText(
  element: ThemeElement,
  content: ThemeContent,
): string | null {
  const {layers, item} = content;
  const slide = layers.slide;
  switch (element.kind) {
    case 'currentText':
      return slide?.lines.join('\n') ?? null;
    case 'reference':
      return slide?.reference ?? null;
    case 'nextText':
      return slide?.next?.lines.join('\n') ?? null;
    case 'label':
      return slide?.label ?? null;
    case 'nextLabel':
      return slide?.next?.label ?? null;
    case 'itemName':
      return item?.contentCleared ? null : (item?.title ?? null);
    case 'memo':
      return item?.contentCleared ? null : (item?.memo ?? null);
    case 'text':
      return element.content;
    case 'clock':
      return content.clock ?? null;
    case 'timer':
      return item?.contentCleared ? null : (content.timer ?? null);
    case 'videoTimeLeft':
      return item?.contentCleared ? null : (content.videoTimeLeft ?? null);
    case 'stageMessage':
      return item?.contentCleared ? null : (content.stageMessage ?? null);
    case 'media':
    case 'background':
    case 'overlay':
    case 'image':
    case 'box':
      return null;
    default: {
      const unhandled: never = element;
      return unhandled;
    }
  }
}
