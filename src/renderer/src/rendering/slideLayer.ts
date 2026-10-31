import type {SlideLayer} from '@core/live/state';
import {fitTextInFrame} from './fitText';
import {classes} from './classes';
import {LYRIC_EFFECTS, type LyricStyle} from '@core/looks/lyricStyle';
import {OUTPUT_TRANSITIONS} from './transitions';

/** The dissolve between 장 (docs/spec/03-output.md, version 1 default). */
export const SLIDE_DISSOLVE_MS = OUTPUT_TRANSITIONS.slideMs;

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

const JUSTIFY: Readonly<Record<LyricStyle['vAlign'], string>> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

type PageIndex = 0 | 1;

function effects(style: LyricStyle) {
  return {
    outline:
      typeof style.outline === 'boolean'
        ? {
            on: style.outline,
            width: LYRIC_EFFECTS.outlineWidth,
            color: '#000000',
          }
        : style.outline,
    shadow:
      typeof style.shadow === 'boolean'
        ? {
            on: style.shadow,
            distance: LYRIC_EFFECTS.shadowDistance,
            blur: LYRIC_EFFECTS.shadowBlur,
            angle: 45,
            opacity: LYRIC_EFFECTS.shadowOpacity * 100,
            color: '#000000',
          }
        : style.shadow,
  };
}

interface Page {
  readonly element: HTMLDivElement;
  readonly block: HTMLDivElement;
}

function sameSlide(a: SlideLayer | null, b: SlideLayer | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.itemId === b.itemId &&
    a.position === b.position &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => line === b.lines[index])
  );
}

function createPage(style: LyricStyle): Page {
  const element = document.createElement('div');
  const block = document.createElement('div');
  element.className = classes.page;
  block.className = classes.block;
  const page = {element, block};
  applyStyle(page, style);
  element.append(block);
  return page;
}

function applyStyle({element, block}: Page, style: LyricStyle): void {
  element.style.inset = `${style.margin}%`;
  element.style.justifyContent = JUSTIFY[style.vAlign];
  element.style.textAlign = style.align;
  block.style.fontFamily = fontFamilyFor(style.font);
  block.style.fontWeight = String(style.weight);
  block.style.lineHeight = String(style.lineHeight);
  block.style.color = style.color;
}

const STYLE_FIELDS = [
  'font',
  'weight',
  'size',
  'color',
  'lineHeight',
  'align',
  'vAlign',
  'maxLines',
  'margin',
  'shadow',
  'outline',
] as const satisfies ReadonlyArray<keyof LyricStyle>;

function writeLines(block: HTMLElement, lines: readonly string[]): void {
  lines.forEach((line, index) => {
    const row =
      block.children.item(index) ??
      block.appendChild(document.createElement('div'));
    row.textContent = line.length > 0 ? line : NO_BREAK_SPACE;
  });
  while (block.children.length > lines.length) block.lastElementChild?.remove();
}

/**
 * The lyrics layer. Two pages take turns so a new 장 dissolves over the last
 * one; their rows are reused from 장 to 장.
 */
export class SlideLayerView {
  private readonly element = document.createElement('div');
  private readonly pages: readonly [Page, Page];
  private front: PageIndex = 0;
  private current: SlideLayer | null = null;
  private scale = 1;

  constructor(
    parent: HTMLElement,
    private style: LyricStyle,
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
  show(slide: SlideLayer | null): void {
    if (sameSlide(this.current, slide)) return;
    this.current = slide;
    if (slide === null) {
      this.clearAtOnce();
      return;
    }
    const back: PageIndex = this.front === 0 ? 1 : 0;
    const next = this.pages[back];
    writeLines(next.block, slide.lines);
    this.fit(next);
    this.element.classList.remove(classes.instant);
    next.element.classList.add(classes.shown);
    this.pages[this.front].element.classList.remove(classes.shown);
    this.front = back;
  }

  /** Rewrites the lines on screen in place, without a dissolve; nothing shown stays empty. */
  replaceLines(lines: readonly string[]): void {
    if (this.current === null) return;
    this.current = {...this.current, lines};
    const front = this.pages[this.front];
    writeLines(front.block, lines);
    this.fit(front);
  }

  /** Applies a changed text style in place, without replacing pages or dissolving. */
  setStyle(style: LyricStyle): void {
    if (STYLE_FIELDS.every(key => this.style[key] === style[key])) return;
    this.style = style;
    this.element.classList.add(classes.instant);
    this.element.classList.toggle(classes.shadow, effects(style).shadow.on);
    this.element.classList.toggle(classes.outline, effects(style).outline.on);
    for (const page of this.pages) applyStyle(page, style);
    this.rescale(this.scale);
  }

  /** Lays the 장 out again at a new screen scale, without a dissolve. */
  rescale(scale: number): void {
    this.scale = scale;
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

  dispose(): void {
    this.element.remove();
  }

  private clearAtOnce(): void {
    this.element.classList.add(classes.instant);
    for (const page of this.pages) page.element.classList.remove(classes.shown);
  }

  private fit({element, block}: Page): void {
    const size = this.style.size * this.scale;
    const fontSize = fitTextInFrame(
      {
        size,
        width: element.clientWidth,
        height: element.clientHeight,
        maxLines: this.style.maxLines,
        lineHeight: this.style.lineHeight,
      },
      px => {
        block.style.fontSize = `${px}px`;
        return {width: block.scrollWidth, height: block.scrollHeight};
      },
    );
    block.style.fontSize = `${fontSize}px`;
  }
}
