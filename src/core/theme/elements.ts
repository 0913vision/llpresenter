import {moveSelection} from '@core/common/selectionOrder';
import {checkPart} from '@core/schema/common/fileFormat';
import {createThemeElementId, type MediaId} from '@core/schema/common/ids';
import {
  THEME_CANVAS,
  THEME_FILE_LIMITS,
  themeClipboardSchema,
  themeElementSchema,
  type OwnThemeScreen,
  type ThemeElement,
  type ThemeElementKind,
  type ThemeSplit,
  type ThemeStack,
  type ThemeTextStyle,
} from '@core/schema/screens/theme';

/** What can be added to a screen; a box is a text with a box of its own. */
export const addableKinds = [
  'box',
  'text',
  'next',
  'picture',
  'shape',
  'background',
] as const;
export type AddableKind = (typeof addableKinds)[number];

/** There is at most one of these on a screen. */
const SINGLE: ReadonlySet<ThemeElementKind> = new Set(['next', 'background']);

const TEXT_SIZE = {w: 800, h: 240} as const;
const FULL_SIZE = {
  w: THEME_CANVAS.width,
  h: THEME_CANVAS.height,
} as const;

const NEW_STYLE: ThemeTextStyle = {
  font: 'NanumSquare',
  weight: 700,
  size: 72,
  color: '#FFFFFF',
  lineHeight: 1.2,
  tracking: 0,
  align: 'center',
  vAlign: 'middle',
};

/** Whether a screen can take one more element of a kind. */
export function canAddElement(
  screen: OwnThemeScreen,
  kind: AddableKind,
): boolean {
  if (screen.elements.length >= THEME_FILE_LIMITS.elements) return false;
  return (
    kind === 'box' ||
    !SINGLE.has(kind) ||
    !screen.elements.some(element => element.kind === kind)
  );
}

/** A new element around a point of the canvas. */
export function newElement(
  kind: AddableKind,
  {
    point = {x: THEME_CANVAS.width / 2, y: THEME_CANVAS.height / 2},
    box,
    media,
  }: {
    readonly point?: {readonly x: number; readonly y: number} | undefined;
    readonly box?: string | undefined;
    readonly media?: MediaId | undefined;
  } = {},
): ThemeElement | undefined {
  const {w, h} = kind === 'background' ? FULL_SIZE : TEXT_SIZE;
  const base = {
    id: createThemeElementId(crypto.randomUUID()),
    frame: {
      x: Math.max(0, Math.min(THEME_CANVAS.width - w, point.x - w / 2)),
      y: Math.max(0, Math.min(THEME_CANVAS.height - h, point.y - h / 2)),
      w,
      h,
    },
  };
  switch (kind) {
    case 'box':
    case 'text':
      return {
        ...base,
        kind: 'text',
        content: [box === undefined ? '글' : `{${box}}`],
        style: NEW_STYLE,
      };
    case 'next':
      return {...base, kind, style: NEW_STYLE};
    case 'picture':
      return media === undefined
        ? undefined
        : {...base, kind, media, fit: 'fit'};
    case 'shape':
      return {...base, kind, fill: {color: '#FFFFFF', opacity: 100}};
    case 'background':
      return {...base, kind, fit: 'fill'};
  }
}

function without(
  ids: ReadonlyArray<ThemeElement['id']>,
  removed: ReadonlySet<string>,
): Array<ThemeElement['id']> {
  return ids.filter(id => !removed.has(id));
}

function stackWithout(
  stack: ThemeStack,
  removed: ReadonlySet<string>,
): ThemeStack | undefined {
  const texts = without(stack.texts, removed);
  return texts.length === 0 ? undefined : {...stack, texts};
}

function splitWithout(
  split: ThemeSplit,
  removed: ReadonlySet<string>,
): ThemeSplit | undefined {
  const upper = without(split.upper, removed);
  return upper.length === 0 || removed.has(split.lower)
    ? undefined
    : {...split, upper};
}

function elementWithout(
  element: ThemeElement,
  removed: ReadonlySet<string>,
): ThemeElement {
  if (element.kind === 'next') {
    if (element.of === undefined || !removed.has(element.of)) return element;
    const {of: _of, ratio: _ratio, ...free} = element;
    return free;
  }
  if (element.kind !== 'shape') return element;
  const {around, beside, ...plain} = element;
  const texts = without((around ?? beside)?.texts ?? [], removed);
  if (texts.length === 0) return plain;
  return {
    ...plain,
    ...(around === undefined ? {} : {around: {...around, texts}}),
    ...(beside === undefined ? {} : {beside: {...beside, texts}}),
  };
}

