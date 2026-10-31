import type {LiveLayers} from '@core/live/state';
import {classes} from './classes';
import type {RenderFrame, RenderLayerOptions} from './layer';
import {ThemeElementView} from './themeElement';
import {ThemeGaps} from './themeGaps';
import {OUTPUT_TRANSITIONS} from './transitions';
import {THEME_LIMITS} from '@core/themes/elementRules';

interface ThemePage {
  readonly root: HTMLElement;
  readonly canvas: HTMLElement;
  readonly elements: readonly ThemeElementView[];
  readonly signature: string;
  readonly themeId: string;
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
  private content: {layers: LiveLayers; frame: RenderFrame} | null = null;

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
    this.gaps.follow(frame);
    this.content = {layers, frame};
    const theme = frame.theme;
    this.root.hidden = theme === undefined;
    if (theme === undefined) {
      this.clear();
      return;
    }
    const signature = JSON.stringify([theme.themeId, theme.layout]);
    if (signature !== this.page?.signature) this.build(signature, frame);
    if (this.page !== null) {
      this.page.root.style.backgroundColor =
        theme.layout.background ?? theme.emptyColor;
    }
    this.draw();
    const ticks =
      this.page?.elements.some(view =>
        ['clock', 'timer', 'videoTimeLeft'].includes(view.element.kind),
      ) ?? false;
    if (ticks && this.ticker === null) {
      this.ticker = setInterval(() => {
        try {
          this.draw();
        } catch (error) {
          this.gaps.failed('tick', error);
        }
      }, TICK_MS);
    } else if (!ticks && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private build(signature: string, frame: RenderFrame): void {
    this.releaseLeaving();
    const theme = frame.theme;
    if (theme === undefined) return;
    const old = this.page;
    const page = document.createElement('div');
    page.dataset['themePage'] = theme.themeId;
    page.className = `${classes.layer} ${classes.instant}`;
    page.style.backgroundColor = theme.layout.background ?? theme.emptyColor;
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
      root: page,
      canvas,
      elements,
      signature,
      themeId: theme.themeId,
    };
    this.rescale();
    if (
      old !== null &&
      old.themeId !== theme.themeId &&
      frame.transitions !== false
    ) {
      this.leaving = old;
      const duration = OUTPUT_TRANSITIONS.slideMs;
      page.style.opacity = '0';
      page.style.transition = `opacity ${duration}ms linear`;
      old.root.style.transition = `opacity ${duration}ms linear`;
      this.animation = requestAnimationFrame(() => {
        this.animation = null;
        page.style.opacity = '1';
        old.root.style.opacity = '0';
        this.releaseTimer = setTimeout(() => this.releaseLeaving(), duration);
      });
    } else if (old !== null) this.disposePage(old);
  }

  private draw(): void {
    const page = this.page;
    const content = this.content;
    if (page === null || content === null) return;
    const video =
      page.elements.find(view => view.element.kind === 'media')?.remaining() ??
      page.elements
        .find(view => view.element.kind === 'background')
        ?.remaining();
    for (const view of page.elements) {
      try {
        view.render(content.layers, content.frame, video);
      } catch (error) {
        this.gaps.failed(view.element.id, error);
      }
    }
    page.root.classList.toggle(
      classes.instant,
      content.frame.transitions === false,
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
      }
    }
  }

  ready(): boolean {
    return this.page?.elements.every(view => view.ready()) ?? true;
  }

  private releaseLeaving(): void {
    if (this.page !== null) this.page.root.style.opacity = '1';
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    if (this.leaving !== null) this.disposePage(this.leaving);
    this.leaving = null;
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
    this.root.remove();
  }
}
