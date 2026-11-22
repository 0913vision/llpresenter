import {useState} from 'react';
import {
  editFrameValue,
  frameWithinBounds,
  type ElementFrame,
  type FrameFieldChange,
} from '@core/canvas';
import type {MediaId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import {
  THEME_CANVAS,
  type OwnThemeScreen,
  type ThemeElement,
  type ThemeFile,
} from '@core/schema/theme';
import {
  addBox,
  changeElement,
  newElement,
  removeElements,
  type AddableKind,
  drawnFrame,
  moveElement,
  type ThemePlacement,
  ownScreenOf,
  withScreen,
} from '@core/theme';
import type {ThemeSelection} from './useThemeSelection';
import type {ThemeWrites} from './useThemeWrites';

export const themeCanvasBounds = {...THEME_CANVAS, minimumSize: 10};

export interface ThemeAddPlacement {
  readonly index?: number;
  readonly point?: {readonly x: number; readonly y: number};
}

interface ThemeTarget {
  readonly theme: ThemeFile;
  readonly screen: Screen;
  readonly screens: readonly Screen[];
}

/** Edits the elements of the screen that is open. */
export function useThemeElements(
  context: {
    readonly target: ThemeTarget | undefined;
    readonly layout: OwnThemeScreen | null;
    readonly placement: ThemePlacement;
    readonly elementReason: string | undefined;
  },
  writes: Pick<ThemeWrites, 'edit' | 'report'>,
  selection: ThemeSelection,
) {
  const {target, layout, placement, elementReason} = context;
  const {selectedIds, select, selectMany, guardSelection} = selection;
  const [imageRequest, setImageRequest] = useState<{
    readonly options: ThemeAddPlacement;
    readonly unchanged: () => boolean;
  } | null>(null);

  /** Changes the layout of the open screen; undefined refuses the change. */
  const elements = (
    change: (screen: OwnThemeScreen) => OwnThemeScreen | undefined,
  ): boolean => {
    if (target === undefined || elementReason !== undefined) return false;
    const {screen, screens} = target;
    return writes.edit(target.theme.id, theme => {
      if (layout === null) return undefined;
      const current = currentLayout(theme, target) ?? layout;
      const changed = change(current);
      return changed === undefined
        ? undefined
        : withScreen(theme, screen, {layout: changed, screens});
    });
  };

  const property = (
    id: string,
    change: (element: ThemeElement) => ThemeElement,
  ): boolean => elements(current => changeElement(current, id, change));

  const frameOf = (id: string): ElementFrame | undefined => {
    const element = layout?.elements.find(entry => entry.id === id);
    return element === undefined || layout === null
      ? undefined
      : drawnFrame(layout, element, placement);
  };

  const frames = (
    moved: ReadonlyArray<{readonly id: string; readonly frame: ElementFrame}>,
    completed?: (saved: boolean) => void,
  ): void => {
    const saved = elements(current => framesMoved(current, moved, placement));
    completed?.(saved);
  };

  const frame = (
    id: string,
    value: ElementFrame,
    completed?: (saved: boolean) => void,
  ): void =>
    frames(
      [{id, frame: frameWithinBounds(value, themeCanvasBounds)}],
      completed,
    );

  const frameValue = (
    id: string,
    value: FrameFieldChange,
    completed?: (frame: ElementFrame | null) => void,
  ): void => {
    const from = frameOf(id);
    if (from === undefined) {
      completed?.(null);
      return;
    }
    const bounds =
      value.field === 'w' || value.field === 'h'
        ? {
            ...themeCanvasBounds,
            width: themeCanvasBounds.width - from.x,
            height: themeCanvasBounds.height - from.y,
          }
        : themeCanvasBounds;
    const to = frameWithinBounds(
      editFrameValue(
        from,
        {...value, keepRatio: value.keepRatio ?? selection.keepRatio},
        bounds,
      ),
      themeCanvasBounds,
    );
    frame(id, to, saved => completed?.(saved ? to : null));
  };

  const add = (
    kind: AddableKind,
    {
      index,
      point,
      media,
    }: ThemeAddPlacement & {readonly media?: MediaId | undefined} = {},
  ): void => {
    if (target === undefined || layout === null) return;
    const {screen, screens} = target;
    let added: ThemeElement | undefined;
    const saved = writes.edit(target.theme.id, theme => {
      const boxed = kind === 'box' ? addBox(theme) : {theme, box: undefined};
      if (boxed === null) return undefined;
      added = newElement(kind, {point, box: boxed.box?.name, media});
      if (added === undefined) return undefined;
      const current = currentLayout(theme, target) ?? layout;
      const at = index ?? current.elements.length;
      return withScreen(boxed.theme, screen, {
        layout: {
          ...current,
          elements: [
            ...current.elements.slice(0, at),
            added,
            ...current.elements.slice(at),
          ],
        },
        screens,
      });
    });
    if (saved && added !== undefined) {
      select(added.id);
      selection.focus(added.id);
    }
  };

  return {
    imageRequest,
    cancelImage: () => setImageRequest(null),
    confirmImage: (media: MediaId) => {
      if (imageRequest?.unchanged()) {
        add('picture', {...imageRequest.options, media});
      }
      setImageRequest(null);
    },
    requestAdd: (kind: AddableKind, options: ThemeAddPlacement = {}) => {
      if (elementReason !== undefined) return;
      if (kind === 'picture') {
        setImageRequest({options, unchanged: guardSelection()});
      } else add(kind, options);
    },
    elements,
    property,
    frameOf,
    frames,
    frame,
    frameValue,
    nudge: (id: string, delta: {readonly x: number; readonly y: number}) => {
      const from = frameOf(id);
      if (from === undefined) return;
      frame(id, {...from, x: from.x + delta.x, y: from.y + delta.y});
    },
    remove: (ids: readonly string[]) => {
      const removed = new Set(ids);
      if (!elements(current => removeElements(current, removed))) return;
      const remaining = selectedIds.filter(id => !removed.has(id));
      if (remaining.length !== selectedIds.length) selectMany(remaining);
      selection.focus(remaining.length === 1 ? (remaining[0] ?? null) : null);
    },
  };
}

/** The layout of the open screen in a newer state of the theme. */
function currentLayout(
  theme: ThemeFile,
  {screen, screens}: ThemeTarget,
): OwnThemeScreen | null {
  const own = ownScreenOf(theme, screen, screens);
  return own.mode === 'own' ? own : null;
}

/** A layout with elements where they were dragged to. */
export function framesMoved(
  layout: OwnThemeScreen,
  moved: ReadonlyArray<{readonly id: string; readonly frame: ElementFrame}>,
  placement: ThemePlacement,
): OwnThemeScreen | undefined {
  let changed: OwnThemeScreen | undefined = layout;
  for (const {id, frame: to} of moved) {
    const element = layout.elements.find(entry => entry.id === id);
    if (element === undefined || changed === undefined) return undefined;
    changed = moveElement(changed, id, {
      from: drawnFrame(layout, element, placement),
      to,
    });
  }
  return changed;
}
