import type {LiveLayers, MediaLayer} from '@core/live/state';
import {mediaObjectFit} from '@core/media/objectFit';
import type {ResolvedThemeElement} from '@core/themes/songTitle';
import type {TextStyle} from '@core/themes/textStyle';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {themeTextVAlign} from '@core/themes/textAlignment';
import {
  isThemeTextElement,
  themeElementText,
  themeElementMedia,
  themeOverlay,
} from '@core/themes/content';
import {BackgroundLayerView} from './backgroundLayer';
import {SlideLayerView} from './slideLayer';
import {classes} from './classes';
import {stageClockText} from './stageClock';
import {fillTimerTokens} from './timerTokens';
import type {RenderFrame, RenderLayerOptions} from './layer';
import type {ThemeGaps} from './themeGaps';

function fillColor(fill: string, opacity: number): string {
  const [red, green, blue] = [1, 3, 5].map(at =>
    Number.parseInt(fill.slice(at, at + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
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
  private readonly text: SlideLayerView | null;
  private media: BackgroundLayerView | null = null;
  private readonly image: HTMLImageElement | null;
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
    }: {readonly options: RenderLayerOptions; readonly gaps: ThemeGaps},
  ) {
    this.options = options;
    this.gaps = gaps;
    const {frame} = element;
    this.previewMaxLines =
      options.biblePreview?.elementId === element.id
        ? options.biblePreview.maxLines
        : undefined;
    Object.assign(this.box.style, {
      position: 'absolute',
      left: `${frame.x}px`,
      top: `${frame.y}px`,
      width: `${frame.w}px`,
      height: `${frame.h}px`,
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
    this.image =
      element.kind === 'image' ? document.createElement('img') : null;
    if (element.kind === 'image' && this.image !== null) {
      this.image.alt = '';
      Object.assign(this.image.style, {
        width: '100%',
        height: '100%',
        objectFit: mediaObjectFit(element.fit),
      });
      this.image.onerror = () => {
        this.gaps.missing('media', element.mediaId);
        if (this.image !== null) this.image.hidden = true;
      };
      try {
        this.image.src = options.mediaUrl(element.mediaId);
      } catch {
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
    const item = frame.theme?.item ?? null;
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
      this.showText(this.textContent(layers, frame, videoRemaining), frame, {
        vAlign: isThemeTextElement(element)
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
      });
    }
    this.setClearOpacity(frame.clearOpacity);
  }

  setClearOpacity(clearOpacity: RenderFrame['clearOpacity']): void {
    const {element} = this;
    const target =
      element.clearTarget === 'slide' ||
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
    return themeElementText(element, {
      layers,
      item: frame.theme?.item ?? null,
      stageMessage: frame.stageMessage,
      clock:
        element.kind === 'clock'
          ? stageClockText(
              frame.timers?.now().wall ?? Date.now(),
              element.clockFormat,
            )
          : undefined,
      timer,
      videoTimeLeft: remainingText(videoRemaining),
    });
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
      } catch {
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
    }: {
      readonly continued?: boolean;
      readonly biblePart?: number | undefined;
      readonly vAlign?: TextStyle['vAlign'] | undefined;
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
      if (known === false && !bundled) {
        this.gaps.missing('font', textStyle.font);
      }
      style = {
        ...textStyle,
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
        frame.transitions !== false,
      );
    }
    this.shownText = text;
    this.shownSlideKey = slideKey;
    this.shownContinued = continued;
    this.shownBiblePart = biblePart;
  }

  remaining(): number | undefined {
    return this.media?.remaining();
  }

  ready(): boolean {
    return (this.image?.complete ?? true) && (this.media?.ready() ?? true);
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
    this.media?.dispose();
    this.text?.dispose();
    if (this.image !== null) {
      this.image.onerror = null;
      this.image.removeAttribute('src');
    }
    this.box.remove();
  }
}
