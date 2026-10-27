import type {LiveLayers} from '@shared/live';
import type {StageElement, StageLayout} from '@shared/schema/stageLayouts';
import {fitFontSize} from './fitText';
import type {RenderFrame} from './layer';
import {DEFAULT_LYRIC_STYLE, REFERENCE_SCREEN} from './lyricStyle';
import {showsLayer, type LookLayer} from './screenLook';
import {fontFamilyFor} from './slideLayer';
import styles from './stageLayout.module.css';
import {fillTimerTokens, hasTickingToken} from './timerTokens';

/** How often a shown clock or running 타이머 redraws. */
export const STAGE_TICK_MS = 1000;

/** At most this many distinct tick failures are logged per stage layout view. */
export const MAX_REPORTED_STAGE_ERRORS = 32;

const JUSTIFY: Readonly<Record<'top' | 'middle' | 'bottom', string>> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

// NOTE(0913vision): Layout reports whole pixels, so text that fits exactly
// can measure a pixel over.
const LAYOUT_TOLERANCE_PX = 1;

export const STAGE_TEXT_FALLBACK: NonNullable<StageElement['text']> = {
  font: DEFAULT_LYRIC_STYLE.font,
  weight: DEFAULT_LYRIC_STYLE.weight,
  size: DEFAULT_LYRIC_STYLE.size,
  color: DEFAULT_LYRIC_STYLE.color,
  align: DEFAULT_LYRIC_STYLE.align,
  vAlign: DEFAULT_LYRIC_STYLE.vAlign,
  lineHeight: DEFAULT_LYRIC_STYLE.lineHeight,
  autoFit: true,
};

const ELEMENT_SWITCH: Readonly<Record<StageElement['kind'], LookLayer | null>> =
  {
    currentSlide: 'slide',
    nextSlide: 'slide',
    currentLabel: 'slide',
    nextLabel: 'slide',
    clock: 'clock',
    timer: null,
    stageMessage: 'stageMessage',
  };

