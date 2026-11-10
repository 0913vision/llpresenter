import type {LiveLayers} from '@core/live/state';
import type {SlideLayer} from '@core/live/state';
import type {ThemeScreenLayout} from '@core/schema/themes';
import {classes} from './classes';
import type {RenderFrame, RenderLayerOptions} from './layer';
import {ThemeElementView} from './themeElement';
import {ThemeGaps} from './themeGaps';
import {setPlaybackProblem} from './playbackProblem';
import {OUTPUT_TRANSITIONS} from './transitions';
import {SlideAnimation} from './slideAnimation';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {themeBackgroundStyle} from './themeBackground';
import {songTitleLayout} from '@core/themes/songTitle';
import {themeElementMedia} from '@core/themes/content';
import {isSectionTheme} from '@core/themes/sundaySections';
import {fitBroadcastBand, isBroadcastBandLayout} from './broadcastBand';

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

/** Keeps at most two compositions during a whole-screen theme dissolve. */
export class ThemeCompositionView {
  private readonly root = document.createElement('div');
  private readonly gaps: ThemeGaps;
  private page: ThemePage | null = null;
  private leaving: ThemePage | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private animation: number | null = null;
  private preparing = false;
  private readonly slideAnimation = new SlideAnimation(true);
  private content: {layers: LiveLayers; frame: RenderFrame} | null = null;
  private bandFit: {
    key: string;
    layout: ThemeScreenLayout;
    source: ThemeScreenLayout;
    slide: SlideLayer | null;
    title: string | undefined;
    width: number;
    height: number;
    fonts: string;
  } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly options: RenderLayerOptions,
  ) {
    this.root.className = classes.layer;
    this.root.dataset['layer'] = 'theme';
    this.root.style.zIndex = '1';
    this.root.hidden = true;
    parent.append(this.root);
    this.gaps = new ThemeGaps(options.onError);
  }

  render(layers: LiveLayers, frame: RenderFrame): void {
    if (frame.theme !== undefined) {
      const slide = frame.slide ?? layers.slide;
      frame = {
        ...frame,
        theme: {
          ...frame.theme,
          layout: songTitleLayout(
            this.fitBand(frame.theme.layout, slide, frame.theme.item?.title),
            slide,
          ),
        },
      };
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
      signature !== this.page?.signature || (slideChanged && backgroundChanged);
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
    if (this.page !== null && theme.layout.background === undefined) {
      this.page.root.style.backgroundColor = theme.emptyColor;
    }
    this.draw(rebuilt);
    if (frame.standby || frame.transitions === false) this.releaseLeaving();
    else if ((rebuilt || pendingSlide) && this.leaving !== null) {
      this.awaitIncoming(frame);
    }
    const ticks = !frame.standby && (this.page?.ticking.length ?? 0) > 0;
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
    title: string | undefined,
  ): ThemeScreenLayout {
    if (!isBroadcastBandLayout(layout)) {
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
      previous.title === title &&
      previous.width === width &&
      previous.height === height &&
      previous.fonts === fonts
    ) {
      return previous.layout;
    }
    const key = JSON.stringify([layout, slide, title, width, height, fonts]);
    if (previous?.key === key) {
      this.bandFit = {...previous, source: layout, slide};
      return previous.layout;
    }
    try {
      const fitted = fitBroadcastBand(layout, slide, title);
      this.bandFit = {
        key,
        layout: fitted,
        source: layout,
        slide,
        title,
        width,
        height,
        fonts,
      };
      return fitted;
    } catch (error) {
      this.options.onError('could not fit the broadcast band', error);
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
    Object.assign(
      page.style,
      themeBackgroundStyle(theme.layout.background, theme.emptyColor),
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
        try {
          elements.push(
            new ThemeElementView(element, canvas, {
              options: this.options,
              gaps: this.gaps,
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
      for (const incoming of elements) {
        for (const previous of old.elements) {
          incoming.retainMedia(previous, layers, frame);
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
    page.root.style.transition = `opacity ${duration}ms linear`;
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
      }
      // NOTE(0913vision): The outgoing opaque page stays behind the incoming
      // one. Fading both pages exposes black at the middle of a dissolve.
      this.releaseTimer = setTimeout(() => this.releaseLeaving(), duration);
    };
    this.animation = requestAnimationFrame(check);
  }

  private draw(rebuilt = false): void {
    const page = this.page;
    const content = this.content;
    if (page === null || content === null) return;
    for (const view of this.leaving?.elements ?? []) {
      view.setClearOpacity({
        ...content.frame.clearOpacity,
        slide:
          content.layers.slide === null
            ? 0
            : (content.frame.clearOpacity?.slide ?? 1),
      });
    }
    page.layers = content.layers;
    page.frame = content.frame;
    const video =
      page.elements.find(view => view.element.kind === 'media')?.remaining() ??
      page.elements
        .find(view => view.element.kind === 'background')
        ?.remaining();
    for (const view of page.elements) {
      try {
        view.render(
          content.layers,
          rebuilt || this.leaving !== null
            ? {...content.frame, transitions: false}
            : content.frame,
          video,
        );
      } catch (error) {
        this.gaps.failed(view.element.id, error);
      }
    }
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
        ? (currentSize * 2) / 3
        : undefined;
    for (const view of page.elements) {
      if (view.element.kind === 'nextText') view.capTextSize(maximum);
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

  private tick(): void {
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
    if (this.page !== null) this.disposePage(this.page);
    this.page = null;
  }

  dispose(): void {
    this.clear();
    this.content = null;
    this.bandFit = null;
    this.root.remove();
  }
}
