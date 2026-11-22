import type {
  OwnThemeScreen,
  ThemeElement,
  ThemeNextElement,
  ThemeShape,
  ThemeTextElement,
} from '../schema/theme';

export interface TextMetrics {
  readonly height: number;
  readonly width: number;
}

/** A text of a slide, measured in the frame of its element. */
export interface MeasuredText {
  /** The rows of this text, and of the texts sized together with it. */
  readonly at: (size: number, keepRows: boolean) => TextMetrics;
  readonly together?: (size: number, keepRows: boolean) => TextMetrics;
  /** Where the letters start and end inside the rows. */
  readonly ink?: (size: number) => {
    readonly top: number;
    readonly bottom: number;
  };
}

/** A size, and rows, taken from another screen. */
export interface SameText {
  readonly size: number;
}

export interface TextPlacement {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly size: number;
  /** Rows are kept as typed and never wrap. */
  readonly keepRows: boolean;
}

export interface ShapePlacement {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ThemePlacement {
  readonly texts: ReadonlyMap<string, TextPlacement>;
  readonly shapes: ReadonlyMap<string, ShapePlacement>;
}

type TextElement = ThemeTextElement | ThemeNextElement;

interface Sized {
  readonly element: TextElement;
  readonly text: MeasuredText;
  size: number;
  keepRows: boolean;
}

const MIN_SIZE = 12;
/** Rows may be this much taller than their frame: letters round to pixels. */
const TOLERANCE = 1;
/** The continuous text below this share of a kept size may wrap. */
const SMALLEST_STEP = 1;

function isText(element: ThemeElement): element is TextElement {
  return element.kind === 'text' || element.kind === 'next';
}

function metricsOf(sized: Sized, size: number): TextMetrics {
  const own = sized.text.at(size, sized.keepRows);
  if (sized.element.fit?.together !== true) return own;
  const other = sized.text.together?.(size, sized.keepRows);
  return other === undefined
    ? own
    : {
        height: Math.max(own.height, other.height),
        width: Math.max(own.width, other.width),
      };
}

/** The largest whole size, at most `from` and at least `to`, that fits. */
function shrink(
  from: number,
  to: number,
  fits: (size: number) => boolean,
): number {
  const largest = Math.max(MIN_SIZE, Math.floor(from));
  const smallest = Math.min(largest, Math.max(MIN_SIZE, Math.ceil(to)));
  if (fits(largest)) return largest;
  let fitting = smallest;
  let tooLarge = largest;
  while (tooLarge - fitting > SMALLEST_STEP) {
    const middle = fitting + Math.floor((tooLarge - fitting) / 2);
    if (fits(middle)) fitting = middle;
    else tooLarge = middle;
  }
  return fitting;
}

function rowHeight({element}: Sized, size: number): number {
  return size * element.style.lineHeight;
}

function fitsFrame(sized: Sized, size: number, height: number): boolean {
  const {element} = sized;
  const metrics = metricsOf(sized, size);
  const rows = element.fit?.rows;
  return (
    metrics.width <= element.frame.w + TOLERANCE &&
    metrics.height <= height + TOLERANCE &&
    (rows === undefined ||
      metrics.height <= rows * rowHeight(sized, size) + TOLERANCE)
  );
}

function fitSize(sized: Sized, height: number): void {
  const {element} = sized;
  const {fit, style} = element;
  const steps = fit?.sizes ?? [sized.size];
  const floor = fit?.min ?? MIN_SIZE;
  if (fit?.keepRows === true) {
    sized.keepRows = true;
    const kept = shrink(steps[0] ?? style.size, floor, size =>
      fitsFrame(sized, size, height),
    );
    if (fitsFrame(sized, kept, height)) {
      sized.size = kept;
      return;
    }
    sized.keepRows = false;
  }
  for (const step of steps) {
    if (fitsFrame(sized, step, height)) {
      sized.size = step;
      return;
    }
  }
  sized.size = shrink(steps.at(-1) ?? style.size, floor, size =>
    fitsFrame(sized, size, height),
  );
}

function heightOf(sized: Sized): number {
  const {element, size} = sized;
  if (element.height !== undefined) return element.height;
  const {height} = metricsOf(sized, size);
  return element.rows === undefined
    ? height
    : Math.max(height, element.rows * rowHeight(sized, size));
}

function alignedTop(sized: Sized, top: number, room: number): number {
  const spare = room - heightOf(sized);
  switch (sized.element.style.vAlign) {
    case 'top':
      return top;
    case 'middle':
      return top + spare / 2;
    case 'bottom':
      return top + spare;
  }
}

function placed(sized: Sized, y: number): TextPlacement {
  const {x, w} = sized.element.frame;
  return {
    x,
    y,
    w,
    h: heightOf(sized),
    size: sized.size,
    keepRows: sized.keepRows,
  };
}

/** Keeps the next text in step with the size of the text it stands under. */
function followRatio(sized: Sized, all: ReadonlyMap<string, Sized>): void {
  const {element} = sized;
  if (element.kind !== 'next' || element.ratio === undefined) return;
  const of = element.of === undefined ? undefined : all.get(element.of);
  const size = of === undefined ? element.style.size : of.size * element.ratio;
  sized.size = Math.max(element.fit?.min ?? MIN_SIZE, Math.round(size));
}

/**
 * Where everything on a screen goes. A text at its own place is aligned in its
 * frame; texts of a stack stand one under another; a split puts the next text
 * under the slide's own and gives each the room the other does not need.
 */
export function layoutTheme(
  screen: OwnThemeScreen,
  measured: ReadonlyMap<string, MeasuredText>,
  same: ReadonlyMap<string, SameText> = new Map(),
): ThemePlacement {
  const all = new Map<string, Sized>();
  for (const element of screen.elements) {
    const text = isText(element) ? measured.get(element.id) : undefined;
    if (!isText(element) || text === undefined) continue;
    const taken = same.get(element.id);
    all.set(element.id, {
      element,
      text,
      size: taken?.size ?? element.style.size,
      keepRows:
        taken !== undefined &&
        element.kind === 'text' &&
        element.same === 'rows',
    });
  }
  const texts = new Map<string, TextPlacement>();
  const grouped = new Set<string>();

  for (const split of screen.splits ?? []) {
    const upper = split.upper.flatMap(id => all.get(id) ?? []);
    const lower = all.get(split.lower);
    for (const id of [...split.upper, split.lower]) grouped.add(id);
    const gap = lower === undefined || upper.length === 0 ? 0 : split.gap;
    const room = split.bottom - split.top - gap;
    const between = split.upperGap ?? 0;
    const upperHeight = (): number =>
      upper.reduce((sum, sized) => sum + heightOf(sized), 0) +
      Math.max(0, upper.length - 1) * between;
    const start = upper.map(({size}) => size);
    const resize = (share: number): void => {
      upper.forEach((sized, index) => {
        sized.size = Math.max(
          sized.element.fit?.min ?? MIN_SIZE,
          Math.floor((start[index] ?? sized.size) * share),
        );
      });
      if (lower !== undefined) followRatio(lower, all);
    };
    const fits = (): boolean =>
      upper.every(
        sized =>
          metricsOf(sized, sized.size).width <=
          sized.element.frame.w + TOLERANCE,
      ) &&
      upperHeight() + (lower === undefined ? 0 : heightOf(lower)) <=
        room + TOLERANCE;
    resize(1);
    if (!fits()) {
      const largest = Math.max(1, ...start);
      const size = shrink(largest, MIN_SIZE, candidate => {
        resize(candidate / largest);
        return fits();
      });
      resize(size / largest);
      if (!fits()) {
        for (const sized of upper) {
          if (sized.keepRows) sized.keepRows = false;
        }
        const wrapped = shrink(largest, MIN_SIZE, candidate => {
          resize(candidate / largest);
          return fits();
        });
        resize(wrapped / largest);
      }
    }
    const lowerHeight = lower === undefined ? 0 : heightOf(lower);
    const lowerTop = Math.max(
      split.top + upperHeight() + gap,
      Math.min(split.at, split.bottom - lowerHeight),
    );
    const zone = (lower === undefined ? split.at : lowerTop) - gap - split.top;
    const first = upper[0];
    const spare = Math.max(0, zone - upperHeight());
    let y =
      split.top +
      (first?.element.style.vAlign === 'middle'
        ? spare / 2
        : first?.element.style.vAlign === 'bottom'
          ? spare
          : 0);
    for (const sized of upper) {
      texts.set(sized.element.id, placed(sized, y));
      y += heightOf(sized) + between;
    }
    if (lower !== undefined) {
      texts.set(lower.element.id, placed(lower, lowerTop));
    }
  }

  for (const stack of screen.stacks ?? []) {
    const members = stack.texts.flatMap(id => all.get(id) ?? []);
    for (const id of stack.texts) grouped.add(id);
    for (const sized of members) fitSize(sized, sized.element.frame.h);
    const heights = members.map(heightOf);
    const total =
      heights.reduce((sum, height) => sum + height, 0) +
      Math.max(0, members.length - 1) * stack.gap;
    const first = members[0];
    const last = members.at(-1);
    let before = 0;
    let after = 0;
    if (stack.ink === true && first !== undefined && last !== undefined) {
      before = first.text.ink?.(first.size).top ?? 0;
      const ink = last.text.ink?.(last.size);
      after = ink === undefined ? 0 : heightOf(last) - ink.bottom;
    }
    let y =
      stack.anchor === 'top'
        ? stack.at - before
        : stack.anchor === 'bottom'
          ? stack.at - total + after
          : stack.at - (total - before - after) / 2 - before;
    members.forEach((sized, index) => {
      texts.set(sized.element.id, placed(sized, y));
      y += (heights[index] ?? 0) + stack.gap;
    });
  }

  for (const sized of all.values()) {
    const {element} = sized;
    if (grouped.has(element.id)) continue;
    followRatio(sized, all);
    if (element.kind === 'text' || element.ratio === undefined) {
      fitSize(sized, element.frame.h);
    }
    texts.set(
      element.id,
      placed(sized, alignedTop(sized, element.frame.y, element.frame.h)),
    );
  }

  const shapes = new Map<string, ShapePlacement>();
  for (const element of screen.elements) {
    if (element.kind !== 'shape') continue;
    const shape = placeShape(element, texts);
    if (shape !== undefined) shapes.set(element.id, shape);
  }
  return {texts, shapes};
}

function placeShape(
  shape: ThemeShape,
  texts: ReadonlyMap<string, TextPlacement>,
): ShapePlacement | undefined {
  const {frame, around, beside} = shape;
  const targets = (around ?? beside)?.texts.flatMap(id => texts.get(id) ?? []);
  if (targets === undefined) return frame;
  if (targets.length === 0) return undefined;
  const top = Math.min(...targets.map(target => target.y));
  const bottom = Math.max(...targets.map(target => target.y + target.h));
  if (around !== undefined) {
    const y = top - around.padding.top;
    return {
      x: frame.x,
      y,
      w: frame.w,
      h: bottom + around.padding.bottom - y,
    };
  }
  if (beside === undefined) return frame;
  return {
    x: frame.x,
    y:
      beside.side === 'above'
        ? top - beside.gap - frame.h
        : bottom + beside.gap,
    w: frame.w,
    h: frame.h,
  };
}
