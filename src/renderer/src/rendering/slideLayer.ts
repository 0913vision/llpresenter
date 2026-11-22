import type {SongLyricFormat} from '@core/schema/songLyricFormat';
import type {SlideLayer} from '@core/live/state';
import {fitTextInFrame, fitsLineLimit} from './fitText';
import {measureTextInk} from './textInk';
import {classes} from './classes';
import {TEXT_EFFECTS, type TextStyle} from '@core/themes/textStyle';
import {continuationText} from '@core/bible/split/continuation';
import {contSizeOf} from '@core/bible/split/layout';
import {bulletTextStyle, textParagraphs} from './textParagraphs';
import bulletStyles from './bulletText.module.css';
import {resolveTextTracking} from '@core/themes/textTracking';
import {TextFitCache} from './textFitCache';

const textFits = new WeakMap<Document, TextFitCache>();

export const STAGE_NEXT_MIN_SIZE = 48;

const FALLBACK_FONTS = "'Pretendard Variable', sans-serif";

/** Canonical family used for PowerPoint's Korean NanumSquare face names. */
export function canonicalFontName(font: string): string {
  return /^나눔스퀘어(?: (?:ExtraBold|Bold))?$/u.test(font)
    ? 'NanumSquare'
    : font;
}

/** A CSS font family for a saved font name, with Pretendard as the fallback. */
export function fontFamilyFor(font: string): string {
  const escaped = canonicalFontName(font).replace(
    /["\\\p{Cc}]/gu,
    character => `\\${character.charCodeAt(0).toString(16)} `,
  );
  return `"${escaped}", ${FALLBACK_FONTS}`;
}

const NO_BREAK_SPACE = ' ';

function renderedRowLines(row: Element): string[] {
  const walker = row.ownerDocument.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  const result: string[] = [];
  let node: Node | null;
  let top: number | undefined;
  let bottom: number | undefined;
  let line = '';
  while ((node = walker.nextNode()) !== null) {
    const value = node.textContent ?? '';
    for (let index = 0; index < value.length;) {
      const character = String.fromCodePoint(value.codePointAt(index) ?? 0);
      const range = row.ownerDocument.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + character.length);
      const rect =
        typeof range.getClientRects === 'function'
          ? range.getClientRects()[0]
          : undefined;
      if (
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        top !== undefined &&
        bottom !== undefined &&
        (rect.top >= bottom - 2 || rect.bottom <= top + 2)
      ) {
        result.push(line.trimEnd());
        line = '';
        top = undefined;
        bottom = undefined;
      }
      if (rect && rect.width > 0 && rect.height > 0) {
        top = Math.min(top ?? rect.top, rect.top);
        bottom = Math.max(bottom ?? rect.bottom, rect.bottom);
      }
      line += character;
      index += character.length;
    }
  }
  result.push(line.trimEnd());
  return result;
}

function alignFixedPitch(
  block: HTMLElement,
  target: number,
  fitted: number,
): void {
  block.style.transform = '';
  if (fitted >= target || block.clientWidth === 0) return;
  const probe = block.ownerDocument.createElement('div');
  Object.assign(probe.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    visibility: 'hidden',
    whiteSpace: 'pre',
    fontSize: `${target}px`,
  });
  probe.textContent = Array.from(block.textContent.trim()).at(0) ?? '가';
  block.append(probe);
  const range = block.ownerDocument.createRange();
  if (typeof range.getBoundingClientRect !== 'function') {
    probe.remove();
    return;
  }
  range.selectNodeContents(probe);
  const reference = range.getBoundingClientRect().top;
  probe.style.fontSize = `${fitted}px`;
  const current = range.getBoundingClientRect().top;
  const scale = block.getBoundingClientRect().width / block.clientWidth;
  probe.remove();
  if (scale > 0) {
    block.style.transform = `translateY(${(reference - current) / scale}px)`;
  }
}

const JUSTIFY: Readonly<Record<TextStyle['vAlign'], string>> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

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
  lyricFormat?: SongLyricFormat | undefined;
}

