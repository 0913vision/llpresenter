import {cardOffset} from '../services/sectionCards';
import type {LiveLayers, SlideLayer} from '../live/state';
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

/** A blank or ad text slide can use Scripture body layout. */
export function isReferencedTextSlide(
  slide: Pick<
    SlideLayer,
    'kind' | 'reference' | 'picture' | 'sectionCard'
  > | null,
  itemKind?: LiveThemeItem['kind'],
): boolean {
  const kind = slide?.kind ?? itemKind;
  return (
    (kind === 'blank' || kind === 'ad') &&
    !!slide?.reference?.trim() &&
    slide.picture === undefined &&
    slide.sectionCard === undefined
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
  const position = slidePosition + 1 - (item === null ? 0 : cardOffset(item));
  if (position < 1) return undefined;
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

/** Routes a slide picture to 미디어 and an item background to 배경. */
export function themeElementMedia(
  kind: 'media' | 'background',
  {layers, item}: ThemeContent,
) {
  const content = item?.kind === 'media' || layers.media?.slidePicture === true;
  return (kind === 'media') === content ? layers.media : null;
}

/**
 * Resolves text sources once for output, previews, and editor thumbnails. A
 * clear leaves the stage timer and the stage message alone (03).
 */
export function themeElementText(
  element: ThemeElement,
  content: ThemeContent,
): string | null {
  const slot = isThemeTextElement(element) ? element.textSlot : undefined;
  const text = automaticElementText(
    element,
    slot?.role ?? element.kind,
    content,
  );
  return (
    text ?? (content.layers.slide === null ? null : (slot?.fallback ?? null))
  );
}

function automaticElementText(
  element: ThemeElement,
  role: ThemeElement['kind'],
  content: ThemeContent,
): string | null {
  const {layers, item} = content;
  const slide = layers.slide;
  const bibleReference =
    slide?.reference === undefined
      ? null
      : item?.kind === 'bible'
        ? (item.title ?? slide.reference)
        : slide.reference;
  switch (role) {
    case 'currentText': {
      if (slide === null) return null;
      const text = slide.lines.join('\n');
      return text.trim() === ''
        ? ((isThemeTextElement(element)
            ? element.textSlot?.fallback
            : undefined) ??
            (element.kind === 'currentText'
              ? element.fallbackText
              : undefined) ??
            text)
        : text;
    }
    case 'reference':
      return slide === null
        ? null
        : element.kind === 'reference' &&
            element.source === 'item' &&
            item?.kind === 'bible'
          ? bibleReference
          : (slide.reference ?? null);
    case 'nextText': {
      if (slide?.next === undefined) return null;
      const lines = slide.next.title?.trim()
        ? [slide.next.title, ...slide.next.lines]
        : slide.next.lines;
      return element.kind !== 'nextText' || element.lineLimit === undefined
        ? lines.join('\n')
        : lines
            .flatMap(line => line.split('\n'))
            .slice(0, element.lineLimit)
            .join('\n');
    }
    case 'label': {
      const hideWhenItemTitle =
        element.kind === 'label' && element.hideWhenItemTitle;
      if (hideWhenItemTitle && item?.kind === 'bible') {
        return bibleReference;
      }
      if (hideWhenItemTitle && slide?.label === (item?.title ?? slide?.title)) {
        return null;
      }
      return slide?.label ?? null;
    }
    case 'nextLabel':
      return slide?.next?.label ?? null;
    case 'itemName':
      return item?.contentCleared ? null : (item?.title ?? null);
    case 'slideName':
      return slide?.name ?? null;
    case 'slideNumber':
      return item?.kind === 'ad' &&
        slide?.picture === undefined &&
        slide?.textSlideNumber !== undefined
        ? String(slide.textSlideNumber)
        : null;
    case 'memo':
      return item?.contentCleared ? null : (item?.memo ?? null);
    case 'text':
      return element.kind === 'text' ? element.content : null;
    case 'clock':
      return content.clock ?? null;
    case 'timer':
      return content.timer ?? null;
    case 'videoTimeLeft':
      return item?.contentCleared ? null : (content.videoTimeLeft ?? null);
    case 'stageMessage':
      return content.stageMessage ?? null;
    case 'media':
    case 'background':
    case 'overlay':
    case 'image':
    case 'box':
      return null;
    default: {
      const unhandled: never = role;
      return unhandled;
    }
  }
}
