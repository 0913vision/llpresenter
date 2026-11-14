import {BROADCAST_LOOK_GEOMETRY as glass} from '@core/themes/broadcastLook';
import type {LiveLayers, MediaLayer} from '@core/live/state';
import {mediaObjectFit} from '@core/media/objectFit';
import type {ResolvedThemeElement} from '@core/themes/songTitle';
import type {TextStyle} from '@core/themes/textStyle';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {themeTextVAlign} from '@core/themes/textAlignment';
import {STAGE_COLORS} from '@core/themes/stageColors';
import {
  isThemeTextElement,
  themeElementText,
  themeElementMedia,
  themeOverlay,
} from '@core/themes/content';
import {BackgroundLayerView} from './backgroundLayer';
import {SlideLayerView, STAGE_NEXT_MIN_SIZE} from './slideLayer';
import {classes} from './classes';
import {stageClockText} from './stageClock';
import {fillTimerTokens} from './timerTokens';
import type {RenderFrame, RenderLayerOptions} from './layer';
import type {ThemeGaps} from './themeGaps';
import {setPlaybackProblem} from './playbackProblem';
import {broadcastBibleFlow} from './broadcastBibleFlow';
import {SECTION_BAND_ID, SECTION_NAME_ID} from '@core/themes/sectionBroadcast';
import {sectionBandGradient} from './sectionBandGradient';