function sameSlide(a: SlideLayer | null, b: SlideLayer | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.itemId === b.itemId &&
    a.position === b.position &&
    a.continued === b.continued &&
    a.biblePart === b.biblePart &&
    JSON.stringify(a.lyricFormat) === JSON.stringify(b.lyricFormat) &&
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
    keepWords = false,
    lyricFormat,
  }: {
    readonly keepWords?: boolean;
    readonly lyricFormat?: SongLyricFormat | undefined;
    readonly continued?: boolean | undefined;
    readonly bullets?: boolean | undefined;
    readonly biblePart?: number | undefined;
  } = {},
): void {
  page.lines = lines;
  page.continued = continued;
  page.biblePart = biblePart;
  const {block} = page;
  block.dataset['keepWords'] = String(keepWords);
  page.lyricFormat =
    lyricFormat?.lines.length === lines.length ? lyricFormat : undefined;
  if (bullets && biblePart === undefined) lines = textParagraphs(lines);
  lines.forEach((line, index) => {
    const row =
      block.children.item(index) ??
      block.appendChild(document.createElement('div'));
    row.removeAttribute('style');
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
    const body = keepWords
      ? run.body
          .replace(/(^|\s)([가-힣]) (?=\S)/gu, '$1$2\u00a0')
          .replace(/(\S) ([가-힣])(?=\s|$)/gu, '$1\u00a0$2')
      : run.body;
    row.textContent =
      body.length > 0 ? body : run.marker === '' ? NO_BREAK_SPACE : '';
    const entry = page.lyricFormat?.lines[index];
    const formatted =
      entry?.runs.map(part => part.text).join('') === line ? entry : undefined;
    if (formatted !== undefined && !bullets) {
      let offset = 0;
      row.replaceChildren(
        ...formatted.runs.map(run => {
          const span = document.createElement('span');
          span.textContent = body.slice(offset, offset + run.text.length);
          offset += run.text.length;
          if (run.weight !== undefined) {
            span.style.fontWeight = String(run.weight);
          }
          if (run.font !== undefined) {
            span.style.fontFamily = fontFamilyFor(run.font);
            if (run.font === '나눔스퀘어 ExtraBold') {
              span.style.fontWeight = '800';
            } else if (run.font === '나눔스퀘어 Bold') {
              span.style.fontWeight = '700';
            }
          }
          return span;
        }),
      );
    }
    if (bullets && startsParagraph && line.trim() !== '') {
      const marker = document.createElement('span');
      marker.className = bulletStyles.marker ?? '';
      marker.setAttribute('aria-hidden', 'true');
      const glyph = document.createElement('span');
      glyph.className = bulletStyles.glyph ?? '';
      glyph.textContent = '•';
      marker.append(glyph);
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
  {
    width,
    unwrapped = false,
    continued = false,
  }: {width: number; unwrapped?: boolean; continued?: boolean},
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
  const {spacing, indent} = resolveTextTracking(
    style,
    lines.join('\n'),
    continued,
  );
  page.block.style.letterSpacing = `${spacing}px`;
  page.block.style.textIndent = `${indent}px`;
  if (unwrapped) page.block.style.whiteSpace = 'pre';
  host.append(page.element);
  document.body.append(host);
  try {
    writeLines(page, lines, {continued});
  } catch (error) {
    host.remove();
    throw error;
  }
  const setSize = (size: number): void => {
    page.block.style.fontSize = `${size}px`;
    for (const marker of page.block.querySelectorAll<HTMLElement>(
      '[data-bible-continuation]',
    )) {
      marker.style.fontSize = `${contSizeOf({size})}px`;
    }
  };
  return {
    width: size => {
      setSize(size);
      return page.block.scrollWidth;
    },
    layoutHeight: size => {
      setSize(size);
      return page.block.getBoundingClientRect().height;
    },
    height: size => {
      setSize(size);
      const measured = page.block.scrollHeight;
      return measured === 0 && lines.every(line => line.trim() === '')
        ? lines.length * size * style.lineHeight
        : measured;
    },
    dispose: () => host.remove(),
  };
}

/** Draws one text box, fitted to its frame. */
export class SlideLayerView {
  private readonly element = document.createElement('div');
  private readonly page: Page;
  private current: SlideLayer | null = null;
  private scale = 1;
  private maximumSize: number | undefined;
  private targetSize: number | undefined;
  private minimumSize: number | undefined;
  private fitLines: number | undefined;
  private lineMode: 'normal' | 'song' | 'lyrics' | 'bar' = 'normal';
  private ellipsis = false;
  private balanceWrap = false;
  private fixedLineSpacing = false;
  private stageInlineLabel: string | undefined;

  constructor(
    parent: HTMLElement,
    private style: TextStyle,
    private readonly previewMaxLines?: number,
  ) {
    this.element.className = classes.layer;
    this.element.classList.toggle(classes.shadow, effects(style).shadow.on);
    this.element.classList.toggle(classes.outline, effects(style).outline.on);
    this.page = createPage(style);
    this.rescale(1);
    this.element.append(this.page.element);
    parent.append(this.element);
  }

  /** Shows the text, or clears the box for null. */
  show(slide: SlideLayer | null): void {
    if (sameSlide(this.current, slide)) return;
    this.current = slide;
    this.page.element.classList.toggle(classes.shown, slide !== null);
    if (slide === null) {
      writeLines(this.page, ['']);
      return;
    }
    writeLines(this.page, slide.lines, {
      continued: slide.continued,
      bullets: this.style.bullets,
      biblePart: slide.biblePart,
      lyricFormat: slide.lyricFormat,
    });
    this.fit(this.page);
  }

  /** Rewrites the lines on screen in place; nothing shown stays empty. */
  replaceLines(lines: readonly string[]): void {
    if (this.current === null) return;
    this.current = {...this.current, lines};
    writeLines(this.page, lines, {
      continued: this.current.continued,
      bullets: this.style.bullets,
      biblePart: this.current.biblePart,
      lyricFormat: this.current.lyricFormat,
    });
    this.fit(this.page);
  }

  /** Applies a changed text style in place. */
  setStyle(style: TextStyle): void {
    if (STYLE_FIELDS.every(key => this.style[key] === style[key])) return;
    const bulletsChanged = this.style.bullets !== style.bullets;
    this.style = style;
    this.element.classList.toggle(classes.shadow, effects(style).shadow.on);
    this.element.classList.toggle(classes.outline, effects(style).outline.on);
    applyStyle(this.page, style);
    if (bulletsChanged) {
      writeLines(this.page, this.page.lines, {
        continued: this.page.continued,
        bullets: style.bullets,
        biblePart: this.page.biblePart,
      });
    }
    this.rescale(this.scale);
  }

  /** Lays the text out again at a new screen scale. */
  rescale(scale: number): void {
    this.scale = scale;
    this.applyTracking(this.page);
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
    if (this.current !== null) this.fit(this.page);
  }

  /** The fitted CSS font size in scaled layout pixels, before any canvas transform. */
  fittedSize(): number | undefined {
    if (this.current === null) return undefined;
    return Number.parseFloat(this.page.block.style.fontSize);
  }

  /** The actual line boxes produced by the audience's text layout. */
  renderedLines(): readonly string[] | undefined {
    if (this.current === null) return undefined;
    const page = this.page;
    return Array.from(page.block.children).flatMap(renderedRowLines);
  }

  lineBoxBounds(): {top: number; bottom: number} | undefined {
    return this.current === null
      ? undefined
      : this.page.block.getBoundingClientRect();
  }

  inkBounds(): {top: number; bottom: number} | undefined {
    return this.current === null ? undefined : measureTextInk(this.page.block);
  }

  capSize(maximum: number | undefined): void {
    this.maximumSize = maximum === undefined ? undefined : maximum / this.scale;
    if (this.current !== null) this.fit(this.page);
  }

  /** Fit toward this size even when the saved style sets a smaller default. */
  setTargetSize(target: number | undefined): void {
    const size = target === undefined ? undefined : target / this.scale;
    if (size === this.targetSize) return;
    this.targetSize = size;
    if (this.current !== null) this.fit(this.page);
  }

  /** Keep source lines intact unless a song would become too small. */
  setLineMode(mode: 'normal' | 'song' | 'lyrics' | 'bar'): void {
    if (mode === this.lineMode) return;
    this.lineMode = mode;
    if (this.current !== null) this.fit(this.page);
  }

  setEllipsis(enabled: boolean): void {
    if (enabled === this.ellipsis) return;
    this.ellipsis = enabled;
    if (this.current !== null) this.fit(this.page);
  }

  /** Balance each authored lyric line if it wraps. */
  setBalanceWrap(balance: boolean): void {
    if (this.balanceWrap === balance) return;
    this.balanceWrap = balance;
    if (this.current !== null) this.fit(this.page);
  }

  /** Keep the lyric line pitch independent of width-driven font fitting. */
  setFixedLineSpacing(fixed: boolean): void {
    if (this.fixedLineSpacing === fixed) return;
    this.fixedLineSpacing = fixed;
    if (this.current !== null) this.fit(this.page);
  }

  /** Fits lyrics first, then places an optional stage label without resizing them. */
  setStageInlineLabel(label: string | undefined): void {
    if (this.stageInlineLabel === label) return;
    this.stageInlineLabel = label;
    if (this.current !== null) this.fit(this.page);
  }

  setFitLines(limit: number | undefined): void {
    this.fitLines = limit;
  }

  setMinimumSize(minimum: number | undefined): void {
    if (this.minimumSize === minimum) return;
    this.minimumSize = minimum;
    if (this.current !== null) this.fit(this.page);
  }

  dispose(): void {
    this.element.remove();
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
    block.querySelector('[data-stage-inline-label]')?.remove();
    block.style.transform = '';
    block.style.maxHeight = '';
    block.style.overflow = '';
    block.style.textWrap =
      this.balanceWrap && this.lineMode === 'normal' ? 'balance' : '';
    block.style.wordBreak =
      this.balanceWrap && this.lineMode === 'normal' ? 'keep-all' : '';
    block.style.overflowWrap =
      this.balanceWrap && this.lineMode === 'normal' ? 'normal' : '';
    const size = (this.targetSize ?? this.style.size) * this.scale;
    let fixedSpacing = this.fixedLineSpacing && page.lyricFormat === undefined;
    block.style.lineHeight = fixedSpacing
      ? `${size * this.style.lineHeight}px`
      : String(this.style.lineHeight);
    const markers = block.querySelectorAll<HTMLElement>(
      '[data-bible-continuation]',
    );
    const setSize = (px: number): void => {
      block.style.fontSize = `${px}px`;
      page.lyricFormat?.lines.forEach((line, index) => {
        if (line.runs.map(part => part.text).join('') !== page.lines[index]) {
          return;
        }
        const row = block.children.item(index);
        if (!(row instanceof HTMLElement)) return;
        const factor = (px / size) * this.scale;
        const runSizes = line.runs.flatMap(run =>
          run.size === undefined ? [] : [run.size],
        );
        row.style.fontSize = runSizes.length
          ? `${Math.max(...runSizes) * factor}px`
          : '';
        row.style.maxWidth = `${1920 * this.scale}px`;
        row.style.marginLeft =
          this.style.align === 'center' || this.style.align === 'right'
            ? 'auto'
            : '';
        row.style.marginRight = this.style.align === 'center' ? 'auto' : '';
        row.style.marginTop = line.paragraphGap
          ? `${line.paragraphGap * factor}px`
          : '';
        if (line.spacing?.kind === 'ratio') {
          row.style.lineHeight = String(line.spacing.value);
        } else if (line.spacing?.kind === 'pixels') {
          row.style.lineHeight = `${line.spacing.value * factor}px`;
        }
        line.runs.forEach((run, at) => {
          const span = row.children.item(at);
          if (!(span instanceof HTMLElement)) return;
          if (run.size !== undefined) {
            span.style.fontSize = `${run.size * factor}px`;
          }
          if (run.tracking !== undefined) {
            span.style.letterSpacing = `${run.tracking * factor}px`;
          }
        });
      });
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
    if (fixedSpacing) {
      block.style.whiteSpace = this.lineMode === 'normal' ? '' : 'pre';
      setSize(1);
      if (block.scrollHeight > height + 1) {
        fixedSpacing = false;
        block.style.lineHeight = String(this.style.lineHeight);
      }
    }
    const document = element.ownerDocument;
    let cache = textFits.get(document);
    if (cache === undefined) {
      cache = new TextFitCache();
      textFits.set(document, cache);
    }
    const fontSize = cache.fit(
      JSON.stringify([
        page.lines,
        page.lyricFormat,
        page.continued,
        page.biblePart,
        this.lineMode,
        this.balanceWrap,
        fixedSpacing,
        this.fitLines,
        this.targetSize,
        this.style,
        this.scale,
        width,
        height,
      ]),
      () => {
        for (const row of Array.from(block.children)) {
          if (row instanceof HTMLElement) {
            row.style.overflow = '';
            row.style.textOverflow = '';
            row.style.whiteSpace = this.ellipsis
              ? 'nowrap'
              : this.lineMode === 'song'
                ? 'pre'
                : '';
          }
        }
        block.style.whiteSpace = this.lineMode === 'normal' ? '' : 'pre';
        const fitted = fitTextInFrame({size, width, height}, px => {
          setSize(px);
          const exceedsLines = !fitsLineLimit(block.offsetHeight, px, {
            lineHeight: fixedSpacing
              ? (size * this.style.lineHeight) / px
              : this.style.lineHeight,
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
    const minimum = Math.ceil(size * 0.7);
    const wraps = this.lineMode === 'lyrics' && fontSize < minimum;
    const keepWords =
      (this.lineMode === 'lyrics' ||
        (this.balanceWrap && this.lineMode === 'song')) &&
      wraps;
    if ((block.dataset['keepWords'] === 'true') !== keepWords) {
      writeLines(page, page.lines, {
        continued: page.continued,
        bullets: this.style.bullets,
        biblePart: page.biblePart,
        keepWords,
        lyricFormat: page.lyricFormat,
      });
      block.dataset['keepWords'] = String(keepWords);
    }
    const balance = this.balanceWrap && (wraps || this.lineMode === 'normal');
    block.style.whiteSpace = '';
    block.style.textWrap = balance ? 'balance' : '';
    // NOTE(0913vision): text-wrap resets part of white-space, so set pre last.
    if (this.lineMode !== 'normal' && !wraps) block.style.whiteSpace = 'pre';
    block.style.wordBreak = keepWords || balance ? 'keep-all' : '';
    block.style.overflowWrap = keepWords || balance ? 'normal' : '';
    setSize(
      Math.max(
        wraps ? minimum : 0,
        (this.minimumSize ?? 0) * this.scale,
        Math.min(fontSize, (this.maximumSize ?? Infinity) * this.scale),
      ),
    );
    if (fixedSpacing) {
      alignFixedPitch(block, size, Number.parseFloat(block.style.fontSize));
    }
    for (const row of Array.from(block.children)) {
      if (row instanceof HTMLElement) {
        row.style.overflow = this.ellipsis ? 'hidden' : '';
        row.style.textOverflow = this.ellipsis ? 'ellipsis' : '';
        row.style.whiteSpace = this.ellipsis
          ? 'nowrap'
          : this.lineMode === 'song'
            ? 'pre'
            : '';
      }
    }
    this.placeStageInlineLabel(page);
    if (this.fitLines !== undefined) {
      block.style.maxHeight = `${(fixedSpacing ? size : Number.parseFloat(block.style.fontSize)) * this.style.lineHeight * this.fitLines}px`;
      block.style.overflow = 'hidden';
    }
  }

  private placeStageInlineLabel(page: Page): void {
    const label = this.stageInlineLabel;
    const row = page.block.firstElementChild;
    if (!label || !(row instanceof HTMLElement)) return;
    const marker = document.createElement('span');
    marker.dataset['stageInlineLabel'] = 'true';
    marker.textContent = `(${label}) `;
    const rowHeight = row.scrollHeight;
    const lineHeight =
      Number.parseFloat(page.block.style.fontSize) * this.style.lineHeight;
    row.prepend(marker);
    const overflows =
      rowHeight > lineHeight + 1 ||
      row.scrollWidth > page.element.clientWidth + 1 ||
      row.scrollHeight > rowHeight + 1;
    if (overflows) {
      marker.remove();
      marker.textContent = `(${label})`;
      marker.style.position = 'absolute';
      marker.style.left = '0';
      marker.style.width = '100%';
      marker.style.top = '-1.2em';
      page.block.style.position = 'relative';
      row.prepend(marker);
    }
  }
}
