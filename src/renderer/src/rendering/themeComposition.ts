import {fitBroadcastLook, isBroadcastLook} from './broadcastLook';
import {stageBarLayout} from './stageBar';
import type {LiveLayers} from '@core/live/state';
import type {SlideLayer} from '@core/live/state';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {classes} from './classes';
import type {RenderFrame, RenderLayerOptions} from './layer';
import {ThemeElementView} from './themeElement';
import {positionFollowingBoxes} from './themeFollow';
import {ThemeGaps} from './themeGaps';
import {setPlaybackProblem} from './playbackProblem';
import {OUTPUT_TRANSITIONS} from './transitions';
import {SlideAnimation} from './slideAnimation';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {themeBackgroundStyle} from './themeBackground';
import {songTitleLayout} from '@core/themes/songTitle';
import {isThemeTextElement, themeElementMedia} from '@core/themes/content';
import {BROADCAST_BAND_ID} from '@core/themes/broadcastBand';
import {isSectionTheme} from '@core/themes/sundaySections';
import {
  fitBroadcastBand,
  isBroadcastBandLayout,
  withBroadcastBandVisibility,
} from './broadcastBand';

interface ThemePage {
  layers: LiveLayers;
  frame: RenderFrame;
  readonly root: HTMLElement;
  readonly canvas: HTMLElement;
  readonly elements: readonly ThemeElementView[];
  readonly ticking: readonly ThemeElementView[];
  readonly signature: string;
}