function classOf(key: string): string {
  return styles[key] ?? key;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** The 24-hour clock of a 무대 화면, such as "11:24" (docs/spec/03-output.md). */
export function stageClockText(wall: number): string {
  const date = new Date(wall);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function rgba(hex: string, opacity: number): string {
  const [red, green, blue] = [1, 3, 5].map(start =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function timerToken(frame: RenderFrame | undefined): string | null {
  const id = frame?.stage?.timerId;
  return id === undefined ? null : `{timer:${id}}`;
}

interface StageContent {
  readonly layers: LiveLayers | null;
  readonly frame: RenderFrame | undefined;
}

function contentOf(
  {kind, show}: StageElement,
  {layers, frame}: StageContent,
): string | null {
  const shown = ELEMENT_SWITCH[kind];
  if (shown !== null && !showsLayer(frame?.look ?? null, shown)) return null;
  const slide = layers?.slide ?? null;
  // TODO(0913vision): Draw 그림 (a copy of the 본 화면) and 메모 for 장
  // elements once their sources reach the renderer (spec 03, proposals).
  if ((kind === 'currentSlide' || kind === 'nextSlide') && show !== undefined) {
    if (show !== 'text') return null;
  }
  switch (kind) {
    case 'currentSlide':
      return slide === null ? null : slide.lines.join('\n');
    case 'nextSlide':
      return slide?.next === undefined ? null : slide.next.lines.join('\n');
    case 'currentLabel':
      return slide?.label ?? null;
    case 'nextLabel':
      return slide?.next?.label ?? null;
    case 'clock':
      return stageClockText(frame?.timers?.now().wall ?? Date.now());
    case 'timer': {
      const token = timerToken(frame);
      const timers = frame?.timers;
      return token === null || timers === undefined
        ? null
        : fillTimerTokens(token, timers, timers.now());
    }
    case 'stageMessage':
      return frame?.stageMessage ?? null;
  }
}

class StageElementView {
  private readonly box = document.createElement('div');
  private readonly block = document.createElement('div');
  private readonly style: NonNullable<StageElement['text']>;
  private text: string | null = null;
  private unsized = false;

  constructor(
    readonly element: StageElement,
    private readonly sizeScale: number,
    parent: HTMLElement,
  ) {
    const {frame, box: fill} = element;
    this.style = element.text ?? STAGE_TEXT_FALLBACK;
    this.box.className = classOf('element');
    this.box.style.left = `${frame.x}px`;
    this.box.style.top = `${frame.y}px`;
    this.box.style.width = `${frame.w}px`;
    this.box.style.height = `${frame.h}px`;
    this.box.style.justifyContent = JUSTIFY[this.style.vAlign];
    if (fill?.background !== undefined) {
      this.box.style.background = rgba(fill.background, fill.opacity ?? 1);
    }
    this.block.className = classOf('text');
    this.block.style.textAlign = this.style.align;
    this.block.style.fontFamily = fontFamilyFor(this.style.font);
    this.block.style.fontWeight = String(this.style.weight);
    this.block.style.lineHeight = String(this.style.lineHeight);
    this.block.style.color = this.style.color;
    this.box.append(this.block);
    parent.append(this.box);
  }

  show(text: string | null, opacity = 1): void {
    this.box.style.opacity = String(opacity);
    if (text === this.text) return;
    this.text = text;
    this.block.textContent = text ?? '';
    this.fit();
  }

  // NOTE(0913vision): A box with no size, as in a collapsed preview, can't be
  // measured, so its text fits again once the screen has a size.
  refitIfUnsized(): void {
    if (this.unsized) this.fit();
  }

  private fit(): void {
    const size = this.style.size * this.sizeScale;
    this.unsized = false;
    if (!this.style.autoFit || this.text === null) {
      this.block.style.fontSize = `${size}px`;
      return;
    }
    this.unsized = this.box.clientWidth === 0 || this.box.clientHeight === 0;
    const fits = (px: number): boolean => {
      this.block.style.fontSize = `${px}px`;
      return (
        this.block.scrollHeight <=
          this.box.clientHeight + LAYOUT_TOLERANCE_PX &&
        this.block.scrollWidth <= this.box.clientWidth + LAYOUT_TOLERANCE_PX
      );
    };
    this.block.style.fontSize = `${fitFontSize(size, fits)}px`;
  }
}

/**
 * The 무대 화면's stage layout (docs/spec/03-output.md, "What the 무대 화면
 * draws"). The layout's canvas keeps its own size and scales, centred, to fit
 * the screen; each element draws its text and shrinks it to fit when 크기 자동
 * 맞춤 is on. Elements are built once per layout and only redrawn after that,
 * and one interval redraws the clock and a running 타이머 while one shows.
 */
export class StageLayoutView {
  private readonly canvas = document.createElement('div');
  private layout: StageLayout | null = null;
  private views: readonly StageElementView[] = [];
  private content: StageContent = {layers: null, frame: undefined};
  private ticker: ReturnType<typeof setInterval> | null = null;
  private readonly reported = new Set<string>();

  constructor(
    private readonly parent: HTMLElement,
    private readonly onError: (message: string, error: unknown) => void,
  ) {
    this.canvas.className = classOf('canvas');
    this.canvas.hidden = true;
    parent.append(this.canvas);
  }

  render(layers: LiveLayers, frame: RenderFrame | undefined): void {
    const layout = frame?.stage?.layout ?? null;
    if (layout !== this.layout) this.build(layout);
    this.content = {layers, frame};
    this.draw(false);
    this.followTicking();
  }

  rescale(): void {
    this.place();
    for (const view of this.views) view.refitIfUnsized();
  }

  dispose(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
    this.views = [];
    this.reported.clear();
    this.canvas.remove();
  }

  private build(layout: StageLayout | null): void {
    this.layout = layout;
    this.canvas.replaceChildren();
    this.canvas.hidden = layout === null;
    if (layout === null) {
      this.views = [];
      return;
    }
    this.canvas.style.width = `${layout.width}px`;
    this.canvas.style.height = `${layout.height}px`;
    const sizeScale = layout.height / REFERENCE_SCREEN.height;
    this.views = layout.elements.map(
      element => new StageElementView(element, sizeScale, this.canvas),
    );
    this.place();
  }

  private place(): void {
    const {layout} = this;
    if (layout === null) return;
    const {clientWidth, clientHeight} = this.parent;
    if (clientWidth === 0 || clientHeight === 0) return;
    const scale = Math.min(
      clientWidth / layout.width,
      clientHeight / layout.height,
    );
    this.canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  private draw(onlyTicking: boolean): void {
    for (const view of this.views) {
      if (onlyTicking && !this.ticks(view.element)) continue;
      const opacity =
        ELEMENT_SWITCH[view.element.kind] === 'slide'
          ? (this.content.frame?.clearOpacity?.slide ?? 1)
          : 1;
      view.show(
        contentOf(view.element, this.content) ??
          this.content.frame?.stage?.samples?.[view.element.kind] ??
          null,
        opacity,
      );
    }
  }

  private ticks({kind}: StageElement): boolean {
    const {frame} = this.content;
    if (kind === 'clock') return showsLayer(frame?.look ?? null, 'clock');
    if (kind !== 'timer') return false;
    const token = timerToken(frame);
    const timers = frame?.timers;
    return (
      token !== null && timers !== undefined && hasTickingToken(token, timers)
    );
  }

  private followTicking(): void {
    const ticking = this.views.some(view => this.ticks(view.element));
    if (ticking && this.ticker === null) {
      this.ticker = setInterval(this.tick, STAGE_TICK_MS);
    } else if (!ticking && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  // NOTE(0913vision): A tick that fails keeps the text that showed.
  private readonly tick = (): void => {
    try {
      this.draw(true);
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      if (
        this.reported.has(key) ||
        this.reported.size >= MAX_REPORTED_STAGE_ERRORS
      ) {
        return;
      }
      this.reported.add(key);
      this.onError('could not tick the stage layout', error);
    }
  };
}
