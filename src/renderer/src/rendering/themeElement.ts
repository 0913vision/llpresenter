import type {LiveLayers, MediaLayer} from '@core/live/state';
import type {ThemeElement} from '@core/schema/themes';
import type {LyricStyle} from '@core/looks/lyricStyle';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {
  isThemeTextElement,
  themeElementText,
  themeOverlay,
} from '@core/themes/content';
import {BackgroundLayerView} from './backgroundLayer';
import {SlideLayerView} from './slideLayer';
import {stageClockText} from './stageLayout';
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

/** One persistent element with owned text pages, images, and video decoders. */
export class ThemeElementView {
  private readonly box = document.createElement('div');
  private readonly text: SlideLayerView | null;
  private media: BackgroundLayerView | null = null;
  private readonly image: HTMLImageElement | null;
  private readonly options: RenderLayerOptions;
  private readonly gaps: ThemeGaps;
  private shownText: string | null = null;
  private mediaId: string | null = null;
  private mediaStartedAt: number | null = null;

  constructor(
    readonly element: ThemeElement,
    parent: HTMLElement,
    {
      options,
      gaps,
    }: {readonly options: RenderLayerOptions; readonly gaps: ThemeGaps},
  ) {
    this.options = options;
    this.gaps = gaps;
    const {frame} = element;
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
    this.text =
      isThemeTextElement(element) || element.kind === 'overlay'
        ? new SlideLayerView(this.box, DEFAULT_LYRIC_STYLE)
        : null;
    this.image =
      element.kind === 'image' ? document.createElement('img') : null;
    if (element.kind === 'image' && this.image !== null) {
      this.image.alt = '';
      Object.assign(this.image.style, {
        width: '100%',
        height: '100%',
        objectFit:
          element.fit === 'fit'
            ? 'contain'
            : element.fit === 'fill'
              ? 'cover'
              : 'fill',
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
    const {element} = this;
    const item = frame.theme?.item ?? null;
    if (element.kind === 'media' || element.kind === 'background') {
      const media =
        element.kind === 'media'
          ? item?.kind === 'media'
            ? layers.media
            : null
          : item?.kind === 'media'
            ? null
            : layers.media;
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
      const timer =
        element.kind === 'timer' &&
        (element.timerId ?? frame.stageTimerId ?? frame.stage?.timerId) !==
          undefined &&
        frame.timers !== undefined
          ? fillTimerTokens(
              `{timer:${element.timerId ?? frame.stageTimerId ?? frame.stage?.timerId}}`,
              frame.timers,
              frame.timers.now(),
            )
          : undefined;
      this.showText(
        themeElementText(element, {
          layers,
          item,
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
        }),
        frame,
      );
    }
    const target = [
      'currentText',
      'reference',
      'nextText',
      'label',
      'nextLabel',
    ].includes(element.kind)
      ? 'slide'
      : element.kind === 'media' || element.kind === 'background'
        ? 'media'
        : undefined;
    this.box.style.opacity = String(
      target === undefined ? 1 : (frame.clearOpacity?.[target] ?? 1),
    );
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
        onError: () => {
          if (this.mediaId !== null) this.gaps.missing('media', this.mediaId);
        },
      });
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
        this.media?.show(corrected, frame.transitions);
      } catch {
        if (this.mediaId !== null) this.gaps.missing('media', this.mediaId);
        this.media?.show(null, false);
      }
    }
  }

  private showText(text: string | null, frame: RenderFrame): void {
    if (this.text === null) return;
    if (this.element.kind !== 'overlay') this.box.hidden = text === null;
    let style: LyricStyle = DEFAULT_LYRIC_STYLE;
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
    if (text === this.shownText) return;
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
              position: 0,
              label: null,
              lines: text.split('\n'),
            },
      );
    }
    this.shownText = text;
  }

  remaining(): number | undefined {
    return this.media?.remaining();
  }

  ready(): boolean {
    return (this.image?.complete ?? true) && (this.media?.ready() ?? true);
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
