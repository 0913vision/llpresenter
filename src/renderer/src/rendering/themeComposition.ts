import {isSectionTheme} from '@core/themes/sundaySections';
import {fitBroadcastLook, isBroadcastLook} from './broadcastLook';
import {stageBarLayout} from './stageBar';
import {manualThemeText, withSlideTextOverrides} from '@core/themes/textSlots';
import type {LiveLayers} from '@core/live/state';
import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {classes} from './classes';
import type {RenderFrame, RenderLayerOptions, ThemeFrame} from './layer';
import {ThemeElementView} from './themeElement';
import {BackgroundLayerView} from './backgroundLayer';
import {positionFollowingBoxes} from './themeFollow';
import {ThemeGaps} from './themeGaps';
import {setPlaybackProblem} from './playbackProblem';
import {OUTPUT_TRANSITIONS} from './transitions';
import {SlideAnimation} from './slideAnimation';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {themeBackgroundStyle} from './themeBackground';
import {
  songTitleLayout,
  type ResolvedThemeElement,
} from '@core/themes/songTitle';
import {songTitleLines} from '@core/presentation/songTitleLines';
import {STAGE_LYRIC_LABEL_ID, stageLyricLabelLayout} from './stageLyricLabel';
import {
  isReferencedTextSlide,
  isThemeTextElement,
  themeElementMedia,
} from '@core/themes/content';

interface PreparedLayout {
  readonly layout: ThemeScreenLayout;
  readonly manual: ReadonlyMap<string, string>;
  readonly signature: string;
}

interface ThemePage {
  layers: LiveLayers;
  frame: RenderFrame;
  readonly root: HTMLElement;
  readonly background: HTMLElement;
  readonly canvas: HTMLElement;
  readonly elements: readonly ThemeElementView[];
  readonly itemBackground: BackgroundLayerView | null;
  readonly itemBackgroundBox: HTMLElement | null;
  readonly ticking: readonly ThemeElementView[];
  readonly signature: string;
}

const TICK_MS = 250;
const STAGE_NEXT_RATIO = 2 / 3;

function itemBackgroundOverride(frame: RenderFrame, transparent: boolean) {
  const theme = frame.theme;
  if (theme === undefined || transparent) return undefined;
  return frame.screen?.kind === 'audience'
    ? theme.item?.backgroundOverride
    : undefined;
}

const layoutSignatures = new WeakMap<ThemeScreenLayout, string>();

function layoutSignature(
  layout: ThemeScreenLayout,
  manual: ReadonlyMap<string, string>,
): string {
  const cached = layoutSignatures.get(layout);
  if (cached !== undefined) return cached;
  const structure =
    manual.size === 0
      ? layout
      : {
          ...layout,
          elements: layout.elements.map((element: ResolvedThemeElement) => {
            if (!manual.has(element.id)) return element;
            const {manualText: _manual, ...style} = element;
            return style;
          }),
        };
  const signature = JSON.stringify(structure);
  layoutSignatures.set(layout, signature);
  return signature;
}

function importedLyricsLayout(
  layout: ThemeScreenLayout,
  slide: SlideLayer | null,
): ThemeScreenLayout {
  const lines = slide?.lyricFormat?.lines;
  if (
    slide === null ||
    lines === undefined ||
    slide.titleSlide === true ||
    lines.length !== slide.lines.length ||
    !lines.some(
      (line, index) =>
        line.runs.map(run => run.text).join('') === slide.lines[index],
    )
  ) {
    return layout;
  }
  const first = lines[0];
  const top =
    first?.runs.map(run => run.text).join('') === slide.lines[0]
      ? first?.top
      : undefined;
  return {
    ...layout,
    elements: layout.elements.map(element =>
      element.kind === 'currentText'
        ? {
            ...element,
            frame: {...element.frame, x: 0, w: 1920, y: top ?? element.frame.y},
          }
        : element,
    ),
  };
}

