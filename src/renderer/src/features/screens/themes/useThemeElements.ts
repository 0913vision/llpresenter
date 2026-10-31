import {useState} from 'react';
import {createThemeElementId, type MediaId} from '@core/schema/ids';
import type {ThemeElement} from '@core/schema/themes';
import {
  editFrameValue,
  frameWithinBounds,
  type ElementFrame,
  type FrameFieldChange,
} from '@core/canvas/frameEdit';
import {THEME_LIMITS, type ThemeElementKind} from '@core/themes/elementRules';
import {changeThemeElement, editThemeElements} from '@core/themes/elementEdits';
import {newThemeElement} from '@core/themes/newElement';
import type {ThemeTarget} from '@core/themes/themeEdits';
import type {ThemeWrites} from './useThemeWrites';
import type {ThemeSelection} from './useThemeSelection';

export const themeCanvasBounds = {
  width: THEME_LIMITS.width,
  height: THEME_LIMITS.height,
  minimumSize: THEME_LIMITS.minimumExtent,
};

export interface ThemeAddPlacement {
  readonly index?: number;
  readonly point?: {readonly x: number; readonly y: number};
}
export function useThemeElements(
  context: {target: ThemeTarget | undefined; elementReason: string | undefined},
  writes: ThemeWrites,
  selection: ThemeSelection,
) {
  const {target, elementReason} = context;
  const {apply, report} = writes;
  const {
    keepRatio,
    selectedIds,
    select,
    selectMany,
    guardSelection,
    guardInteraction,
  } = selection;

  const [imageRequest, setImageRequest] = useState<{
    options: ThemeAddPlacement;
    unchanged: () => boolean;
  } | null>(null);

  const elements = (
    transform: (
      value: readonly ThemeElement[],
    ) => readonly ThemeElement[] | undefined,
    completed?: (saved: boolean) => void,
  ): void => {
    if (target === undefined) return;
    apply(value => editThemeElements(value, target, transform), completed);
  };

  const property = (
    id: string,
    transform: (element: ThemeElement) => unknown,
    completed?: (saved: boolean) => void,
  ): void =>
    elements(values => changeThemeElement(values, id, transform), completed);

  const frame = (
    id: string,
    value: ElementFrame,
    completed?: (saved: boolean) => void,
  ): void =>
    property(
      id,
      element => ({
        ...element,
        frame: frameWithinBounds(value, themeCanvasBounds),
      }),
      completed,
    );

  const frameValue = (
    id: string,
    value: FrameFieldChange,
    completed?: (frame: ElementFrame | null) => void,
  ): void => {
    let result: ElementFrame | null = null;
    property(
      id,
      element => {
        const bounds =
          value.field === 'w' || value.field === 'h'
            ? {
                ...themeCanvasBounds,
                width: themeCanvasBounds.width - element.frame.x,
                height: themeCanvasBounds.height - element.frame.y,
              }
            : themeCanvasBounds;
        result = frameWithinBounds(
          editFrameValue(
            element.frame,
            {...value, keepRatio: value.keepRatio ?? keepRatio},
            bounds,
          ),
          themeCanvasBounds,
        );
        return {...element, frame: result};
      },
      saved => completed?.(saved ? result : null),
    );
  };

  const add = (
    kind: ThemeElementKind,
    options: {
      index?: number;
      point?: {x: number; y: number};
      mediaId?: MediaId;
    } = {},
  ): void => {
    const element = newThemeElement({
      id: createThemeElementId(crypto.randomUUID()),
      kind,
      ...options,
    });
    const unchanged = guardInteraction();
    if (element === undefined) {
      report('그림을 선택해 주세요');
      return;
    }
    elements(
      values => {
        const index = options.index ?? values.length;
        return [...values.slice(0, index), element, ...values.slice(index)];
      },
      saved => {
        if (saved && unchanged()) {
          select(element.id);
          selection.focus(element.id);
        }
      },
    );
  };
  return {
    imageRequest,
    cancelImage: () => setImageRequest(null),
    confirmImage: (mediaId: MediaId) => {
      if (imageRequest?.unchanged()) {
        add('image', {...imageRequest.options, mediaId});
      }
      setImageRequest(null);
    },
    requestAdd: (kind: ThemeElementKind, options: ThemeAddPlacement = {}) => {
      if (elementReason !== undefined) return;
      if (kind === 'image') {
        setImageRequest({options, unchanged: guardSelection()});
      } else add(kind, options);
    },
    elements,
    property,
    frame,
    frameValue,
    nudge: (id: string, delta: {x: number; y: number}) =>
      property(id, element => ({
        ...element,
        frame: frameWithinBounds(
          {
            ...element.frame,
            x: element.frame.x + delta.x,
            y: element.frame.y + delta.y,
          },
          themeCanvasBounds,
        ),
      })),
    add,
    remove: (ids: readonly string[]) => {
      const unchanged = guardInteraction();
      const deletesSelection = selectedIds.some(id => ids.includes(id));
      elements(
        values => values.filter(element => !ids.includes(element.id)),
        saved => {
          if (saved && unchanged()) {
            const remaining = selectedIds.filter(id => !ids.includes(id));
            if (deletesSelection) selectMany(remaining);
            selection.focus(
              remaining.length === 1 ? (remaining[0] ?? null) : null,
            );
          }
        },
      );
    },
  };
}
