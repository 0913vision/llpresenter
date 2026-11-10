import type {SlideLayer} from '@core/live/state';
import {emptyLayers} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeElement, ThemeScreenLayout} from '@core/schema/themes';
import type {ResolvedThemeElement} from '@core/themes/songTitle';
import {themeElementText} from '@core/themes/content';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {
  BROADCAST_TEXT_ID,
  BROADCAST_REFERENCE_ID,
} from '@core/themes/broadcastBand';
import {
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_SONG_ID,
  BROADCAST_LOOK_CARD_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_GEOMETRY as geometry,
} from '@core/themes/broadcastLook';
import {measureSlideText} from './slideLayer';
import {fitFontSize} from './fitText';
import {broadcastIntent} from './broadcastBand';
import {broadcastBibleFlow} from './broadcastBibleFlow';

type MeasureWidth = (text: string, size: number, weight?: number) => number;
type TextElement = Extract<ThemeElement, {kind: 'currentText'}>;

// NOTE(0913vision): Each document owns one probe; a failed context lookup is not cached.
const contexts = new WeakMap<Document, CanvasRenderingContext2D>();
function textWidth(
  text: string,
  size: number,
  weight: number = geometry.bodyWeight,
): number {
  let context = contexts.get(document);
  if (context === undefined) {
    context = document.createElement('canvas').getContext('2d') ?? undefined;
    if (context === undefined) {
      throw new Error(
        'Cannot measure broadcast text: canvas context unavailable',
      );
    }
    contexts.set(document, context);
  }
  context.font = `${weight} ${size}px "Pretendard Variable"`;
  return context.measureText(text).width;
}

export function isBroadcastLook(layout: ThemeScreenLayout): boolean {
  return (
    layout.mode.kind === 'own' &&
    layout.elements.some(e =>
      [
        BROADCAST_LOOK_BAND_ID,
        BROADCAST_LOOK_SONG_ID,
        BROADCAST_LOOK_CARD_ID,
      ].includes(e.id),
    )
  );
}

function fittedText({
  element,
  value,
  width,
  song,
}: {
  element: TextElement;
  value: string;
  width: number;
  song: boolean;
}): {size: number; height: number} {
  const style = {...DEFAULT_TEXT_STYLE, ...element.text, margin: 0};
  const measure = measureSlideText(value.split('\n'), style, {width});
  let size: number = song ? geometry.songSize : geometry.bodySize;
  try {
    if (
      !song &&
      measure.height(size) >
        geometry.bodyPreferredLines *
          geometry.bodySize *
          geometry.bodyLineHeight +
          geometry.measureTolerance
    ) {
      size = geometry.bodyMinSize;
    }
    if (
      song &&
      measure.height(size) >
        geometry.songLines * geometry.songSize * style.lineHeight +
          geometry.measureTolerance
    ) {
      size = fitFontSize(
        size,
        candidate =>
          measure.height(candidate) <=
          geometry.songLines * candidate * style.lineHeight +
            geometry.measureTolerance,
      );
    }
    if (!song && measure.height(size) > geometry.maxBodyHeight) {
      size = fitFontSize(
        size,
        candidate => measure.height(candidate) <= geometry.maxBodyHeight,
      );
    }
    return {
      size,
      height: Math.min(
        geometry.maxBodyHeight,
        Math.max(size * style.lineHeight, Math.ceil(measure.height(size))),
      ),
    };
  } finally {
    measure.dispose();
  }
}

function fitTab(
  element: ThemeElement,
  {
    top,
    reference,
    visible,
    widthOf,
  }: {top: number; reference: string; visible: boolean; widthOf: MeasureWidth},
): ResolvedThemeElement {
  const width = Math.min(
    geometry.screenWidth,
    Math.max(
      geometry.minExtent,
      Math.ceil(
        widthOf(reference, geometry.tabTextSize) +
          geometry.bodyX +
          geometry.tabRightPadding,
      ),
    ),
  );
  return {
    ...element,
    frame: {
      x: 0,
      y: Math.max(0, top - geometry.tabHeight),
      w: width,
      h: geometry.tabHeight,
    },
    runtimeHidden: !reference.trim() || !visible,
    clearTarget: 'slide',
  };
}

function fitBand(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  {item, widthOf}: {item: LiveThemeItem | null; widthOf: MeasureWidth},
): ThemeScreenLayout {
  const content = {layers: {...emptyLayers(), slide}, item};
  const body = layout.elements.find(
    e => e.id === BROADCAST_TEXT_ID && e.kind === 'currentText',
  );
  if (body?.kind !== 'currentText') return layout;
  const bible = (item?.kind ?? slide?.kind) === 'bible';
  const raw = themeElementText(body, content) ?? '';
  const value = bible ? broadcastBibleFlow(raw) : raw;
  const referenceElement = layout.elements.find(
    e => e.id === BROADCAST_REFERENCE_ID,
  );
  const reference =
    bible && referenceElement
      ? (themeElementText(referenceElement, content) ?? '')
      : '';
  const {size, height} = fittedText({
    element: body,
    value,
    width: geometry.bodyWidth,
    song: false,
  });
  const bandHeight = Math.max(
    geometry.bandMinHeight,
    height + geometry.bandPaddingTop + geometry.bandPaddingBottom,
  );
  const top = geometry.screenHeight - bandHeight;
  const visible =
    slide !== null &&
    !item?.contentCleared &&
    (value.trim() !== '' || reference.trim() !== '');
  const elements = layout.elements.map((e): ResolvedThemeElement => {
    if (e.id === BROADCAST_LOOK_BAND_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {x: 0, y: top, w: geometry.bandWidth, h: bandHeight},
        runtimeHidden: !visible,
        clearTarget: 'slide',
      };
    }
    if (e.id === BROADCAST_LOOK_TAB_ID && e.kind === 'box') {
      return fitTab(e, {top, reference, visible, widthOf});
    }
    if (e.id === BROADCAST_TEXT_ID && e.kind === 'currentText') {
      return {
        ...e,
        frame: {
          x: geometry.bodyX,
          y: top + geometry.bandPaddingTop,
          w: geometry.bodyWidth,
          h: height,
        },
        text: {...e.text, size},
        minimumTextSize: size,
        broadcastBibleFlow: bible,
      };
    }
    if (e.id === BROADCAST_REFERENCE_ID && e.kind === 'reference') {
      return {
        ...e,
        frame: {
          x: geometry.bodyX,
          y: Math.max(0, top - geometry.tabHeight),
          w: Math.max(
            geometry.minExtent,
            Math.min(
              geometry.screenWidth - geometry.bodyX - geometry.tabRightPadding,
              Math.ceil(
                widthOf(reference, geometry.tabTextSize) +
                  geometry.tabTextSlack,
              ),
            ),
          ),
          h: geometry.tabHeight,
        },
        text: {...e.text, vAlign: 'middle'},
        runtimeHidden: !reference.trim() || !visible,
      };
    }
    return e;
  });
  return {...layout, elements};
}

