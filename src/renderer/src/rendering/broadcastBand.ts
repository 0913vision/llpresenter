import type {SlideLayer} from '@core/live/state';
import type {ThemeScreenLayout} from '@core/schema/themes';
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

/** Adapts only layouts containing the built-in band marker; saved layouts are untouched. */
export function fitBroadcastBand(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  itemTitle?: string,
): ThemeScreenLayout {
  if (!isBroadcastBandLayout(layout)) {
    return layout;
  }
  const textElement = layout.elements.find(
    element => element.id === BROADCAST_TEXT_ID,
  );
  const lines =
    slide === null
      ? []
      : textElement?.kind === 'itemName'
        ? [slide.sectionCard?.name ?? itemTitle ?? '']
        : slide.lines;
  const title =
    layout.elements.some(element => element.id === BROADCAST_TITLE_ID) &&
    !!slide?.name;
  const reference =
    layout.elements.some(element => element.id === BROADCAST_REFERENCE_ID) &&
    !!slide?.reference;
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
  } finally {
    measure.dispose();
  }
  const pitch = size * geometry.lineHeight;
  const body =
    needed > maxBody
      ? Math.floor(maxBody / pitch) * pitch
      : Math.max(pitch, Math.ceil(needed));
  const height = Math.max(
    geometry.minHeight,
    Math.min(
      geometry.maxHeight,
      Math.ceil(body + extra + geometry.padding * 2),
    ),
  );
  const bottom = geometry.height - geometry.bottom;
  const top = bottom - height;
  const bodyTop = top + geometry.padding + (title ? geometry.extraHeight : 0);
  const runtimeHidden =
    slide === null ||
    (slide.picture !== undefined &&
      slide.lines.every(line => line.trim() === '') &&
      !slide.name);
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (element.id === BROADCAST_BAND_ID && element.kind === 'box') {
        return {
          ...element,
          frame: {...element.frame, y: top, h: height},
          runtimeHidden,
          clearTarget: 'slide' as const,
        };
      }
      if (element.id === BROADCAST_TEXT_ID) {
        const frame = {
          ...element.frame,
          y: bodyTop,
          h: needed > maxBody ? body : height - geometry.padding * 2 - extra,
        };
        if (element.kind === 'currentText') {
          return {
            ...element,
            frame,
            text: {...element.text, size},
            minimumTextSize: BROADCAST_MIN_TEXT,
          };
        }
        return {...element, frame, minimumTextSize: BROADCAST_MIN_TEXT};
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
}
