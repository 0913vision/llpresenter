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

// NOTE(0913vision): Each document owns its canvas context so tests and separate output windows never share a probe. A failed lookup is not cached.
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
  continued = false,
}: {
  element: TextElement;
  value: string;
  width: number;
  song: boolean;
  continued?: boolean;
}): {size: number; height: number} {
  const style = {...DEFAULT_TEXT_STYLE, ...element.text, margin: 0};
  const measure = measureSlideText(value.split('\n'), style, {
    width,
    continued,
  });
  let size: number = song ? geometry.songSize : geometry.bodySize;
  try {
    // NOTE(0913vision): Glyph ink may overflow a line box without adding a row.
    if (
      !song &&
      measure.layoutHeight(size) >
        geometry.bodyPreferredLines *
          geometry.bodySize *
          geometry.bodyLineHeight +
          geometry.measureTolerance
    ) {
      size = geometry.bodyMinSize;
    }
    if (
      song &&
      measure.layoutHeight(size) >
        geometry.songLines * geometry.songSize * style.lineHeight +
          geometry.measureTolerance
    ) {
      size = fitFontSize(
        size,
        candidate =>
          measure.layoutHeight(candidate) <=
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
        Math.max(
          size * style.lineHeight,
          Math.ceil(song ? measure.layoutHeight(size) : measure.height(size)),
        ),
      ),
    };
  } finally {
    measure.dispose();
  }
}

function fitBand(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  {item}: {item: LiveThemeItem | null},
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
      ? item?.title?.trim()
        ? item.title
        : (themeElementText(referenceElement, content) ?? '')
      : '';
  const fitted = fittedText({
    element: body,
    value,
    width: geometry.bodyWidth,
    song: false,
    continued: bible && slide?.continued === true,
  });
  const size = fitted.size;
  const height =
    bible && slide?.bibleItemSlides !== undefined
      ? slide.bibleItemSlides.reduce(
          (maximum, part) =>
            Math.max(
              maximum,
              fittedText({
                element: body,
                value: broadcastBibleFlow(part.lines.join('\n')),
                width: geometry.bodyWidth,
                song: false,
                continued: part.continued === true,
              }).height,
            ),
          fitted.height,
        )
      : fitted.height;
  const hasHeader = bible;
  const bandHeight =
    height +
    geometry.bodyPaddingTop +
    geometry.bodyPaddingBottom +
    (hasHeader ? geometry.headerHeight : 0);
  const top = geometry.panelBottom - bandHeight;
  const visible = slide !== null && !item?.contentCleared && !!value.trim();
  const elements = layout.elements.map((e): ResolvedThemeElement => {
    if (e.id === BROADCAST_LOOK_BAND_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {
          x: geometry.panelX,
          y: top,
          w: geometry.panelWidth,
          h: bandHeight,
        },
        runtimeHidden: !visible,
        clearTarget: 'slide',
        broadcastGlass: 'panel',
      };
    }
    if (e.id === BROADCAST_LOOK_TAB_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {
          x: geometry.panelX + geometry.frameWidth,
          y: top + geometry.frameWidth,
          w: geometry.panelWidth - 2 * geometry.frameWidth,
          h: geometry.headerHeight,
        },
        runtimeHidden: !visible || !hasHeader,
        clearTarget: 'slide',
        broadcastGlass: 'header',
      };
    }
    if (e.id === BROADCAST_TEXT_ID && e.kind === 'currentText') {
      return {
        ...e,
        frame: {
          x: geometry.bodyX,
          y:
            top +
            geometry.bodyPaddingTop +
            (hasHeader ? geometry.headerHeight : 0),
          w: geometry.bodyWidth,
          h: height,
        },
        text: {...e.text, size, ...(bible ? {vAlign: 'top' as const} : {})},
        minimumTextSize: size,
        broadcastBibleFlow: bible,
      };
    }
    if (e.id === BROADCAST_REFERENCE_ID && e.kind === 'reference') {
      return {
        ...e,
        frame: {
          x: geometry.bodyX,
          y: top + geometry.frameWidth,
          w: geometry.bodyWidth,
          h: geometry.headerHeight,
        },
        text: {...e.text, vAlign: 'middle'},
        broadcastText: reference,
        runtimeHidden: !visible || !reference.trim(),
      };
    }
    return e;
  });
  return {...layout, elements};
}

