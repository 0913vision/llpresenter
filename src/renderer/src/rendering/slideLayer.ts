import type {SlideLayer} from '@core/live/state';
import {fitTextInFrame, fitsLineLimit} from './fitText';
import {measureTextInk} from './textInk';
import {classes} from './classes';
import {TEXT_EFFECTS, type TextStyle} from '@core/themes/textStyle';
import type {SlideTransition} from '@core/schema/slideTransition';
import {SlideAnimation, type SlideAnimationFrame} from './slideAnimation';
import {continuationText} from '@core/bible/split/continuation';
import {contSizeOf} from '@core/bible/split/layout';
import {bulletTextStyle, textParagraphs} from './textParagraphs';
import bulletStyles from './bulletText.module.css';
import {resolveTextTracking} from '@core/themes/textTracking';
import {TextFitCache} from './textFitCache';

const textFits = new WeakMap<Document, TextFitCache>();

/** The dissolve between 장 (docs/spec/03-output.md, version 1 default). */
export const SLIDE_DISSOLVE_MS = 200;

const MIN_STAGE_LYRIC_SIZE = 72;
export const STAGE_NEXT_MIN_SIZE = 48;

const FALLBACK_FONTS = "'Pretendard Variable', sans-serif";

/** A CSS font family for a saved font name, with Pretendard as the fallback. */
export function fontFamilyFor(font: string): string {
  const escaped = font.replace(
    /["\\\p{Cc}]/gu,
    character => `\\${character.charCodeAt(0).toString(16)} `,
  );
  return `"${escaped}", ${FALLBACK_FONTS}`;
}

const NO_BREAK_SPACE = ' ';

const JUSTIFY: Readonly<Record<TextStyle['vAlign'], string>> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

type PageIndex = 0 | 1;

function effects(style: TextStyle) {
  return {
    outline:
      typeof style.outline === 'boolean'
        ? {
            on: style.outline,
            width: TEXT_EFFECTS.outlineWidth,
            color: '#000000',
          }
        : style.outline,
    shadow:
      typeof style.shadow === 'boolean'
        ? {
            on: style.shadow,
            distance: TEXT_EFFECTS.shadowDistance,
            blur: TEXT_EFFECTS.shadowBlur,
            angle: 45,
            opacity: TEXT_EFFECTS.shadowOpacity * 100,
            color: '#000000',
          }
        : style.shadow,
  };
}

interface Page {
  readonly element: HTMLDivElement;
  readonly block: HTMLDivElement;
  lines: readonly string[];
  continued: boolean;
  biblePart: number | undefined;
}

function sameSlide(a: SlideLayer | null, b: SlideLayer | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.itemId === b.itemId &&
    a.position === b.position &&
    a.continued === b.continued &&
    a.biblePart === b.biblePart &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => line === b.lines[index])
  );
}

function createPage(style: TextStyle): Page {
  const element = document.createElement('div');
  const block = document.createElement('div');
  element.className = classes.page;
  block.className = classes.block;
  const page: Page = {
    element,
    block,
    lines: [],
    continued: false,
    biblePart: undefined,
  };
  applyStyle(page, style);
  element.append(block);
  return page;
}

function applyStyle({element, block}: Page, style: TextStyle): void {
  element.style.inset = `${style.margin}%`;
  element.style.justifyContent = JUSTIFY[style.vAlign];
  element.style.textAlign = style.align;
  block.style.fontFamily = fontFamilyFor(style.font);
  block.style.fontWeight = String(style.weight);
  block.style.lineHeight = String(style.lineHeight);
  block.style.color = style.color;
  for (const [name, value] of Object.entries(bulletTextStyle(style))) {
    block.style.setProperty(name, value);
  }
}

const STYLE_FIELDS = [
  'font',
  'weight',
  'size',
  'color',
  'lineHeight',
  'tracking',
  'shortTracking',
  'bullets',
  'bulletStyle',
  'align',
  'vAlign',
  'maxLines',
  'margin',
  'shadow',
  'outline',
] as const satisfies ReadonlyArray<keyof TextStyle>;