const TICK_MS = 250;
const STAGE_NEXT_RATIO = 2 / 3;

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
  private content: {layers: LiveLayers; frame: RenderFrame} | null = null;
  private input: {layers: LiveLayers; frame: RenderFrame} | null = null;
  private readonly onFontsLoaded = (): void => {
    const input = this.input;
    if (input === null || input.frame.screen?.kind !== 'broadcast') return;
    const slide = input.frame.slide ?? input.layers.slide;
    if (
      slide?.bibleItemSlides === undefined ||
      (input.frame.theme?.item?.kind ?? slide.kind) !== 'bible'
    ) {
      return;
    }
    this.bandFit = null;
    this.render(input.layers, input.frame);
  };
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
  ) {
    this.slideAnimation = new SlideAnimation(!options.transparent);
    this.root.className = classes.layer;
    this.root.dataset['layer'] = 'theme';
    this.root.style.zIndex = '1';
    this.root.hidden = true;
    parent.append(this.root);
    this.gaps = new ThemeGaps(options.onError);
    if (typeof document.fonts !== 'undefined') {
      document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
    }
  }

  render(layers: LiveLayers, frame: RenderFrame): void {
    this.input = {layers, frame};
    if (frame.theme !== undefined) {
      const slide = frame.slide ?? layers.slide;
      frame = {
        ...frame,
        theme: {
          ...frame.theme,
          layout: songTitleLayout(
            stageBarLayout(
              this.fitBand(frame.theme.layout, slide, {
                item: frame.theme.item,
                songCaption:
                  frame.screen?.kind === 'broadcast'
                    ? (frame.screen.songCaption ?? 'band')
                    : 'band',
              }),
              {
                stage: frame.screen?.kind === 'stage',
                message: frame.stageMessage,
                item: frame.theme.item,
              },
            ),
            frame.screen?.kind === 'stage' ? null : slide,
          ),
        },
      };
    }
    if (
      frame.theme !== undefined &&
      frame.screen?.kind === 'audience' &&
      frame.theme.item?.kind === 'song'
    ) {
      const slide = frame.slide ?? layers.slide;
      if (
        slide?.lyricFormat !== undefined &&
        slide.titleSlide !== true &&
        slide.lyricFormat.lines.length === slide.lines.length &&
        slide.lyricFormat.lines.some(
          (line, index) =>
            line.runs.map(run => run.text).join('') === slide.lines[index],
        )
      ) {
        const firstLine = slide.lyricFormat.lines[0];
        const importedTop =
          firstLine?.runs.map(run => run.text).join('') === slide.lines[0]
            ? firstLine?.top
            : undefined;
        frame = {
          ...frame,
          theme: {
            ...frame.theme,
            layout: {
              ...frame.theme.layout,
              elements: frame.theme.layout.elements.map(element =>
                element.kind === 'currentText'
                  ? {
                      ...element,
                      frame: {
                        ...element.frame,
                        x: 0,
                        w: 1920,
                        y: importedTop ?? element.frame.y,
                      },
                    }
                  : element,
              ),
            },
          },
        };
      }
    }
    this.gaps.follow(frame);
    this.content = {layers, frame};
    const theme = frame.theme;
    setPlaybackProblem(
      this.root,
      'theme-missing',
      (theme?.missing.length ?? 0) > 0,
    );
    if (this.root.hidden !== (theme === undefined)) {
      this.root.hidden = theme === undefined;
    }
    if (theme === undefined) {
      this.bandFit = null;
      this.clear();
      return;
    }
    const signature = JSON.stringify([theme.themeId, theme.layout]);
    const previous = this.page?.frame.slide ?? this.page?.layers.slide;
    const incoming = frame.slide ?? layers.slide;
    const slideChanged =
      incoming !== null &&
      (previous?.itemId !== incoming.itemId ||
        previous.position !== incoming.position);
    const backgroundChanged =
      this.page !== null &&
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
      this.page.root.style.backgroundColor = theme.emptyColor;
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

  private fitBand(
    layout: ThemeScreenLayout,
    slide: SlideLayer | null,
    {
      item,
      songCaption,
    }: {item: LiveThemeItem | null; songCaption: 'band' | 'text'},
  ): ThemeScreenLayout {
    const look = isBroadcastLook(layout);
    if (!look && !isBroadcastBandLayout(layout)) {
      this.bandFit = null;
      return layout;
    }
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
      const fitted = look
        ? fitBroadcastLook(layout, slide, {item, songCaption})
        : fitBroadcastBand(layout, slide, item);
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
      this.options.onError('could not fit the broadcast band', error);
      return look
        ? (previous?.layout ?? layout)
        : withBroadcastBandVisibility(previous?.layout ?? layout, slide, item);
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
    Object.assign(
      page.style,
      this.options.transparent
        ? {background: 'transparent'}
        : themeBackgroundStyle(theme.layout.background, theme.emptyColor),
    );
    const canvas = document.createElement('div');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${THEME_LIMITS.width}px`,
      height: `${THEME_LIMITS.height}px`,
      transformOrigin: 'center',
    });
    page.append(canvas);
    this.root.append(page);
    const elements: ThemeElementView[] = [];
    if (theme.layout.mode.kind === 'own') {
      for (const element of theme.layout.elements) {
        if (
          this.options.transparent &&
          (element.kind === 'background' || element.id === BROADCAST_BAND_ID)
        ) {
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
          this.gaps.failed(element.id, error);
        }
      }
    }
    this.page = {
      layers,
      frame,
      root: page,
      canvas,
      elements,
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
    // NOTE(0913vision): Keep the outgoing slide as one frozen picture while a
    // new slide replaces it; clear fades still apply when content is cleared.
    if (content.layers.slide === null) {
      for (const view of this.leaving?.elements ?? []) {
        view.setClearOpacity({...content.frame.clearOpacity, slide: 0});
      }
    }
    page.layers = content.layers;
    page.frame = content.frame;
    const video =
      page.elements.find(view => view.element.kind === 'media')?.remaining() ??
      page.elements
        .find(view => view.element.kind === 'background')
        ?.remaining();
    for (const view of page.elements) {
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
          {...content.frame, transitions: false},
          video,
        );
      } catch (error) {
        this.gaps.failed(view.element.id, error);
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

  rescale(): void {
    const scale = Math.min(
      this.root.clientWidth / THEME_LIMITS.width,
      this.root.clientHeight / THEME_LIMITS.height,
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
          ?.remaining())
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
    return this.page?.elements.every(view => view.ready()) ?? true;
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

  dispose(): void {
    if (typeof document.fonts !== 'undefined') {
      document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
    }
    this.clear();
    this.input = null;
    this.content = null;
    this.bandFit = null;
    this.root.remove();
  }
}
