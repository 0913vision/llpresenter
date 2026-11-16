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
import {
  changeThemeElement,
  editThemeElements,
  hasThemeText,
} from '@core/themes/elementEdits';
import {newThemeElement} from '@core/themes/newElement';
import {editThemeLayout, type ThemeTarget} from '@core/themes/themeEdits';
import {sameJson} from '@core/common/sameJson';
import {checkPart} from '@core/schema/fileFormat';
import {themeElementSchema} from '@core/schema/themes';
import {
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
  BROADCAST_LOOK_SONG_TITLE_ID,
} from '@core/themes/broadcastLook';
import {
  BROADCAST_TEXT_ID,
  BROADCAST_REFERENCE_ID,
} from '@core/themes/broadcastBand';
import type {ThemeWrites} from './useThemeWrites';
import type {ThemeSelection} from './useThemeSelection';

const fittedIds: ReadonlySet<string> = new Set([
  BROADCAST_LOOK_BAND_ID,
  BROADCAST_LOOK_TAB_ID,
  BROADCAST_LOOK_SONG_ID,
  BROADCAST_LOOK_SONG_TITLE_ID,
  BROADCAST_TEXT_ID,
  BROADCAST_REFERENCE_ID,
]);

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
  context: {
    target: ThemeTarget | undefined;
    elementReason: string | undefined;
    fittedBroadcast: boolean;
    visibleElements: readonly ThemeElement[];
  },
  writes: ThemeWrites,
  selection: ThemeSelection,
) {
  const {target, elementReason, fittedBroadcast, visibleElements} = context;
  const {edit, report} = writes;
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
    edit(
      target.theme,
      value =>
        fittedBroadcast
          ? editThemeLayout(value, target, layout => {
              if (layout.mode.kind !== 'own') return undefined;
              const next = transform(layout.elements);
              if (!next) return undefined;
              const ids = new Set<string>(next.map(element => element.id));
              ids.add(BROADCAST_LOOK_SONG_TITLE_ID);
              const broadcastEdits =
                layout.broadcastEdits === undefined
                  ? undefined
                  : Object.fromEntries(
                      Object.entries(layout.broadcastEdits).filter(([id]) =>
                        ids.has(id),
                      ),
                    );
              return {
                ...layout,
                elements: next,
                ...(broadcastEdits === undefined ? {} : {broadcastEdits}),
              };
            })
          : editThemeElements(value, target, transform),
      completed,
    );
  };

  const property = (
    id: string,
    transform: (element: ThemeElement) => unknown,
    completed?: (saved: boolean) => void,
  ): void => {
    if (!fittedBroadcast || !fittedIds.has(id) || target === undefined) {
      elements(values => changeThemeElement(values, id, transform), completed);
      return;
    }
    const before = visibleElements.find(element => element.id === id);
    if (!before) return;
    const parsed = checkPart(themeElementSchema, transform(before));
    if (
      !parsed.ok ||
      parsed.value.id !== before.id ||
      parsed.value.kind !== before.kind
    ) {
      return;
    }
    const after = parsed.value;
    edit(
      target.theme,
      file =>
        editThemeLayout(file, target, layout => {
          const previous = layout.broadcastEdits?.[before.id];
          const patch = {
            ...previous,
            ...(!sameJson(before.frame, after.frame)
              ? {frame: after.frame}
              : {}),
            ...('text' in before &&
            'text' in after &&
            !sameJson(before.text, after.text)
              ? {text: after.text}
              : {}),
            ...((before.kind === 'box' || hasThemeText(before)) &&
            (after.kind === 'box' || hasThemeText(after)) &&
            after.box !== undefined &&
            !sameJson(before.box, after.box)
              ? {box: after.box}
              : {}),
          };
          return {
            ...layout,
            broadcastEdits: {...layout.broadcastEdits, [before.id]: patch},
          };
        }),
      completed,
    );
  };

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
      report('이미지를 골라야 추가할 수 있습니다');
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
    fittedBroadcast,
    frames: (
      frames: ReadonlyArray<{id: string; frame: ElementFrame}>,
      completed?: (saved: boolean) => void,
    ) => {
      if (!fittedBroadcast) {
        elements(
          values =>
            values.map(element => {
              const next = frames.find(row => row.id === element.id);
              return next ? {...element, frame: next.frame} : element;
            }),
          completed,
        );
        return;
      }
      if (!target) return;
      edit(
        target.theme,
        file =>
          editThemeLayout(file, target, layout => {
            const broadcastEdits = {...layout.broadcastEdits};
            for (const row of frames) {
              const element = visibleElements.find(
                value => value.id === row.id,
              );
              if (element && fittedIds.has(row.id)) {
                broadcastEdits[element.id] = {
                  ...broadcastEdits[element.id],
                  frame: frameWithinBounds(row.frame, themeCanvasBounds),
                };
              }
            }
            const elements = layout.elements.map(element => {
              const row = frames.find(
                value => value.id === element.id && !fittedIds.has(value.id),
              );
              return row
                ? {
                    ...element,
                    frame: frameWithinBounds(row.frame, themeCanvasBounds),
                  }
                : element;
            });
            return {...layout, elements, broadcastEdits};
          }),
        completed,
      );
    },
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
      if (fittedBroadcast && ids.includes(BROADCAST_LOOK_SONG_TITLE_ID)) {
        report(
          '\uace1 \uc81c\ubaa9\uc740 \uc0ad\uc81c\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4',
        );
        return;
      }
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