/** Keeps at most two compositions during a whole-screen theme dissolve. */
export class ThemeCompositionView {
  private readonly root = document.createElement('div');
  private readonly gaps: ThemeGaps;
  private page: ThemePage | null = null;
  private leaving: ThemePage | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private clockTicker: ReturnType<typeof setTimeout> | null = null;
  private animation: number | null = null;
  private preparing = false;
  private readonly slideAnimation: SlideAnimation;
  private content: {
    layers: LiveLayers;
    frame: RenderFrame;
    manual: ReadonlyMap<string, string> | undefined;
  } | null = null;
  private input: {layers: LiveLayers; frame: RenderFrame} | null = null;
  private audienceMeasure: ThemeCompositionView | null = null;
  private audienceMeasureHost: HTMLElement | null = null;
  private audienceSize: number | undefined;
  private audienceTitleSizes: readonly number[] | undefined;
  private readonly onFontsLoaded = (): void => {
    const input = this.input;
    if (input?.frame.screen?.kind === 'stage' && input.frame.audience) {
      this.render(input.layers, input.frame);
      return;
    }
    if (input === null || input.frame.screen?.kind !== 'broadcast') return;
    const slide = input.frame.slide ?? input.layers.slide;
    const itemKind = input.frame.theme?.item?.kind;
    if (
      slide?.bibleItemSlides === undefined ||
      ((itemKind ?? slide.kind) !== 'bible' &&
        !isReferencedTextSlide(slide, itemKind))
    ) {
      return;
    }
    this.bandFit = null;
    this.render(input.layers, input.frame);
  };
  private broadcastTitle: {source: SlideLayer; slide: SlideLayer} | null = null;
  private prepared: {
    readonly theme: ThemeFrame;
    readonly slide: SlideLayer | null;
    readonly screen: RenderFrame['screen'];
    readonly labels: RenderFrame['stageLyricLabelPosition'];
    readonly band: ThemeScreenLayout;
    readonly result: PreparedLayout;
  } | null = null;
  private slotLayout: {
    readonly theme: ThemeFrame;
    readonly slide: SlideLayer | null;
    readonly layout: ThemeScreenLayout;
    readonly broadcast: boolean;
  } | null = null;
  private bandFit: {
    key: string;
    layout: ThemeScreenLayout;
    source: ThemeScreenLayout;
    slide: SlideLayer | null;
    item: LiveThemeItem | null;
    width: number;
    height: number;
    fonts: string;
    songCaption: 'band' | 'text';
  } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly options: RenderLayerOptions,
    private readonly measureAudienceText = false,
  ) {
    this.slideAnimation = new SlideAnimation(!options.transparent);
    this.root.className = classes.layer;
    this.root.dataset['layer'] = 'theme';
    this.root.style.zIndex = '1';
    this.root.hidden = true;
    parent.append(this.root);
    this.gaps = new ThemeGaps(options.onError, options.onDrawFailure);
    if (typeof document.fonts !== 'undefined') {
      document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    }
  }

  render(layers: LiveLayers, frame: RenderFrame): void {
    this.input = {layers, frame};
    if (frame.theme !== undefined) this.root.hidden = false;
    const original = frame.slide ?? layers.slide;
    const itemKind = frame.theme?.item?.kind;
    const measureAudience =
      frame.screen?.kind === 'stage' &&
      frame.audience &&
      original &&
      !original.sermonTitle &&
      !original.sectionCard &&
      (['song', 'bible'].includes(original.kind ?? itemKind ?? '') ||
        isReferencedTextSlide(original, itemKind));
    this.audienceSize = undefined;
    this.audienceTitleSizes = undefined;
    if (measureAudience && frame.audience) {
      if (this.audienceMeasure === null) {
        const host = document.createElement('div');
        Object.assign(host.style, {
          position: 'absolute',
          left: '-10000px',
          top: '0',
          width: '1920px',
          height: '1080px',
          visibility: 'hidden',
          pointerEvents: 'none',
        });
        this.root.append(host);
        this.audienceMeasureHost = host;
        this.audienceMeasure = new ThemeCompositionView(
          host,
          this.options,
          true,
        );
      }
      const theme = frame.audience.theme;
      this.audienceMeasure.render(layers, {
        ...frame,
        audience: undefined,
        screen: frame.audience.screen,
        theme,
        transitions: false,
        standby: true,
      });
      this.audienceSize = this.audienceMeasure.page?.elements
        .find(view => view.element.kind === 'currentText')
        ?.fittedTextSize();
      if (!original.titleSlide && (original.kind ?? itemKind) === 'song') {
        const lines = this.audienceMeasure.page?.elements
          .find(view => view.element.kind === 'currentText')
          ?.renderedTextLines();
        if (lines !== undefined && lines.length > 0) {
          frame = {...frame, stageSongLines: lines};
        }
      }
      if (
        original.titleSlide &&
        (original.kind ?? theme.item?.kind) === 'song'
      ) {
        const sizes = this.audienceMeasure.page?.elements
          .filter(
            view =>
              view.element.kind === 'text' &&
              view.element.clearTarget === 'slide',
          )
          .map(view => view.fittedTextSize());
        if (sizes?.length && sizes.every(size => size !== undefined)) {
          this.audienceTitleSizes = sizes;
          this.audienceSize = Math.max(...this.audienceTitleSizes);
        }
      }
    }
    if (this.audienceTitleSizes !== undefined) {
      frame = {...frame, stageTitleSizes: this.audienceTitleSizes};
    }
    if (
      frame.screen?.kind === 'broadcast' &&
      original?.titleSlide === true &&
      (frame.theme?.item?.kind ?? original.kind) === 'song'
    ) {
      if (this.broadcastTitle?.source !== original) {
        this.broadcastTitle = {
          source: original,
          slide: {
            ...original,
            lines: songTitleLines(original.lines, original.titleLineCount),
          },
        };
      }
      const {slide} = this.broadcastTitle;
      layers = {...layers, slide};
      if (frame.slide !== undefined) frame = {...frame, slide};
    }
    const prepared =
      frame.theme === undefined
        ? null
        : this.prepareLayout(frame.theme, frame.slide ?? layers.slide, frame);
    if (prepared !== null && frame.theme !== undefined) {
      frame = {...frame, theme: {...frame.theme, layout: prepared.layout}};
    }
    this.gaps.follow(frame);
    this.content = {layers, frame, manual: prepared?.manual};
    const theme = frame.theme;
    setPlaybackProblem(
      this.root,
      'theme-missing',
      (theme?.missing.length ?? 0) > 0,
    );
    if (this.root.hidden !== (theme === undefined)) {
      this.root.hidden = theme === undefined;
    }
    if (theme === undefined || prepared === null) {
      this.bandFit = null;
      this.prepared = null;
      this.slotLayout = null;
      this.clear();
      return;
    }
    const {signature} = prepared;
    const previous = this.page?.frame.slide ?? this.page?.layers.slide;
    const incoming = frame.slide ?? layers.slide;
    const slideChanged =
      incoming !== null &&
      (previous?.itemId !== incoming.itemId ||
        previous.position !== incoming.position);
    const backgroundChanged =
      this.page !== null &&
      frame.screen?.kind !== 'stage' &&
      frame.screen?.kind !== 'broadcast' &&
      theme.layout.elements.some(element => element.kind === 'background') &&
      themeElementMedia('background', {layers, item: theme.item})?.mediaId !==
        themeElementMedia('background', {
          layers: this.page.layers,
          item: this.page.frame.theme?.item ?? null,
        })?.mediaId;
    const rebuilt =
      signature !== this.page?.signature ||
      (slideChanged && backgroundChanged && !this.preparing) ||
      (slideChanged &&
        !this.preparing &&
        frame.transitions !== false &&
        frame.slideTransition !== undefined &&
        frame.slideTransition.kind !== 'none');
    let pendingSlide = false;
    if (rebuilt) this.build(signature, frame, layers);
    else if (this.leaving !== null && this.page !== null) {
      const previous = this.page.frame.slide ?? this.page.layers.slide;
      const incoming = frame.slide ?? layers.slide;
      if (
        previous?.itemId !== incoming?.itemId ||
        previous?.position !== incoming?.position
      ) {
        if (this.preparing) pendingSlide = true;
        else this.releaseLeaving();
      }
    }
    if (
      this.page !== null &&
      theme.layout.background === undefined &&
      !this.options.transparent
    ) {
      this.page.background.style.backgroundColor = theme.emptyColor;
    }
    this.draw();
    if (frame.standby || (frame.transitions === false && this.ready())) {
      this.releaseLeaving();
    } else if ((rebuilt || pendingSlide) && this.leaving !== null) {
      this.awaitIncoming(frame);
    }
    const ticks =
      !frame.standby &&
      (this.page?.ticking.some(
        view => !(view.element.kind === 'clock' && view.element.seconds),
      ) ??
        false);
    const seconds =
      !frame.standby &&
      (this.page?.ticking.some(
        view => view.element.kind === 'clock' && view.element.seconds,
      ) ??
        false);
    if (seconds && this.clockTicker === null) this.scheduleClock();
    else if (!seconds && this.clockTicker !== null) {
      clearTimeout(this.clockTicker);
      this.clockTicker = null;
    }
    if (ticks && this.ticker === null) {
      this.ticker = setInterval(() => {
        try {
          this.tick();
        } catch (error) {
          this.gaps.failed('tick', error);
        }
      }, TICK_MS);
    } else if (!ticks && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private prepareLayout(
    theme: ThemeFrame,
    slide: SlideLayer | null,
    frame: RenderFrame,
  ): PreparedLayout {
    const slots = this.slotLayout;
    if (
      slots?.theme.layout !== theme.layout ||
      slots.theme.themeId !== theme.themeId ||
      slots.theme.sourceScreenId !== theme.sourceScreenId ||
      slots.slide?.textOverrides !== slide?.textOverrides ||
      slots.slide?.next?.textOverrides !== slide?.next?.textOverrides ||
      slots.slide?.continued !== slide?.continued ||
      slots.slide?.next?.continued !== slide?.next?.continued
    ) {
      this.slotLayout = {
        theme,
        slide,
        layout: withSlideTextOverrides(theme, slide),
        broadcast:
          slots?.theme.layout === theme.layout
            ? slots.broadcast
            : isBroadcastLook(theme.layout),
      };
    }
    const resolved = this.slotLayout?.layout ?? theme.layout;
    const band = this.slotLayout?.broadcast
      ? this.fitBand(resolved, slide, {
          item: theme.item,
          songCaption:
            frame.screen?.kind === 'broadcast'
              ? (frame.screen.songCaption ?? 'band')
              : 'band',
        })
      : resolved;
    const previous = this.prepared;
    if (
      previous?.theme.themeId === theme.themeId &&
      previous.theme.item === theme.item &&
      previous.slide === slide &&
      previous.screen?.kind === frame.screen?.kind &&
      previous.labels === frame.stageLyricLabelPosition &&
      previous.band === band
    ) {
      return previous.result;
    }
    const stage = frame.screen?.kind === 'stage';
    const source = this.measureAudienceText
      ? {
          ...band,
          elements: band.elements.filter(
            element => element.kind === 'currentText',
          ),
        }
      : band;
    let layout = songTitleLayout(
      stageBarLayout(source, {stage, message: null, item: theme.item}),
      stage ? null : slide,
    );
    if (stage) {
      layout = stageLyricLabelLayout(
        layout,
        slide,
        (slide?.kind ?? theme.item?.kind) === 'song' &&
          (frame.stageLyricLabelPosition ?? 'line') === 'line',
      );
    } else if (
      frame.screen?.kind === 'audience' &&
      theme.item?.kind === 'song'
    ) {
      layout = importedLyricsLayout(layout, slide);
    }
    const manual = new Map<string, string>();
    for (const element of layout.elements) {
      const text = manualThemeText(element);
      if (text !== undefined) manual.set(element.id, text);
    }
    const signature = JSON.stringify([
      theme.themeId,
      layoutSignature(layout, manual),
      itemBackgroundOverride(frame, this.options.transparent === true),
    ]);
    const result = {layout, signature, manual};
    this.prepared = {
      theme,
      slide,
      screen: frame.screen,
      labels: frame.stageLyricLabelPosition,
      band,
      result,
    };
    return result;
  }

  private fitBand(
    layout: ThemeScreenLayout,
    slide: SlideLayer | null,
    {
      item,
      songCaption,
    }: {item: LiveThemeItem | null; songCaption: 'band' | 'text'},
  ): ThemeScreenLayout {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const fonts =
      typeof document.fonts === 'undefined' ? '' : document.fonts.status;
    const previous = this.bandFit;
    if (
      previous !== null &&
      previous.source === layout &&
      previous.slide === slide &&
      previous.item === item &&
      previous.width === width &&
      previous.height === height &&
      previous.fonts === fonts &&
      previous.songCaption === songCaption
    ) {
      return previous.layout;
    }
    const key = JSON.stringify([
      layout,
      slide,
      item,
      width,
      height,
      fonts,
      songCaption,
    ]);
    if (previous?.key === key) {
      this.bandFit = {...previous, source: layout, slide, item};
      return previous.layout;
    }
    try {
      const fitted = fitBroadcastLook(layout, slide, {item, songCaption});
      this.bandFit = {
        key,
        layout: fitted,
        source: layout,
        slide,
        item,
        width,
        height,
        fonts,
        songCaption,
      };
      return fitted;
    } catch (error) {
      const message = 'could not fit the broadcast band';
      this.options.onDrawFailure?.(message, error);
      this.options.onError(message, error);
      return previous?.layout ?? layout;
    }
  }

  private build(
    signature: string,
    frame: RenderFrame,
    layers: LiveLayers,
  ): void {
    this.settle();
    const theme = frame.theme;
    if (theme === undefined) return;
    const old = this.page;
    const page = document.createElement('div');
    page.dataset['themePage'] = theme.themeId;
    page.className = `${classes.layer} ${classes.instant}`;
    const background = document.createElement('div');
    const override = itemBackgroundOverride(
      frame,
      this.options.transparent === true,
    );
    background.dataset['themeBackground'] = '';
    Object.assign(background.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '0',
    });
    Object.assign(
      background.style,
      this.options.transparent
        ? {background: 'transparent'}
        : themeBackgroundStyle(
            override === undefined ? theme.layout.background : undefined,
            theme.emptyColor,
          ),
    );
    const canvas = document.createElement('div');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${THEME_LIMITS.width}px`,
      height: `${THEME_LIMITS.height}px`,
      transformOrigin: 'center',
      zIndex: '1',
    });
    page.append(background);
    const itemBackgroundBox =
      override !== undefined ? document.createElement('div') : null;
    if (itemBackgroundBox !== null) {
      Object.assign(itemBackgroundBox.style, {
        position: 'absolute',
        inset: '0',
      });
      background.append(itemBackgroundBox);
    }
    const itemBackground =
      itemBackgroundBox === null
        ? null
        : new BackgroundLayerView(itemBackgroundBox, {
            ...this.options,
            muted: true,
          });
    page.append(canvas);
    this.root.append(page);
    const elements: ThemeElementView[] = [];
    if (theme.layout.mode.kind === 'own') {
      for (const element of theme.layout.elements) {
        if (
          override !== undefined &&
          (element.kind === 'background' ||
            (element.kind === 'image' &&
              element.frame.x === 0 &&
              element.frame.y === 0 &&
              element.frame.w === THEME_LIMITS.width &&
              element.frame.h === THEME_LIMITS.height))
        ) {
          continue;
        }
        if (this.options.transparent && element.kind === 'background') {
          continue;
        }
        try {
          elements.push(
            new ThemeElementView(element, canvas, {
              options: this.options,
              gaps: this.gaps,
              capture:
                !this.options.transparent &&
                (frame.screen?.method === 'capture' ||
                  frame.screen?.method === 'ndi'),
            }),
          );
        } catch (error) {
          this.gaps.failed(element.id, error, 'draw');
        }
      }
    }
    this.page = {
      layers,
      frame,
      root: page,
      background,
      canvas,
      elements,
      itemBackground,
      itemBackgroundBox,
      ticking: elements.filter(view =>
        ['clock', 'timer', 'videoTimeLeft'].includes(view.element.kind),
      ),
      signature,
    };
    if (old !== null) {
      this.leaving = old;
      this.preparing = true;
      page.style.opacity = '0';
      if (
        frame.transitions === false ||
        frame.slideTransition === undefined ||
        frame.slideTransition.kind === 'none'
      ) {
        for (const incoming of elements) {
          old.elements.forEach(previous =>
            incoming.retainMedia(previous, layers, frame),
          );
        }
      }
    }
    this.rescale();
  }

  private awaitIncoming(frame: RenderFrame): void {
    const page = this.page;
    if (page === null) return;
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    const effect =
      frame.theme?.item?.kind === 'media' ? undefined : frame.slideTransition;
    const duration =
      frame.transitions === false
        ? 0
        : frame.theme?.item?.kind === 'media'
          ? (frame.transitionTimes?.backgroundMs ??
            OUTPUT_TRANSITIONS.backgroundMs)
          : effect !== undefined
            ? effect.kind === 'none'
              ? 0
              : effect.sec * 1000
            : (frame.transitionTimes?.slideMs ?? OUTPUT_TRANSITIONS.slideMs);
    page.root.style.transition =
      effect !== undefined && effect.kind !== 'none'
        ? 'none'
        : `opacity ${duration}ms linear`;
    // NOTE(0913vision): A newly inserted page needs its zero-opacity style
    // committed before rAF; otherwise Chromium paints its first frame opaque.
    getComputedStyle(page.root).getPropertyValue('opacity');
    const check = (): void => {
      this.animation = null;
      if (!this.ready()) {
        this.animation = requestAnimationFrame(check);
        return;
      }
      this.preparing = false;
      page.root.style.opacity = '1';
      if (effect !== undefined && this.leaving !== null) {
        this.slideAnimation.play(
          this.leaving.root,
          page.root,
          frame.transitions === false
            ? {kind: 'none', sec: effect.sec}
            : effect,
        );
      } else if (this.options.transparent && this.leaving !== null) {
        this.leaving.root.style.transition = `opacity ${duration}ms linear`;
        this.leaving.root.style.opacity = '0';
      }
      const finished = this.slideAnimation.finished();
      if (finished === null) {
        this.releaseTimer = setTimeout(() => this.releaseLeaving(), duration);
      } else {
        finished.then(
          () => {
            if (this.page === page) this.releaseLeaving();
          },
          () => undefined,
        );
      }
    };
    this.animation = requestAnimationFrame(check);
  }

  private draw(): void {
    const page = this.page;
    const content = this.content;
    if (page === null || content === null) return;
    const cleared = content.frame.theme?.item?.contentCleared === true;
    const clearOpacity = cleared
      ? Math.max(
          content.frame.clearOpacity?.slide ?? 0,
          content.frame.clearOpacity?.media ?? 0,
        )
      : 1;
    page.background.style.opacity = String(clearOpacity);
    // NOTE(0913vision): Keep the outgoing slide as one frozen picture while a
    // new slide replaces it; clear fades still apply when content is cleared.
    if (content.layers.slide === null) {
      if (this.leaving !== null && cleared) {
        this.leaving.background.style.opacity = String(clearOpacity);
      }
      for (const view of this.leaving?.elements ?? []) {
        view.setClearOpacity(
          {...content.frame.clearOpacity, slide: 0},
          cleared ? clearOpacity : 1,
          content.frame.screen?.kind === 'stage',
        );
      }
    }
    page.layers = content.layers;
    page.frame = content.frame;
    const mediaVisible = content.layers.media !== null;
    if (page.itemBackgroundBox !== null) {
      page.itemBackgroundBox.style.opacity = String(
        content.frame.clearOpacity?.media ?? (mediaVisible ? 1 : 0),
      );
    }
    try {
      if (content.frame.clearOpacity?.media !== undefined && mediaVisible) {
        page.itemBackground?.hold();
      } else {
        page.itemBackground?.show(
          content.layers.media?.slidePicture === true
            ? null
            : content.layers.media,
          content.frame.transitions,
          content.frame.standby,
        );
      }
    } catch (error) {
      this.gaps.failed('item-background', error, 'draw');
    }
    const video =
      page.elements.find(view => view.element.kind === 'media')?.remaining() ??
      page.elements
        .find(view => view.element.kind === 'background')
        ?.remaining() ??
      (content.layers.media === null
        ? undefined
        : this.options.previewMedia?.remaining(content.layers.media));
    const frame = {...content.frame, transitions: false};
    const values = {videoRemaining: video, manual: content.manual};
    for (const view of page.elements) {
      if (
        content.frame.screen?.kind === 'stage' &&
        view.element.kind === 'currentText'
      ) {
        view.targetTextSize(this.audienceSize);
      }
      if (
        (isThemeTextElement(view.element) &&
          view.element.stack !== undefined) ||
        (view.element.kind === 'box' && view.element.follow !== undefined)
      ) {
        view.setY(view.element.frame.y);
      }
      try {
        view.render(
          content.layers,
          // NOTE(0913vision): Page transitions own the mask, so children cut.
          frame,
          values,
        );
        view.setClearOpacity(
          content.frame.clearOpacity,
          clearOpacity,
          content.frame.screen?.kind === 'stage',
        );
      } catch (error) {
        this.gaps.failed(view.element.id, error, 'draw');
      }
    }
    positionFollowingBoxes(page.elements);
    const sectionStage =
      content.frame.screen?.kind === 'stage' &&
      isSectionTheme(content.frame.theme?.themeId);
    const titleSize = sectionStage
      ? page.elements
          .find(view => view.element.kind === 'itemName')
          ?.fittedTextSize()
      : undefined;
    const currentSize =
      titleSize !== undefined && Number.isFinite(titleSize)
        ? titleSize
        : page.elements
            .find(view => view.element.kind === 'currentText')
            ?.fittedTextSize();
    const lyricLabel = page.elements.find(
      view => view.element.id === STAGE_LYRIC_LABEL_ID,
    );
    if (lyricLabel !== undefined && currentSize !== undefined) {
      lyricLabel.targetTextSize(currentSize);
      const bounds = page.elements
        .find(view => view.element.kind === 'currentText')
        ?.textBounds();
      if (bounds !== undefined) {
        lyricLabel.setY(Math.max(0, bounds.top - lyricLabel.element.frame.h));
      }
    }
    const maximum =
      currentSize !== undefined && Number.isFinite(currentSize)
        ? currentSize * STAGE_NEXT_RATIO
        : undefined;
    for (const view of page.elements) {
      if (view.element.kind !== 'nextText') continue;
      if (content.frame.screen?.kind === 'stage') {
        view.targetTextSize(maximum);
      } else {
        view.capTextSize(maximum);
      }
    }
    page.root.classList.toggle(
      classes.instant,
      content.frame.standby === true || content.frame.transitions === false,
    );
  }

  rescale(
    width = this.root.clientWidth,
    height = this.root.clientHeight,
  ): void {
    const scale = Math.min(
      width / THEME_LIMITS.width,
      height / THEME_LIMITS.height,
    );
    for (const page of [this.page, this.leaving]) {
      if (page !== null) {
        page.canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
        if (this.options.biblePreview !== undefined && scale > 0) {
          page.canvas.style.setProperty(
            '--bible-guide-width',
            `${1 / scale}px`,
          );
        }
      }
    }
  }

  private scheduleClock(): void {
    const wall = this.content?.frame.timers?.now().wall ?? Date.now();
    this.clockTicker = setTimeout(
      () => {
        this.clockTicker = null;
        this.tick(true);
        this.scheduleClock();
      },
      1000 - (wall % 1000),
    );
  }

  private tick(seconds = false): void {
    const page = this.page;
    const content = this.content;
    if (page === null || content === null) return;
    const video = page.ticking.some(
      view => view.element.kind === 'videoTimeLeft',
    )
      ? (page.elements
          .find(view => view.element.kind === 'media')
          ?.remaining() ??
        page.elements
          .find(view => view.element.kind === 'background')
          ?.remaining() ??
        (page.layers.media === null
          ? undefined
          : this.options.previewMedia?.remaining(page.layers.media)))
      : undefined;
    for (const view of page.ticking) {
      if (
        (view.element.kind === 'clock' && view.element.seconds === true) !==
        seconds
      ) {
        continue;
      }
      try {
        view.tick(content.layers, content.frame, video);
      } catch (error) {
        this.gaps.failed(view.element.id, error);
      }
    }
  }

  ready(): boolean {
    return (
      (this.page?.itemBackground?.ready() ?? true) &&
      (this.page?.elements.every(view => view.ready()) ?? true)
    );
  }

  /** Identifies unready elements without exposing their content or media paths. */
  unreadyElements(): ReadonlyArray<{kind: string; id: string}> {
    return [
      ...(this.page?.itemBackground !== null &&
      this.page?.itemBackground !== undefined &&
      !this.page.itemBackground.ready()
        ? [{kind: 'background', id: 'item-background'}]
        : []),
      ...(this.page?.elements ?? [])
        .filter(view => !view.ready())
        .map(view => ({kind: view.element.kind, id: view.element.id})),
    ];
  }

  /** Show a partially prepared page when the outer transition times out. */
  revealIncomplete(): void {
    this.releaseLeaving();
  }

  private releaseLeaving(): void {
    this.slideAnimation.cancel();
    if (this.page !== null) {
      this.page.root.style.transition = 'none';
      this.page.root.style.opacity = '1';
    }
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    if (this.leaving !== null) this.disposePage(this.leaving);
    this.leaving = null;
    this.preparing = false;
  }

  private settle(): void {
    if (
      this.preparing &&
      !this.ready() &&
      this.leaving !== null &&
      this.page !== null
    ) {
      for (const outgoing of this.leaving.elements) {
        for (const incoming of this.page.elements) {
          outgoing.retainMedia(
            incoming,
            this.leaving.layers,
            this.leaving.frame,
          );
        }
      }
      this.disposePage(this.page);
      this.page = this.leaving;
      this.leaving = null;
    }
    this.releaseLeaving();
  }

  private disposePage(page: ThemePage): void {
    try {
      page.itemBackground?.dispose();
    } catch (error) {
      this.gaps.failed('item-background', error);
    }
    for (const view of page.elements) {
      try {
        view.dispose();
      } catch (error) {
        this.gaps.failed(view.element.id, error);
      }
    }
    page.root.remove();
  }

  private clear(): void {
    this.releaseLeaving();
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
    if (this.clockTicker !== null) clearTimeout(this.clockTicker);
    this.clockTicker = null;
    if (this.page !== null) this.disposePage(this.page);
    this.page = null;
  }

  /** Stop internal updates without removing the current painted composition. */
  freeze(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
    if (this.clockTicker !== null) clearTimeout(this.clockTicker);
    this.clockTicker = null;
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    if (typeof document.fonts !== 'undefined') {
      document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    }
  }

  dispose(): void {
    this.audienceMeasure?.dispose();
    this.audienceMeasureHost?.remove();
    this.audienceMeasure = null;
    this.audienceMeasureHost = null;
    if (typeof document.fonts !== 'undefined') {
      document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    }
    this.clear();
    this.input = null;
    this.content = null;
    this.bandFit = null;
    this.prepared = null;
    this.slotLayout = null;
    this.broadcastTitle = null;
    this.root.remove();
  }
}