function writeLines(
  page: Page,
  lines: readonly string[],
  {
    continued = false,
    bullets = false,
    biblePart,
  }: {
    readonly continued?: boolean | undefined;
    readonly bullets?: boolean | undefined;
    readonly biblePart?: number | undefined;
  } = {},
): void {
  page.lines = lines;
  page.continued = continued;
  page.biblePart = biblePart;
  const {block} = page;
  if (bullets && biblePart === undefined) lines = textParagraphs(lines);
  lines.forEach((line, index) => {
    const row =
      block.children.item(index) ??
      block.appendChild(document.createElement('div'));
    const startsParagraph =
      biblePart === undefined || (biblePart === 1 && index === 0);
    row.classList.toggle(
      bulletStyles.paragraph ?? 'bulletParagraph',
      bullets && startsParagraph,
    );
    row.classList.toggle(
      bulletStyles.continuation ?? 'bulletContinuation',
      bullets && !startsParagraph,
    );
    const run = continuationText(line, continued && index === lines.length - 1);
    row.textContent =
      run.body.length > 0 ? run.body : run.marker === '' ? NO_BREAK_SPACE : '';
    if (bullets && startsParagraph && line.trim() !== '') {
      const marker = document.createElement('span');
      marker.className = bulletStyles.marker ?? '';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = '•';
      row.prepend(marker);
    }
    if (run.marker !== '') {
      const marker = document.createElement('span');
      marker.dataset['bibleContinuation'] = '';
      marker.textContent = run.marker;
      row.append(marker);
    }
  });
  while (block.children.length > lines.length) block.lastElementChild?.remove();
}

/**
 * Measures the same page and row DOM used by SlideLayerView, without showing it.
 * Layout height counts line boxes; scroll height also includes overflowing glyphs.
 */
