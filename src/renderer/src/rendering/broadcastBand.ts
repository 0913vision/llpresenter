import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {
  BROADCAST_BAND_ID,
  BROADCAST_TEXT_ID,
  BROADCAST_TITLE_ID,
  BROADCAST_REFERENCE_ID,
  BROADCAST_MIN_TEXT,
  BROADCAST_GEOMETRY as geometry,
} from '@core/themes/broadcastBand';
import {measureSlideText} from './slideLayer';
import {fitFontSize} from './fitText';

/** Whether this is a built-in broadcast band rather than an unrelated layout. */
export function isBroadcastBandLayout(layout: ThemeScreenLayout): boolean {
  return (
    layout.mode.kind === 'own' &&
    layout.elements.some(
      element => element.id === BROADCAST_BAND_ID && element.kind === 'box',
    )
  );
}

/** A band only accompanies text actually supplied by its broadcast elements. */
export function withBroadcastBandVisibility(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
): ThemeScreenLayout {
  if (!isBroadcastBandLayout(layout)) return layout;
  const content = {layers: {...emptyLayers(), slide}, item};
  const visible =
    slide !== null &&
    layout.elements.some(
      element =>
        [
          BROADCAST_TEXT_ID,
          BROADCAST_TITLE_ID,
          BROADCAST_REFERENCE_ID,
        ].includes(element.id) &&
        (themeElementText(element, content)?.trim().length ?? 0) > 0,
    );
  return {
    ...layout,
    elements: layout.elements.map(element =>
      element.id === BROADCAST_BAND_ID && element.kind === 'box'
        ? {...element, runtimeHidden: !visible, clearTarget: 'slide' as const}
        : element,
    ),
  };
}

/** Adapts only layouts containing the built-in band marker; saved layouts are untouched. */
export function fitBroadcastBand(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  item: LiveThemeItem | null = null,
): ThemeScreenLayout {
  if (!isBroadcastBandLayout(layout)) {
    return layout;
  }
  const textElement = layout.elements.find(
    element => element.id === BROADCAST_TEXT_ID,
  );
  const content = {layers: {...emptyLayers(), slide}, item};
  const text =
    textElement === undefined ? null : themeElementText(textElement, content);
  const lines = text === null ? [] : text.split('\n');
  const valueOf = (id: typeof BROADCAST_TITLE_ID): string | null => {
    const element = layout.elements.find(entry => entry.id === id);
    return element === undefined ? null : themeElementText(element, content);
  };
  const title = (valueOf(BROADCAST_TITLE_ID)?.trim().length ?? 0) > 0;
  const reference = (valueOf(BROADCAST_REFERENCE_ID)?.trim().length ?? 0) > 0;
  const extra = (Number(title) + Number(reference)) * geometry.extraHeight;
  const maxBody = geometry.maxHeight - geometry.padding * 2 - extra;
  const textStyle =
    textElement && 'text' in textElement
      ? {...DEFAULT_TEXT_STYLE, ...textElement.text, margin: 0}
      : DEFAULT_TEXT_STYLE;
  const measure = measureSlideText(
    lines,
    textStyle,
    geometry.width - geometry.sidePadding * 2,
  );
  let size: number;
  let needed: number;
  try {
    size = Math.max(
      BROADCAST_MIN_TEXT,
      fitFontSize(
        geometry.textSize,
        candidate => measure.height(candidate) <= maxBody,
      ),
    );
    needed = measure.height(size);
    const availableBody =
      geometry.height - geometry.bottom - geometry.padding * 2 - extra;
    if (needed > availableBody) {
      size = fitFontSize(
        size,
        candidate => measure.height(candidate) <= availableBody,
      );
      needed = measure.height(size);
    }
  } finally {
    measure.dispose();
  }
  const pitch = size * geometry.lineHeight;
  const body = Math.max(pitch, Math.ceil(needed));
  const height = Math.max(
    geometry.minHeight,
    Math.ceil(body + extra + geometry.padding * 2),
  );
  const bottom = geometry.height - geometry.bottom;
  const top = bottom - height;
  const bodyTop = top + geometry.padding + (title ? geometry.extraHeight : 0);
  const fitted: ThemeScreenLayout = {
    ...layout,
    elements: layout.elements.map(element => {
      if (element.id === BROADCAST_BAND_ID && element.kind === 'box') {
        return {
          ...element,
          frame: {...element.frame, y: top, h: height},
        };
      }
      if (element.id === BROADCAST_TEXT_ID) {
        const frame = {
          ...element.frame,
          y: bodyTop,
          h: height - geometry.padding * 2 - extra,
        };
        if (element.kind === 'currentText') {
          return {
            ...element,
            frame,
            text: {...element.text, size},
            minimumTextSize: Math.min(BROADCAST_MIN_TEXT, size),
          };
        }
        return {
          ...element,
          frame,
          minimumTextSize: Math.min(BROADCAST_MIN_TEXT, size),
        };
      }
      if (element.id === BROADCAST_TITLE_ID) {
        return {
          ...element,
          frame: {...element.frame, y: top + geometry.padding},
        };
      }
      if (element.id === BROADCAST_REFERENCE_ID) {
        return {
          ...element,
          frame: {
            ...element.frame,
            y: bottom - geometry.padding - geometry.extraHeight,
          },
        };
      }
      return element;
    }),
  };
  return withBroadcastBandVisibility(fitted, slide, item);
}