function fillColor(fill: string, opacity: number): string {
  const [red, green, blue] = [1, 3, 5].map(at =>
    Number.parseInt(fill.slice(at, at + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}

/** Paints the glass as opaque shapes on the chroma-key capture window. */
export function styleBroadcastGlass(
  background: HTMLElement,
  kind: 'panel' | 'header',
  capture: boolean,
): void {
  if (kind === 'header') {
    const fadeTarget = capture ? glass.panelColor : 'transparent';
    background.style.background = `linear-gradient(90deg, color-mix(in srgb, ${glass.headerColor} ${glass.headerOpacity}%, ${fadeTarget}), ${fadeTarget} ${glass.headerFade}%)`;
    background.style.borderRadius = `${glass.radius - glass.frameWidth}px ${glass.radius - glass.frameWidth}px 0 0`;
    return;
  }
  background.style.backgroundColor = 'transparent';
  background.style.boxSizing = 'border-box';
  background.style.border = `${glass.frameWidth}px solid ${capture ? glass.frameColor : `color-mix(in srgb, ${glass.frameColor} ${glass.frameOpacity}%, transparent)`}`;
  background.style.borderRadius = `${glass.radius}px`;
  background.style.boxShadow = capture
    ? 'none'
    : `0 0 ${glass.shadowBlur}px color-mix(in srgb, ${glass.shadowColor} ${glass.shadowOpacity}%, transparent)`;
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'absolute',
    inset: '0',
    borderRadius: `${glass.radius - glass.frameWidth}px`,
    backgroundColor: capture
      ? glass.panelColor
      : `color-mix(in srgb, ${glass.panelColor} ${glass.panelOpacity}%, transparent)`,
  });
  background.append(panel);
}

function remainingText(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The elements that show the lyrics: they follow the 슬라이드 전환. */
const SLIDE_ELEMENT_KINDS: readonly string[] = [
  'currentText',
  'reference',
  'slideName',
  'slideNumber',
  'nextText',
  'label',
  'nextLabel',
];

/** One persistent element with owned text pages, images, and video decoders. */
export class ThemeElementView {
  private readonly box = document.createElement('div');
  private y = 0;
  private readonly text: SlideLayerView | null;
  private media: BackgroundLayerView | null = null;
  private readonly image: HTMLImageElement | null;
  private imageReady = true;
  private imageGeneration = 0;
  private readonly options: RenderLayerOptions;
  private readonly gaps: ThemeGaps;
  private shownText: string | null = null;
  private shownSlideKey: string | null = null;
  private shownContinued = false;
  private shownBiblePart: number | undefined;
  private readonly previewMaxLines: number | undefined;
  private mediaId: string | null = null;
  private mediaStartedAt: number | null = null;
  private readonly reportMediaError = (): void => {
    if (this.mediaId !== null) this.gaps.missing('media', this.mediaId);
  };

  constructor(
    readonly element: ResolvedThemeElement,
    parent: HTMLElement,
    {
      options,
      gaps,
      capture = false,
    }: {
      readonly options: RenderLayerOptions;
      readonly gaps: ThemeGaps;
      readonly capture?: boolean;
    },
  ) {
    this.options = options;
    this.gaps = gaps;
    const {frame} = element;
    this.y = frame.y;
    this.previewMaxLines =
      options.biblePreview?.elementId === element.id
        ? options.biblePreview.maxLines
        : undefined;
    Object.assign(this.box.style, {
      position: 'absolute',
      left: `${frame.x}px`,
      top: `${frame.y}px`,
      width: `${frame.w}px`,
      height: `${element.kind === 'box' ? (element.drawHeight ?? frame.h) : frame.h}px`,
      overflow: 'hidden',
      isolation: 'isolate',
    });
    this.box.dataset['themeElement'] = element.id;
    this.box.dataset['kind'] = element.kind;
    let textParent = this.box;
    if (this.previewMaxLines !== undefined && element.kind === 'currentText') {
      const height =
        element.text.size * element.text.lineHeight * this.previewMaxLines;
      const ratio = {top: 0, middle: 0.5, bottom: 1}[element.text.vAlign];
      this.box.style.overflow = 'visible';
      textParent = document.createElement('div');
      Object.assign(textParent.style, {
        position: 'absolute',
        left: '0',
        width: '100%',
        top: `${(frame.h - height) * ratio}px`,
        height: `${height}px`,
      });
      const guide = document.createElement('div');
      guide.className = classes.bibleGuide;
      textParent.append(guide);
    }
    parent.append(this.box);
    const fill =
      element.kind === 'box' || isThemeTextElement(element)
        ? element.box
        : undefined;
    if (fill?.on === true) {
      const background = document.createElement('div');
      Object.assign(background.style, {
        position: 'absolute',
        inset: '0',
        backgroundColor: fillColor(fill.fill, fill.opacity),
        borderRadius: `${fill.radius ?? 0}px`,
      });
      if (element.broadcastGlass !== undefined) {
        styleBroadcastGlass(background, element.broadcastGlass, capture);
        this.box.style.overflow = 'visible';
      }
      if (element.id === SECTION_BAND_ID) {
        background.style.background = sectionBandGradient;
        background.style.borderRadius = '0';
      }
      this.box.append(background);
    }
    if ('radius' in element) {
      this.box.style.borderRadius = `${element.radius}px`;
    }
    if (textParent !== this.box) this.box.append(textParent);
    this.text =
      isThemeTextElement(element) || element.kind === 'overlay'
        ? new SlideLayerView(
            textParent,
            DEFAULT_TEXT_STYLE,
            this.previewMaxLines,
          )
        : null;
    if (
      element.broadcastSong === 'bandText' ||
      element.broadcastSong === 'text'
    ) {
      this.box.style.overflow = 'visible';
      const shadow = capture
        ? `${glass.songTextShadowOffset}px ${glass.songTextShadowOffset}px 0 ${glass.shadowColor}`
        : element.broadcastSong === 'bandText'
          ? `0 ${glass.songTextShadowOffset}px ${glass.songBandShadowBlur}px color-mix(in srgb, ${glass.shadowColor} ${glass.songBandShadowOpacity}%, transparent)`
          : `${glass.songTextShadowOffset}px ${glass.songTextShadowOffset}px ${glass.songTextShadowBlur}px color-mix(in srgb, ${glass.shadowColor} ${glass.songTextShadowOpacity}%, transparent), 0 0 ${glass.songGlowBlur}px color-mix(in srgb, ${glass.shadowColor} ${glass.songGlowOpacity}%, transparent)`;
      for (const block of textParent.querySelectorAll<HTMLElement>(
        `.${classes.block}`,
      )) {
        block.style.textShadow = shadow;
      }
    }
    if (isThemeTextElement(element)) this.text?.setFitLines(element.fitLines);
    if (element.minimumTextSize !== undefined) {
      this.text?.setMinimumSize(element.minimumTextSize);
    }
    this.image =
      element.kind === 'image' ? document.createElement('img') : null;
    if (element.kind === 'image' && this.image !== null) {
      this.imageReady = false;
      this.image.alt = '';
      Object.assign(this.image.style, {
        width: '100%',
        height: '100%',
        objectFit: mediaObjectFit(element.fit),
      });
      this.image.onerror = () => {
        this.imageGeneration++;
        this.imageReady = true;
        setPlaybackProblem(this.box, 'media-missing', true);
        this.gaps.missing('media', element.mediaId);
        if (this.image !== null) this.image.hidden = true;
      };
      this.image.onload = () => {
        const image = this.image;
        if (image === null) return;
        const generation = ++this.imageGeneration;
        const src = image.getAttribute('src');
        this.imageReady = false;
        image.decode().then(
          () => {
            if (
              generation !== this.imageGeneration ||
              image.getAttribute('src') !== src
            ) {
              return;
            }
            this.imageReady = true;
            setPlaybackProblem(this.box, 'media-missing', false);
            image.hidden = false;
          },
          () => {
            if (
              generation !== this.imageGeneration ||
              image.getAttribute('src') !== src
            ) {
              return;
            }
            image.onerror?.(new Event('error'));
          },
        );
      };
      try {
        this.image.src = options.mediaUrl(element.mediaId);
      } catch {
        this.imageReady = true;
        setPlaybackProblem(this.box, 'media-missing', true);
        this.gaps.missing('media', element.mediaId);
        this.image.hidden = true;
      }
      this.box.append(this.image);
    }
  }

  render(
    layers: LiveLayers,
    frame: RenderFrame,
    videoRemaining?: number,
  ): void {
    if (this.previewMaxLines !== undefined) {
      this.box.dataset['overflow'] = String(
        (layers.slide?.lines.length ?? 0) > this.previewMaxLines,
      );
    }
    const {element} = this;
    if (element.runtimeHidden !== undefined) {
      this.box.hidden = element.runtimeHidden;
    }
    const item = frame.theme?.item ?? null;
    const stage = frame.screen?.kind === 'stage';
    const slide = layers.slide;
    const finalBible =
      (slide?.kind ?? item?.kind) === 'bible' &&
      slide?.sequenceLength !== undefined &&
      slide.position >= slide.sequenceLength - 1;
    const currentEmpty =
      stage &&
      element.kind === 'currentText' &&
      slide !== null &&
      slide.picture === undefined &&
      slide.sectionCard === undefined &&
      item?.contentCleared !== true &&
      !slide.lines.some(line => line.trim() !== '');
    const next = slide?.next;
    const nextEmpty =
      stage &&
      element.kind === 'nextText' &&
      !finalBible &&
      next !== undefined &&
      !next.title?.trim() &&
      !next.lines.some(line => line.trim() !== '');
    const currentLabel = slide?.label?.trim();
    const nextLabel = next?.label?.trim();
    const cue = currentEmpty
      ? ((currentLabel ? `(${currentLabel})` : undefined) ??
        (element.fallbackText?.trim() ? undefined : '(\uc5c6\uc74c)'))
      : nextEmpty
        ? ((nextLabel ? `(${nextLabel})` : undefined) ?? '(\uc5c6\uc74c)')
        : undefined;
    this.text?.setMinimumSize(
      stage && element.kind === 'nextText'
        ? Math.max(STAGE_NEXT_MIN_SIZE, element.minimumTextSize ?? 0)
        : element.minimumTextSize,
    );
    const kind =
      element.kind === 'nextText'
        ? (layers.slide?.next?.itemKind ?? item?.kind)
        : item?.kind;
    const isBar =
      frame.theme?.layout.stageBar === 'message-row' &&
      (element.kind === 'label' ||
        (element.kind === 'text' &&
          (element.stageSource === 'stageItemName' ||
            element.stageSource === 'stagePosition')));
    const isSong =
      kind === 'song' &&
      (element.kind === 'nextText' ||
        (element.kind === 'currentText' &&
          layers.slide?.sectionCard === undefined));
    this.text?.setLineMode(
      (element.broadcastSongTitle !== undefined &&
        element.broadcastSongTitleWrap === false) ||
        (stage && isBar)
        ? 'bar'
        : stage && isSong
          ? 'song'
          : 'normal',
    );
    if (element.kind === 'media' || element.kind === 'background') {
      const media = themeElementMedia(element.kind, {layers, item});
      this.showMedia(media, frame, element.fit);
    } else if (element.kind === 'overlay') {
      const overlay =
        frame.theme === undefined
          ? undefined
          : themeOverlay(item, layers, frame.theme.sourceScreenId);
      const content = overlay?.content;
      if (
        content !== undefined &&
        'media' in content &&
        typeof content.media === 'string' &&
        typeof content.loop === 'boolean'
      ) {
        this.showMedia(
          {
            mediaId: content.media,
            loop: content.loop,
            startedAt: item?.overlayStartedAt ?? item?.startedAt ?? 0,
          },
          frame,
          element.fit,
        );
        this.showText(null, frame);
      } else {
        this.showMedia(null, frame, element.fit);
        this.showText(
          content !== undefined &&
            'text' in content &&
            typeof content.text === 'string'
            ? content.text
            : null,
          frame,
        );
      }
    } else {
      this.showText(
        cue ?? this.textContent(layers, frame, videoRemaining),
        frame,
        {
          cue: cue !== undefined,
          vAlign:
            cue !== undefined
              ? 'middle'
              : isThemeTextElement(element)
                ? themeTextVAlign(element, layers.slide?.lines.join('\n') ?? '')
                : undefined,
          continued:
            (element.kind === 'currentText'
              ? layers.slide?.continued
              : element.kind === 'nextText'
                ? layers.slide?.next?.continued
                : false) === true,
          biblePart:
            element.kind === 'currentText'
              ? (layers.slide?.biblePart ??
                (this.previewMaxLines === undefined ? undefined : 1))
              : element.kind === 'nextText'
                ? layers.slide?.next?.biblePart
                : undefined,
        },
      );
    }
    if ([SECTION_BAND_ID, SECTION_NAME_ID].includes(element.id)) {
      this.box.hidden = layers.slide === null || item?.contentCleared === true;
    }
    this.setClearOpacity(frame.clearOpacity);
    if (
      element.broadcastSong === 'bandText' ||
      element.broadcastSong === 'text'
    ) {
      this.box.style.overflow = 'visible';
    }
  }

  setClearOpacity(clearOpacity: RenderFrame['clearOpacity']): void {
    const {element} = this;
    const target =
      element.clearTarget === 'slide' ||
      [SECTION_BAND_ID, SECTION_NAME_ID].includes(element.id) ||
      SLIDE_ELEMENT_KINDS.includes(element.kind)
        ? 'slide'
        : element.kind === 'media' || element.kind === 'background'
          ? 'media'
          : undefined;
    const opacity = String(
      target === undefined ? 1 : (clearOpacity?.[target] ?? 1),
    );
    if (this.box.style.opacity !== opacity) this.box.style.opacity = opacity;
  }

  /** Timed elements leave the DOM untouched until their displayed value changes. */
  tick(layers: LiveLayers, frame: RenderFrame, videoRemaining?: number): void {
    const text = this.textContent(layers, frame, videoRemaining);
    if (text !== this.shownText) this.showText(text, frame);
  }

  private textContent(
    layers: LiveLayers,
    frame: RenderFrame,
    videoRemaining?: number,
  ): string | null {
    const {element} = this;
    const timer =
      element.kind === 'timer' &&
      (element.timerId ?? frame.stageTimerId) !== undefined &&
      frame.timers !== undefined
        ? fillTimerTokens(
            `{timer:${element.timerId ?? frame.stageTimerId}}`,
            frame.timers,
            frame.timers.now(),
          )
        : undefined;
    const item = frame.theme?.item ?? null;
    const slide = layers.slide;
    if (
      frame.screen?.kind === 'stage' &&
      slide?.sectionCard !== undefined &&
      (element.kind === 'itemName' || element.kind === 'currentText')
    ) {
      return slide.sectionCard.name;
    }
    if (
      frame.screen?.kind === 'stage' &&
      slide?.titleSlide &&
      element.kind === 'currentText'
    ) {
      return slide.lines[0] ?? '';
    }
    if (
      frame.screen?.kind === 'stage' &&
      (element.kind === 'nextText' || element.kind === 'nextLabel') &&
      (slide?.kind ?? item?.kind) === 'bible' &&
      slide?.sequenceLength !== undefined &&
      slide.position >= slide.sequenceLength - 1
    ) {
      return null;
    }
    const reflow =
      frame.screen?.kind === 'stage' || frame.screen?.kind === 'broadcast';
    const currentBible =
      element.kind === 'currentText' &&
      slide?.sectionCard === undefined &&
      (slide?.biblePart !== undefined ||
        (slide?.kind ?? item?.kind) === 'bible');
    const nextBible =
      element.kind === 'nextText' &&
      slide?.next !== undefined &&
      (slide.next.biblePart !== undefined ||
        (slide.next.itemKind ?? slide.kind ?? item?.kind) === 'bible');
    this.box.style.textWrap =
      reflow &&
      (currentBible || nextBible) &&
      !(frame.screen.kind === 'broadcast' && currentBible)
        ? 'balance'
        : '';
    const flowedLayers =
      !reflow || slide === null
        ? layers
        : {
            ...layers,
            slide: {
              ...slide,
              ...(currentBible
                ? {lines: [broadcastBibleFlow(slide.lines.join('\n'))]}
                : {}),
              ...(nextBible
                ? {
                    next: {
                      ...slide.next,
                      lines: [broadcastBibleFlow(slide.next.lines.join('\n'))],
                    },
                  }
                : {}),
            },
          };
    const nextTitleSlide =
      frame.screen?.kind === 'stage' &&
      element.kind === 'nextText' &&
      flowedLayers.slide?.next?.titleSlide === true;
    const displayLayers = nextTitleSlide
      ? {
          ...flowedLayers,
          slide: {
            ...flowedLayers.slide,
            next: {
              ...flowedLayers.slide.next,
              lines: flowedLayers.slide.next.lines.slice(0, 1),
            },
          },
        }
      : flowedLayers;
    const text = themeElementText(element, {
      layers: displayLayers,
      item,
      stageMessage: frame.stageMessage,
      clock:
        element.kind === 'clock'
          ? stageClockText(
              frame.timers?.now().wall ?? Date.now(),
              element.clockFormat,
              element.seconds,
            )
          : undefined,
      timer,
      videoTimeLeft: remainingText(videoRemaining),
    });
    if (
      frame.screen?.kind === 'stage' &&
      element.kind === 'nextText' &&
      slide?.next?.label?.trim() &&
      text?.trim()
    ) {
      return `${text} (${slide.next.label.trim()})`;
    }
    if (element.id === SECTION_NAME_ID && slide?.sectionCard !== undefined) {
      return slide.sectionCard.name;
    }
    if (element.broadcastText !== undefined) return element.broadcastText;
    if (element.broadcastSongTitle !== undefined) {
      return element.broadcastSongTitle;
    }
    return text !== null && element.broadcastBibleFlow
      ? broadcastBibleFlow(text)
      : text;
  }

  private showMedia(
    media: MediaLayer | null,
    frame: RenderFrame,
    fit: 'fit' | 'fill' | 'stretch',
  ): void {
    if (media !== null && this.media === null) {
      this.media = new BackgroundLayerView(this.box, {
        ...this.options,
        muted: true,
        onError: this.reportMediaError,
      });
    }
    if (
      this.media !== null &&
      frame.transitionTimes !== undefined &&
      this.element.kind !== 'overlay'
    ) {
      this.media.setDissolveMs(frame.transitionTimes.backgroundMs);
    }
    this.mediaId = media?.mediaId ?? null;
    if (
      this.element.kind === 'overlay' &&
      media !== null &&
      this.mediaStartedAt !== null &&
      this.mediaStartedAt !== media.startedAt
    ) {
      this.media?.show(null, false);
    }
    this.mediaStartedAt = media?.startedAt ?? null;
    const corrected =
      media === null
        ? null
        : {
            ...media,
            properties: {
              ...(media.properties ?? {speed: 1, volume: 100, audio: false}),
              fit,
            },
          };
    if (
      (this.element.kind === 'media' || this.element.kind === 'background') &&
      frame.clearOpacity?.media !== undefined &&
      media !== null
    ) {
      this.media?.hold();
    } else {
      try {
        this.media?.show(corrected, frame.transitions, frame.standby);
        setPlaybackProblem(this.box, 'media-missing', false);
      } catch {
        setPlaybackProblem(this.box, 'media-missing', true);
        if (this.mediaId !== null) this.gaps.missing('media', this.mediaId);
        this.media?.show(null, false);
      }
    }
  }

  private showText(
    text: string | null,
    frame: RenderFrame,
    {
      continued = false,
      biblePart,
      vAlign,
      cue = false,
    }: {
      readonly continued?: boolean;
      readonly biblePart?: number | undefined;
      readonly vAlign?: TextStyle['vAlign'] | undefined;
      readonly cue?: boolean;
    } = {},
  ): void {
    if (this.text === null) return;
    if (
      this.element.kind !== 'overlay' &&
      this.box.hidden !== (text === null)
    ) {
      this.box.hidden = text === null;
    }
    let style: TextStyle = DEFAULT_TEXT_STYLE;
    if (isThemeTextElement(this.element)) {
      const textStyle = this.element.text;
      const known = frame.fonts?.some(
        font =>
          font.family === textStyle.font ||
          font.aliases.includes(textStyle.font),
      );
      const bundled = ['Pretendard', 'Pretendard Variable'].includes(
        textStyle.font,
      );
      setPlaybackProblem(
        this.box,
        'font-missing',
        text !== null && text !== '' && known === false && !bundled,
      );
      if (known === false && !bundled) {
        this.gaps.missing('font', textStyle.font);
      }
      style = {
        ...textStyle,
        ...(cue ? {color: STAGE_COLORS.muted, align: 'center' as const} : {}),
        vAlign: vAlign ?? textStyle.vAlign,
        font:
          known === false && !bundled ? 'Pretendard Variable' : textStyle.font,
        margin: 0,
        maxLines:
          'maxLines' in textStyle && typeof textStyle.maxLines === 'number'
            ? textStyle.maxLines
            : 12,
      };
    }
    this.text.setStyle(style);
    if (frame.transitions === false || frame.standby) {
      this.text.finishTransition();
    }
    if (
      frame.transitionTimes !== undefined &&
      SLIDE_ELEMENT_KINDS.includes(this.element.kind)
    ) {
      this.text.setDissolveMs(frame.transitionTimes.slideMs);
      if (frame.slideTransition !== undefined) {
        this.text.setTransition(frame.slideTransition, this.element.frame);
        this.box.style.overflow =
          frame.slideTransition.kind === 'push' ? 'visible' : 'hidden';
      }
    }
    const slideKey =
      SLIDE_ELEMENT_KINDS.includes(this.element.kind) &&
      frame.slide !== undefined
        ? `${frame.slide.itemId}:${frame.slide.position}`
        : null;
    if (
      slideKey === this.shownSlideKey &&
      text === this.shownText &&
      continued === this.shownContinued &&
      biblePart === this.shownBiblePart
    ) {
      return;
    }
    const ticking = ['clock', 'timer', 'videoTimeLeft'].includes(
      this.element.kind,
    );
    if (ticking && this.shownText !== null && text !== null) {
      this.text.replaceLines(text.split('\n'));
    } else {
      this.text.show(
        text === null
          ? null
          : {
              itemId: frame.theme?.item?.id ?? 'standby',
              position: frame.slide?.position ?? 0,
              label: null,
              lines: text.split('\n'),
              continued,
              ...(biblePart === undefined ? {} : {biblePart}),
            },
        frame.transitions !== false &&
          (frame.screen === undefined || frame.screen.kind === 'audience'),
      );
    }
    this.shownText = text;
    this.shownSlideKey = slideKey;
    this.shownContinued = continued;
    this.shownBiblePart = biblePart;
  }

  textBounds(ink = false): {top: number; bottom: number} | undefined {
    const bounds = ink ? this.text?.inkBounds() : this.text?.lineBoxBounds();
    const box = this.box.getBoundingClientRect();
    const scale = box.width / this.element.frame.w;
    if (bounds === undefined || scale <= 0) return undefined;
    return {
      top: this.y + (bounds.top - box.top) / scale,
      bottom: this.y + (bounds.bottom - box.top) / scale,
    };
  }

  setY(y: number): void {
    this.y = y;
    const gridY = Math.round(y * 64) / 64;
    this.box.style.top = `${gridY}px`;
    this.box.style.transform = `translateY(${y - gridY}px)`;
  }

  fittedTextSize(): number | undefined {
    return this.text?.fittedSize();
  }

  targetTextSize(target: number | undefined): void {
    this.text?.setTargetSize(target);
  }

  capTextSize(maximum: number | undefined): void {
    this.text?.capSize(maximum);
  }

  remaining(): number | undefined {
    return this.media?.remaining();
  }

  ready(): boolean {
    return this.imageReady && (this.media?.ready() ?? true);
  }

  /** Retains a matching player's decoder and playback position across themes. */
  retainMedia(
    previous: ThemeElementView,
    layers: LiveLayers,
    frame: RenderFrame,
  ): void {
    if (this.element.kind !== 'background' && this.element.kind !== 'media') {
      return;
    }
    const media = themeElementMedia(this.element.kind, {
      layers,
      item: frame.theme?.item ?? null,
    });
    if (
      this.media !== null ||
      media === null ||
      previous.media === null ||
      !previous.media.ready() ||
      previous.mediaId !== media.mediaId ||
      previous.mediaStartedAt !== media.startedAt
    ) {
      return;
    }
    if (!previous.media.moveTo(this.box)) return;
    this.media = previous.media;
    this.media.setOnError(this.reportMediaError);
    previous.media = null;
    this.mediaId = previous.mediaId;
    this.mediaStartedAt = previous.mediaStartedAt;
  }

  dispose(): void {
    this.imageGeneration++;
    this.media?.dispose();
    this.text?.dispose();
    if (this.image !== null) {
      this.image.onerror = null;
      this.image.onload = null;
      this.image.removeAttribute('src');
    }
    this.box.remove();
  }
}
