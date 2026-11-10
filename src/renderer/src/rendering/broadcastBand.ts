import {emptyLayers, type SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {themeElementText} from '@core/themes/content';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {emptySongSlideText} from '@core/presentation/emptySongSlide';
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
import {broadcastBibleFlow} from './broadcastBibleFlow';

/** Resolves the broadcast-only Bible flow and empty-song title. */
export function broadcastIntent(
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
): {bible: boolean; songTitle: string | undefined} {
  const bible = (item?.kind ?? slide?.kind) === 'bible';
  const songTitle = emptySongSlideText(slide, item, 'title')?.replace(
    /\s+/gu,
    ' ',
  );
  return {bible, songTitle};
}

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
  const {bible, songTitle} = broadcastIntent(slide, item);
  const visible =
    slide !== null &&
    ((songTitle !== undefined &&
      layout.elements.some(
        element =>
          element.id === BROADCAST_TEXT_ID && element.kind === 'currentText',
      )) ||
      layout.elements.some(
        element =>
          [
            BROADCAST_TEXT_ID,
            BROADCAST_TITLE_ID,
            BROADCAST_REFERENCE_ID,
          ].includes(element.id) &&
          (themeElementText(element, content)?.trim().length ?? 0) > 0,
      ));
  return {
    ...layout,
    elements: layout.elements.map(element => {
      if (element.id === BROADCAST_BAND_ID && element.kind === 'box') {
        return {
          ...element,
          runtimeHidden: !visible,
          clearTarget: 'slide' as const,
        };
      }
      if (element.id === BROADCAST_TEXT_ID && element.kind === 'currentText') {
        return {
          ...element,
          broadcastBibleFlow: bible,
          broadcastSongTitle: songTitle,
        };
      }
      return element;
    }),
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
  const intent = broadcastIntent(slide, item);
  const songTitle =
    textElement?.kind === 'currentText' ? intent.songTitle : undefined;
  const text =
    songTitle ??
    (textElement === undefined ? null : themeElementText(textElement, content));
  const {bible} = intent;
  const lines =
    text === null ? [] : (bible ? broadcastBibleFlow(text) : text).split('\n');
  const valueOf = (id: typeof BROADCAST_TITLE_ID): string | null => {
    const element = layout.elements.find(entry => entry.id === id);
    return element === undefined ? null : themeElementText(element, content);
  };
  const title = (valueOf(BROADCAST_TITLE_ID)?.trim().length ?? 0) > 0;
  const reference = (valueOf(BROADCAST_REFERENCE_ID)?.trim().length ?? 0) > 0;
  const extra = (Number(title) + Number(reference)) * geometry.extraHeight;
  const preferredBody = geometry.maxHeight - geometry.padding * 2 - extra;
  const screenBody =
    geometry.height - geometry.bottom - geometry.padding * 2 - extra;
  const textStyle =
    textElement && 'text' in textElement
      ? {...DEFAULT_TEXT_STYLE, ...textElement.text, margin: 0}
      : DEFAULT_TEXT_STYLE;
  const textWidth = geometry.width - geometry.sidePadding * 2;
  let measure = measureSlideText(lines, textStyle, {
    width: textWidth,
    unwrapped: songTitle !== undefined,
  });
  let songTitleWrap = false;
  let size: number;
  let needed: number;
  try {
    if (
      songTitle !== undefined &&
      measure.width(BROADCAST_MIN_TEXT) > textWidth
    ) {
      measure.dispose();
      measure = measureSlideText(lines, textStyle, {width: textWidth});
      songTitleWrap = true;
    }
    size = songTitleWrap
      ? BROADCAST_MIN_TEXT
      : Math.max(
          BROADCAST_MIN_TEXT,
          fitFontSize(
            geometry.textSize,
            candidate =>
              measure.height(candidate) <= preferredBody &&
              (songTitle === undefined ||
                songTitleWrap ||
                measure.width(candidate) <= textWidth),
          ),
        );
    needed = measure.height(size);
    if (needed > screenBody) {
      size = fitFontSize(
        size,
        candidate => measure.height(candidate) <= screenBody,
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
        // NOTE(0913vision): An extreme slide may need less than 48 px to fit the screen.
        if (element.kind === 'currentText') {
          return {
            ...element,
            frame,
            text: {...element.text, size},
            minimumTextSize: Math.min(BROADCAST_MIN_TEXT, size),
            broadcastSongTitleWrap:
              songTitle === undefined ? undefined : songTitleWrap,
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