/** Takes elements away, with what other elements say about them. */
export function removeElements(
  screen: OwnThemeScreen,
  removed: ReadonlySet<string>,
): OwnThemeScreen {
  if (removed.size === 0) return screen;
  const {stacks, splits, ...rest} = screen;
  const keptStacks = (stacks ?? []).flatMap(
    stack => stackWithout(stack, removed) ?? [],
  );
  const keptSplits = (splits ?? []).flatMap(
    split => splitWithout(split, removed) ?? [],
  );
  return {
    ...rest,
    elements: screen.elements
      .filter(element => !removed.has(element.id))
      .map(element => elementWithout(element, removed)),
    ...(keptStacks.length === 0 ? {} : {stacks: keptStacks}),
    ...(keptSplits.length === 0 ? {} : {splits: keptSplits}),
  };
}

/** Changes one element; undefined when the result is not an element. */
export function changeElement(
  screen: OwnThemeScreen,
  id: string,
  change: (element: ThemeElement) => ThemeElement,
): OwnThemeScreen | undefined {
  const element = screen.elements.find(entry => entry.id === id);
  if (element === undefined) return undefined;
  const checked = checkPart(themeElementSchema, change(element));
  if (!checked.ok) return undefined;
  return {
    ...screen,
    elements: screen.elements.map(entry =>
      entry.id === id ? checked.value : entry,
    ),
  };
}

/** Moves elements to another place in the stacking order. */
export function moveElements(
  screen: OwnThemeScreen,
  ids: ReadonlySet<string>,
  boundary: number,
): OwnThemeScreen {
  return {
    ...screen,
    elements: [...moveSelection(screen.elements, ids, boundary)],
  };
}

export type StackingStep = 'front' | 'forward' | 'backward' | 'back';

/** Brings elements to the front or the back together, or by one place. */
export function restackElements(
  screen: OwnThemeScreen,
  ids: ReadonlySet<string>,
  step: StackingStep,
): OwnThemeScreen {
  if (step === 'front' || step === 'back') {
    return moveElements(
      screen,
      ids,
      step === 'front' ? screen.elements.length : 0,
    );
  }
  const elements = [...screen.elements];
  const by = step === 'forward' ? -1 : 1;
  for (
    let index = by === -1 ? elements.length - 2 : 1;
    index >= 0 && index < elements.length;
    index += by
  ) {
    const element = elements[index];
    const neighbor = elements[index - by];
    if (
      element !== undefined &&
      neighbor !== undefined &&
      ids.has(element.id) &&
      !ids.has(neighbor.id)
    ) {
      elements[index] = neighbor;
      elements[index - by] = element;
    }
  }
  return {...screen, elements};
}

const CLIPBOARD_LIMIT = 1_000_000;

export function serializeElements(elements: readonly ThemeElement[]): string {
  return JSON.stringify({format: 'llp.theme-elements', elements});
}

export function parseElements(text: string): readonly ThemeElement[] | null {
  if (text.length > CLIPBOARD_LIMIT) return null;
  try {
    const checked = checkPart(themeClipboardSchema, JSON.parse(text));
    return checked.ok ? checked.value.elements : null;
  } catch {
    return null;
  }
}

/** Adds copied elements, with ids of their own that they name each other by. */
export function pasteElements(
  screen: OwnThemeScreen,
  copied: readonly ThemeElement[],
): {
  readonly screen: OwnThemeScreen;
  readonly ids: ReadonlyArray<ThemeElement['id']>;
} | null {
  const added = copied.filter(
    element =>
      !SINGLE.has(element.kind) ||
      !screen.elements.some(entry => entry.kind === element.kind),
  );
  if (
    added.length === 0 ||
    screen.elements.length + added.length > THEME_FILE_LIMITS.elements
  ) {
    return null;
  }
  const missing = new Set<string>();
  for (const element of added) {
    const named =
      element.kind === 'shape'
        ? (element.around ?? element.beside)?.texts
        : element.kind === 'next' && element.of !== undefined
          ? [element.of]
          : undefined;
    for (const id of named ?? []) {
      if (!added.some(entry => entry.id === id)) missing.add(id);
    }
  }
  const ids = new Map(
    added.map(element => [
      element.id,
      createThemeElementId(crypto.randomUUID()),
    ]),
  );
  const own = (id: ThemeElement['id']): ThemeElement['id'] => ids.get(id) ?? id;
  const pasted = added
    .map(element => elementWithout(element, missing))
    .map((element): ThemeElement => {
      const id = own(element.id);
      if (element.kind === 'next') {
        return {
          ...element,
          id,
          ...(element.of === undefined ? {} : {of: own(element.of)}),
        };
      }
      if (element.kind !== 'shape') return {...element, id};
      const {around, beside} = element;
      return {
        ...element,
        id,
        ...(around === undefined
          ? {}
          : {around: {...around, texts: around.texts.map(own)}}),
        ...(beside === undefined
          ? {}
          : {beside: {...beside, texts: beside.texts.map(own)}}),
      };
    });
  return {
    screen: {...screen, elements: [...screen.elements, ...pasted]},
    ids: pasted.map(({id}) => id),
  };
}