function fitSong(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  item: LiveThemeItem | null,
): ThemeScreenLayout {
  const body = layout.elements.find(
    e => e.id === BROADCAST_LOOK_SONG_ID && e.kind === 'currentText',
  );
  if (body?.kind !== 'currentText') return layout;
  const title = broadcastIntent(slide, item).songTitle;
  let value =
    title ??
    themeElementText(body, {layers: {...emptyLayers(), slide}, item}) ??
    '';
  if (value.split('\n').length > geometry.songLines) {
    value = value.replace(/\s*\n\s*/gu, ' ');
  }
  const {size, height} = fittedText({
    element: body,
    value,
    width: geometry.songWidth,
    song: true,
  });
  const elements = layout.elements.map((e): ResolvedThemeElement =>
    e.id === BROADCAST_LOOK_SONG_ID && e.kind === 'currentText'
      ? {
          ...e,
          frame: {
            x: geometry.songX,
            y: geometry.songBottom - height,
            w: geometry.songWidth,
            h: height,
          },
          text: {...e.text, size},
          minimumTextSize: size,
          broadcastText: value,
        }
      : e,
  );
  return {...layout, elements};
}

function fitCard(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  {item, widthOf}: {item: LiveThemeItem | null; widthOf: MeasureWidth},
): ThemeScreenLayout {
  const english = (
    slide?.sectionCard?.english ??
    slide?.lines.join(' ') ??
    ''
  ).toUpperCase();
  const name = item?.contentCleared
    ? ''
    : (slide?.sectionCard?.name ?? item?.title ?? '');
  const height =
    geometry.cardTop +
    geometry.cardNameHeight +
    (english ? geometry.cardEnglishGap + geometry.cardEnglishHeight : 0) +
    geometry.cardBottom;
  const width = Math.min(
    geometry.screenWidth,
    Math.max(
      geometry.cardMinWidth,
      Math.ceil(
        Math.max(
          widthOf(name, geometry.cardNameSize),
          widthOf(
            english,
            geometry.cardEnglishSize,
            geometry.cardEnglishWeight,
          ),
        ) +
          geometry.cardLeft +
          geometry.cardRight,
      ),
    ),
  );
  const visible =
    slide !== null &&
    !item?.contentCleared &&
    (name.trim() !== '' || english.trim() !== '');
  const textWidth = width - geometry.cardLeft - geometry.cardRight;
  const elements = layout.elements.map((e): ResolvedThemeElement => {
    if (e.id === BROADCAST_LOOK_CARD_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {x: 0, y: geometry.screenHeight - height, w: width, h: height},
        runtimeHidden: !visible,
        clearTarget: 'slide',
      };
    }
    if (e.id === BROADCAST_TEXT_ID && e.kind === 'itemName') {
      return {
        ...e,
        kind: 'text',
        content: visible ? name : '',
        clearTarget: 'slide',
        frame: {
          x: geometry.cardLeft,
          y: geometry.screenHeight - height + geometry.cardTop,
          w: textWidth,
          h: geometry.cardNameHeight,
        },
      };
    }
    if (e.id === BROADCAST_REFERENCE_ID && e.kind === 'currentText') {
      return {
        ...e,
        kind: 'text',
        content: visible ? english : '',
        clearTarget: 'slide',
        frame: {
          x: geometry.cardLeft,
          y:
            geometry.screenHeight -
            height +
            geometry.cardTop +
            geometry.cardNameHeight +
            geometry.cardEnglishGap,
          w: textWidth,
          h: geometry.cardEnglishFrameHeight,
        },
      };
    }
    return e;
  });
  return {...layout, elements};
}

/** Fit only the built-in layout, leaving editable unrelated layouts untouched. */
export function fitBroadcastLook(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  {
    item,
    measureWidth = textWidth,
  }: {item: LiveThemeItem | null; measureWidth?: MeasureWidth},
): ThemeScreenLayout {
  if (!isBroadcastLook(layout)) return layout;
  if (layout.elements.some(e => e.id === BROADCAST_LOOK_BAND_ID)) {
    return fitBand(layout, slide, {item, widthOf: measureWidth});
  }
  if (layout.elements.some(e => e.id === BROADCAST_LOOK_SONG_ID)) {
    return fitSong(layout, slide, item);
  }
  return fitCard(layout, slide, {item, widthOf: measureWidth});
}