function fitSong(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
  {item, caption}: {item: LiveThemeItem | null; caption: 'band' | 'text'},
): ThemeScreenLayout {
  const body = layout.elements.find(
    e => e.id === BROADCAST_LOOK_SONG_ID && e.kind === 'currentText',
  );
  if (body?.kind !== 'currentText') return layout;
  const raw =
    broadcastIntent(slide, item).songTitle ??
    themeElementText(body, {layers: {...emptyLayers(), slide}, item}) ??
    '';
  let value = raw;
  if (value.split('\n').length > geometry.songLines) {
    value = value.replace(/\s*\n\s*/gu, ' ');
  }
  const {size, height} = fittedText({
    element: body,
    value,
    width: geometry.songWidth,
    song: true,
  });
  const padding = caption === 'band' ? geometry.songBandPadding : 0;
  const bottom =
    caption === 'band' ? geometry.songBandBottom : geometry.songTextBottom;
  const top = bottom - padding - height;
  const visible = slide !== null && !item?.contentCleared && !!value.trim();
  const text = {
    ...body.text,
    size,
    align: 'center' as const,
    color: geometry.headerTextColor,
  };
  const effect = caption === 'band' ? ('bandText' as const) : ('text' as const);
  const elements = layout.elements.map((e): ResolvedThemeElement => {
    if (e.id === BROADCAST_LOOK_BAND_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {
          x: 0,
          y: top - padding,
          w: geometry.screenWidth,
          h: height + padding * 2,
        },
        box: {
          ...e.box,
          on: true,
          fill: geometry.shadowColor,
          opacity: geometry.songBandOpacity,
        },
        runtimeHidden: !visible || caption === 'text',
        clearTarget: 'slide',
        broadcastSong: 'band',
      };
    }
    if (e.id === BROADCAST_LOOK_SONG_ID && e.kind === 'currentText') {
      return {
        ...e,
        frame: {x: geometry.songX, y: top, w: geometry.songWidth, h: height},
        text,
        minimumTextSize: size,
        broadcastText: visible ? value : '',
        broadcastSong: effect,
      };
    }
    return e;
  });
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
    geometry.cardPadding * 2 +
    geometry.cardNameHeight +
    (english ? geometry.cardEnglishGap + geometry.cardEnglishHeight : 0);
  const width = Math.min(
    geometry.screenWidth - geometry.panelX,
    Math.ceil(
      Math.max(
        widthOf(name, geometry.cardNameSize),
        widthOf(english, geometry.cardEnglishSize, geometry.cardEnglishWeight),
      ) +
        geometry.cardPadding * 2,
    ),
  );
  const visible =
    slide !== null &&
    !item?.contentCleared &&
    (name.trim() !== '' || english.trim() !== '');
  const textWidth = width - geometry.cardPadding * 2;
  const elements = layout.elements.map((e): ResolvedThemeElement => {
    if (e.id === BROADCAST_LOOK_CARD_ID && e.kind === 'box') {
      return {
        ...e,
        frame: {
          x: geometry.panelX,
          y: geometry.panelBottom - height,
          w: width,
          h: height,
        },
        broadcastGlass: 'panel',
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
          x: geometry.panelX + geometry.cardPadding,
          y: geometry.panelBottom - height + geometry.cardPadding,
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
          x: geometry.panelX + geometry.cardPadding,
          y:
            geometry.panelBottom -
            height +
            geometry.cardPadding +
            geometry.cardNameHeight +
            geometry.cardEnglishGap,
          w: textWidth,
          h: geometry.cardEnglishHeight,
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
    songCaption = 'band',
  }: {
    item: LiveThemeItem | null;
    measureWidth?: MeasureWidth;
    songCaption?: 'band' | 'text';
  },
): ThemeScreenLayout {
  if (!isBroadcastLook(layout)) return layout;
  if (layout.elements.some(e => e.id === BROADCAST_LOOK_SONG_ID)) {
    return fitSong(layout, slide, {item, caption: songCaption});
  }
  if (layout.elements.some(e => e.id === BROADCAST_LOOK_BAND_ID)) {
    return fitBand(layout, slide, {item});
  }
  return fitCard(layout, slide, {item, widthOf: measureWidth});
}
