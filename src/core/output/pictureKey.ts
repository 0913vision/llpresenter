import {isReferencedTextSlide, themeOverlay} from '../themes/content';
import type {PictureRequest} from '../schema/picture';

type PictureSpec = PictureRequest['spec'];
type Layout = PictureSpec['appearance']['theme']['layout'];
const layouts = new WeakMap<Layout, string>();

function layoutKey(layout: Layout): string {
  let key = layouts.get(layout);
  if (key === undefined) {
    key = JSON.stringify(layout);
    layouts.set(layout, key);
  }
  return key;
}

/** Uses the inputs that affect a still, independent of where it is shown. */
export function pictureKey({layers, appearance}: PictureSpec): string {
  const {slide, media, prop, message, audio} = layers;
  const {screen, theme} = appearance;
  const {layout, emptyColor, item} = theme;
  const stage = screen.kind === 'stage';
  const broadcast = screen.kind === 'broadcast';
  const draws = (kind: Layout['elements'][number]['kind']): boolean =>
    layout.elements.some(element => element.kind === kind);
  const kind = slide?.kind ?? item?.kind;
  const overlay = draws('overlay')
    ? themeOverlay(item, layers, theme.sourceScreenId)
    : undefined;
  return JSON.stringify([
    screen.id,
    appearance.biblePreview,
    appearance.audience === undefined
      ? null
      : pictureKey({
          layers,
          appearance: {
            screen: appearance.audience.screen,
            theme: appearance.audience.theme,
            background: '',
            checker: false,
          },
        }),
    stage ? (appearance.stageLyricLabelPosition ?? 'line') : null,
    screen.pictureSize,
    screen.kind,
    screen.method === 'ndi' || screen.method === 'capture'
      ? screen.method
      : null,
    broadcast ? (screen.songCaption ?? 'band') : null,
    screen.correction,
    item?.contentCleared ? screen.emptyColor : null,
    theme.themeId,
    theme.sourceScreenId,
    layoutKey(layout),
    emptyColor,
    appearance.background,
    item?.kind,
    item?.contentCleared === true,
    draws('itemName') || draws('reference') || draws('label') || broadcast
      ? (item?.title ?? slide?.title)
      : null,
    broadcast ? item?.broadcastSongTitle : null,
    draws('memo') ? item?.memo : null,
    overlay?.content,
    slide === null
      ? null
      : [
          kind,
          slide.lines,
          ...(slide.textOverrides === undefined ? [] : [slide.textOverrides]),
          stage || broadcast || draws('label') ? slide.label : null,
          slide.continued === true,
          slide.biblePart,
          slide.reference,
          slide.name,
          slide.textSlideNumber,
          slide.sectionCard,
          slide.sermonTitle === true,
          slide.titleSlide === true,
          slide.titleLineCount,
          slide.titleLayout,
          slide.lyricFormat,
          slide.picture,
          stage && slide.labelContinued === true,
          stage &&
            slide.sequenceLength !== undefined &&
            slide.position >= slide.sequenceLength - 1,
          stage || draws('nextText') || draws('nextLabel') ? slide.next : null,
          broadcast ? slide.bibleItemSlides : null,
          // NOTE(0913vision): Only referenced text slides need new pictures.
          ...(isReferencedTextSlide(slide, item?.kind) ? ['scripture'] : []),
        ],
    media === null
      ? null
      : [
          media.mediaId,
          media.slidePicture === true,
          media.backgroundFrame,
          media.positionSeconds,
          media.startedAt === 0,
        ],
    prop,
    message,
    stage ? audio : null,
  ]);
}