export function measureSlideText(
  lines: readonly string[],
  style: TextStyle,
  {width, unwrapped = false}: {width: number; unwrapped?: boolean},
): {
  height: (size: number) => number;
  /** No empty-text fallback: an empty broadcast box is hidden. */
  layoutHeight: (size: number) => number;
  width: (size: number) => number;
  dispose: () => void;
} {
  const host = document.createElement('div');
  host.dataset['slideMeasure'] = '';
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${width}px`,
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const page = createPage(style);
  page.element.style.position = 'relative';
  page.element.style.inset = 'auto';
  page.block.style.width = '100%';
  if (unwrapped) page.block.style.whiteSpace = 'pre';
  host.append(page.element);
  document.body.append(host);
  try {
    writeLines(page, lines);
  } catch (error) {
    host.remove();
    throw error;
  }
  return {
    width: size => {
      page.block.style.fontSize = `${size}px`;
      return page.block.scrollWidth;
    },
    layoutHeight: size => {
      page.block.style.fontSize = `${size}px`;
      return page.block.getBoundingClientRect().height;
    },
    height: size => {
      page.block.style.fontSize = `${size}px`;
      const measured = page.block.scrollHeight;
      return measured === 0 && lines.every(line => line.trim() === '')
        ? lines.length * size * style.lineHeight
        : measured;
    },
    dispose: () => host.remove(),
  };
}

/** Removes the active page translation from measured bounds. */
export function unshiftTextBounds(
  bounds: {top: number; bottom: number},
  offset: number,
): {top: number; bottom: number} {
  return {top: bounds.top - offset, bottom: bounds.bottom - offset};
}

/** Two pages take turns rendering and transitioning slide text. */
export class SlideLayerView {
  private readonly element = document.createElement('div');
  private readonly pages: readonly [Page, Page];
  private front: PageIndex = 0;
  private current: SlideLayer | null = null;
  private scale = 1;
  private maximumSize: number | undefined;
  private targetSize: number | undefined;
  private minimumSize: number | undefined;
  private fitLines: number | undefined;
  private lineMode: 'normal' | 'song' | 'bar' = 'normal';
  private dissolveMs: number = SLIDE_DISSOLVE_MS;
  private effect: SlideTransition | undefined;
  private readonly animation = new SlideAnimation();

  constructor(
    parent: HTMLElement,
    private style: TextStyle,
    private readonly previewMaxLines?: number,
  ) {
    this.element.className = classes.layer;
    this.element.classList.toggle(classes.shadow, effects(style).shadow.on);
    this.element.classList.toggle(classes.outline, effects(style).outline.on);
    this.element.style.setProperty(
      '--slide-dissolve',
      `${SLIDE_DISSOLVE_MS}ms`,
    );
    this.pages = [createPage(style), createPage(style)];
    this.rescale(1);
    this.element.append(this.pages[0].element, this.pages[1].element);
    parent.append(this.element);
  }

  /** Shows the 장 with a dissolve, or clears the layer at once for null. */
  show(slide: SlideLayer | null, transitions = true): void {
    if (!transitions) this.animation.cancel();
    if (sameSlide(this.current, slide)) return;
    this.current = slide;
    if (slide === null) {
      this.clearAtOnce();
      return;
    }
    const back: PageIndex = this.front === 0 ? 1 : 0;
    const next = this.pages[back];
    writeLines(next, slide.lines, {
      continued: slide.continued,
      bullets: this.style.bullets,
      biblePart: slide.biblePart,
    });
    this.fit(next);
    this.element.classList.toggle(classes.instant, !transitions);
    next.element.classList.add(classes.shown);
    this.pages[this.front].element.classList.remove(classes.shown);
    if (this.effect !== undefined) {
      this.animation.play(
        this.pages[this.front].element,
        next.element,
        transitions ? this.effect : {kind: 'none', sec: this.effect.sec},
      );
    }
    this.front = back;
  }

  /** Rewrites the lines on screen in place, without a dissolve; nothing shown stays empty. */
  replaceLines(lines: readonly string[]): void {
    if (this.current === null) return;
    this.current = {...this.current, lines};
    const front = this.pages[this.front];
    writeLines(front, lines, {
      continued: this.current.continued,
      bullets: this.style.bullets,
      biblePart: this.current.biblePart,
    });
    this.fit(front);
  }

  /** Selects the next effect without restarting the animation already running. */
  setTransition(effect: SlideTransition, frame?: SlideAnimationFrame): void {
    this.effect = effect;
    this.animation.setFrame(frame);
    for (const page of this.pages) {
      page.element.style.willChange = 'transform, opacity, clip-path';
    }
  }

  finishTransition(): void {
    this.animation.cancel();
  }

  setDissolveMs(ms: number): void {
    if (ms === this.dissolveMs) return;
    this.dissolveMs = ms;
    this.element.style.setProperty('--slide-dissolve', `${ms}ms`);
  }

  /** Applies a changed text style in place, without replacing pages or dissolving. */
  setStyle(style: TextStyle): void {
    if (STYLE_FIELDS.every(key => this.style[key] === style[key])) return;
    const bulletsChanged = this.style.bullets !== style.bullets;
    this.style = style;
    this.element.classList.add(classes.instant);
    this.element.classList.toggle(classes.shadow, effects(style).shadow.on);
    this.element.classList.toggle(classes.outline, effects(style).outline.on);
    for (const page of this.pages) {
      applyStyle(page, style);
      if (bulletsChanged) {
        writeLines(page, page.lines, {
          continued: page.continued,
          bullets: style.bullets,
          biblePart: page.biblePart,
        });
      }
    }
    this.rescale(this.scale);
  }

  /** Lays the 장 out again at a new screen scale, without a dissolve. */
  rescale(scale: number): void {
    this.scale = scale;
    for (const page of this.pages) this.applyTracking(page);
    const {shadow, outline} = effects(this.style);
    const angle = (shadow.angle * Math.PI) / 180;
    const x = Math.round(Math.cos(angle) * shadow.distance * scale * 1e6) / 1e6;
    const y = Math.round(Math.sin(angle) * shadow.distance * scale * 1e6) / 1e6;
    this.element.style.setProperty('--lyric-shadow-offset', `${x}px`);
    this.element.style.setProperty('--lyric-shadow-x', `${x}px`);
    this.element.style.setProperty('--lyric-shadow-y', `${y}px`);
    this.element.style.setProperty(
      '--lyric-shadow-blur',
      `${shadow.blur * scale}px`,
    );
    this.element.style.setProperty(
      '--lyric-outline-width',
      `${outline.width * scale}px`,
    );
    this.element.style.setProperty(
      '--lyric-shadow-strength',
      `${shadow.opacity}%`,
    );
    this.element.style.setProperty('--lyric-shadow-color', shadow.color);
    this.element.style.setProperty('--lyric-outline-color', outline.color);
    if (this.current !== null) this.fit(this.pages[this.front]);
  }

  /** The fitted CSS font size in scaled layout pixels, before any canvas transform. */
  fittedSize(): number | undefined {
    if (this.current === null) return undefined;
    return Number.parseFloat(this.pages[this.front].block.style.fontSize);
  }

  lineBoxBounds(): {top: number; bottom: number} | undefined {
    if (this.current === null) return undefined;
    const rect = this.pages[this.front].block.getBoundingClientRect();
    return unshiftTextBounds(rect, this.transitionOffset());
  }

  private transitionOffset(): number {
    const transform = getComputedStyle(
      this.pages[this.front].element,
    ).transform;
    if (!transform || transform === 'none') return 0;
    const matrix = new DOMMatrixReadOnly(transform);
    const rect = this.element.getBoundingClientRect();
    const scale =
      this.element.clientWidth > 0 ? rect.width / this.element.clientWidth : 1;
    return matrix.m42 * scale;
  }

  inkBounds(): {top: number; bottom: number} | undefined {
    if (this.current === null) return undefined;
    const block = this.pages[this.front].block;
    const bounds = measureTextInk(block);
    if (bounds === undefined) return undefined;
    const offset = this.transitionOffset();
    return unshiftTextBounds(bounds, offset);
  }

  capSize(maximum: number | undefined): void {
    this.maximumSize = maximum === undefined ? undefined : maximum / this.scale;
    if (this.current !== null) this.fit(this.pages[this.front]);
  }

  /** Fit toward this size even when the saved style sets a smaller default. */
  setTargetSize(target: number | undefined): void {
    const size = target === undefined ? undefined : target / this.scale;
    if (size === this.targetSize) return;
    this.targetSize = size;
    if (this.current !== null) this.fit(this.pages[this.front]);
  }

  /** Keep source lines intact unless a song would become too small. */
  setLineMode(mode: 'normal' | 'song' | 'bar'): void {
    if (mode === this.lineMode) return;
    this.lineMode = mode;
    if (this.current !== null) this.fit(this.pages[this.front]);
  }

  setFitLines(limit: number | undefined): void {
    this.fitLines = limit;
  }

  setMinimumSize(minimum: number | undefined): void {
    if (this.minimumSize === minimum) return;
    this.minimumSize = minimum;
    if (this.current !== null) this.fit(this.pages[this.front]);
  }

  dispose(): void {
    this.animation.cancel();
    this.element.remove();
  }

  private clearAtOnce(): void {
    this.animation.cancel();
    this.element.classList.add(classes.instant);
    for (const page of this.pages) {
      if (this.effect !== undefined) page.element.style.opacity = '0';
      page.element.classList.remove(classes.shown);
      writeLines(page, ['']);
    }
  }

  private applyTracking(page: Page): void {
    const {spacing, indent} = resolveTextTracking(
      this.style,
      page.lines.join('\n'),
      page.continued,
    );
    page.block.style.letterSpacing = `${spacing * this.scale}px`;
    page.block.style.textIndent = `${indent * this.scale}px`;
  }

  private fit(page: Page): void {
    this.applyTracking(page);
    const {element, block} = page;
    block.style.maxHeight = '';
    block.style.overflow = '';
    const size = (this.targetSize ?? this.style.size) * this.scale;
    const markers = block.querySelectorAll<HTMLElement>(
      '[data-bible-continuation]',
    );
    const setSize = (px: number): void => {
      block.style.fontSize = `${px}px`;
      for (const marker of markers) {
        marker.style.fontSize = `${contSizeOf({size: px / this.scale}) * this.scale}px`;
      }
    };
    const maxLines = this.previewMaxLines;
    if (maxLines !== undefined) {
      setSize(size);
      element.style.justifyContent =
        block.children.length > maxLines
          ? 'flex-start'
          : JUSTIFY[this.style.vAlign];
      Array.from(block.children).forEach((row, index) => {
        row.classList.toggle(classes.bibleOverflow, index >= maxLines);
      });
      return;
    }
    const width = element.clientWidth;
    const height = element.clientHeight;
    const document = element.ownerDocument;
    let cache = textFits.get(document);
    if (cache === undefined) {
      cache = new TextFitCache();
      textFits.set(document, cache);
    }
    const fontSize = cache.fit(
      JSON.stringify([
        page.lines,
        page.continued,
        page.biblePart,
        this.lineMode,
        this.fitLines,
        this.targetSize,
        this.style,
        this.scale,
        width,
        height,
      ]),
      () => {
        block.style.whiteSpace = this.lineMode === 'normal' ? '' : 'pre';
        const fitted = fitTextInFrame({size, width, height}, px => {
          setSize(px);
          const exceedsLines = !fitsLineLimit(block.offsetHeight, px, {
            lineHeight: this.style.lineHeight,
            limit: this.fitLines,
          });
          return {
            width: block.scrollWidth,
            height: exceedsLines ? Infinity : block.scrollHeight,
          };
        });
        return fitted;
      },
      document.fonts,
    );
    const songMinimum =
      Math.min(
        MIN_STAGE_LYRIC_SIZE,
        this.maximumSize ?? Infinity,
        this.targetSize ?? Infinity,
      ) * this.scale;
    const wraps = this.lineMode === 'song' && fontSize < songMinimum;
    block.style.whiteSpace = this.lineMode === 'normal' || wraps ? '' : 'pre';
    setSize(
      Math.max(
        wraps ? songMinimum : 0,
        (this.minimumSize ?? 0) * this.scale,
        Math.min(fontSize, (this.maximumSize ?? Infinity) * this.scale),
      ),
    );
    if (this.fitLines !== undefined) {
      block.style.maxHeight = `${Number.parseFloat(block.style.fontSize) * this.style.lineHeight * this.fitLines}px`;
      block.style.overflow = 'hidden';
    }
  }
}
