import {deleteSelection} from '@renderer/ui/deleteSelection';
import {selectionLabel} from '@renderer/ui/selectionDrag';
import {useEffect, useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {ElementFrame} from '@core/canvas';
import {restackElements, type StackingStep, drawnFrame} from '@core/theme';
import {SlidePicture} from '@renderer/pictures/SlidePicture';
import {CanvasEditor} from '@renderer/ui/CanvasEditor';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {
  contextMenuAnchor,
  isContextMenuKey,
  type ContextMenuEvent,
} from '@renderer/ui/contextMenu';
import {
  ThemeElements,
  droppedThemeKind,
  THEME_TILE_DRAG,
} from './ThemeElements';
import {ThemeList} from './ThemeList';
import {ThemeImageDialog} from './ThemeImageDialog';
import {ThemeSaveBar} from './ThemeSaveBar';
import {ThemeSaveDialogs} from './ThemeSaveDialogs';
import {elementName} from './themeNames';
import {useThemeClipboard, type ThemeEditorEvents} from './useThemeClipboard';
import {themeCanvasBounds, type ThemeModel} from './useThemeEditor';
import {framesMoved} from './useThemeElements';
import styles from './Themes.module.css';
import {fixedKeyText} from '@renderer/ui/fixedKeys';

export function useThemeSurfaces(
  model: ThemeModel,
  liveId: string | undefined,
) {
  const [menu, setMenu] = useState<{
    id: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const current = useRef(model);
  useLayoutEffect(() => {
    current.current = model;
  });
  const requestDelete = (ids: readonly string[]): void => {
    if (model.elementReason !== undefined) return;
    const {target} = model;
    deleteSelection(
      ids.length,
      () =>
        current.current.target?.theme.id === target?.theme.id &&
        current.current.target?.screen.id === target?.screen.id &&
        current.current.elementReason === undefined,
      () => model.remove(ids),
    );
  };
  const surfaceModel = {...model, remove: requestDelete};
  const clipboard = useThemeClipboard(surfaceModel);
  const onMenu = (id: string | null, anchor: MenuAnchor): void => {
    if (id !== null && !model.selectedIds.includes(id)) model.select(id);
    const selected =
      id !== null && model.selectedIds.includes(id)
        ? model.selectedIds
        : id === null
          ? []
          : [id];
    const target = anchor.target;
    const canvas = target?.closest('[data-canvas]');
    const list = target?.closest('[role="listbox"]');
    const targets = canvas
      ? [
          ...canvas.querySelectorAll<HTMLElement>('[data-canvas-element]'),
        ].filter(row => selected.includes(row.dataset.canvasElement ?? ''))
      : list
        ? [...list.querySelectorAll<HTMLElement>('[data-value]')].filter(row =>
            selected.includes(row.dataset.value ?? ''),
          )
        : undefined;
    setMenu({
      id,
      anchor: targets === undefined ? anchor : {...anchor, targets},
    });
  };
  const ids = new Set(model.selectedIds);
  const reorder = (step: StackingStep): void => {
    model.elements(screen => restackElements(screen, ids, step));
  };
  const entries: readonly MenuEntry[] = [
    ...(
      [
        {id: 'front', label: '맨 앞으로 가져오기'},
        {id: 'forward', label: '앞으로 가져오기'},
        {id: 'backward', label: '뒤로 보내기'},
        {id: 'back', label: '맨 뒤로 보내기'},
      ] as const
    ).map(
      action =>
        ({
          kind: 'item',
          id: action.id,
          label: selectionLabel(action.label, ids.size),
          ...menuAvailability(
            model.elementReason ??
              (ids.size === 0 ? '선택한 요소 없음' : undefined),
          ),
          onSelect: () => reorder(action.id),
        }) as const,
    ),
    {kind: 'separator', id: 'clipboard'},
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: selectionLabel('복사', ids.size),
      meta: fixedKeyText('copy'),
      ...menuAvailability(
        model.selectedIds.length === 0 ? '선택한 요소 없음' : undefined,
      ),
      onSelect: clipboard.copy,
    },
    {
      kind: 'item',
      id: 'paste',
      contextGroup: 'clipboard',
      label: '붙여넣기',
      meta: fixedKeyText('paste'),
      ...menuAvailability(model.elementReason),
      onSelect: clipboard.paste,
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: selectionLabel('삭제', ids.size),
      command: 'edit.delete',
      ...menuAvailability(
        model.elementReason ??
          (model.selectedIds.length === 0 ? '선택한 요소 없음' : undefined),
      ),
      onSelect: () => requestDelete(model.selectedIds),
    },
  ];
  return {
    left: (
      <div className={styles.left}>
        <ThemeList model={model} liveId={liveId} />
        <ThemeElements
          model={surfaceModel}
          onMenu={onMenu}
          editorEvents={clipboard.events}
        />
        {model.imageRequest === null ? null : (
          <ThemeImageDialog model={model} />
        )}
        <ThemeSaveDialogs model={model} />
        {menu === null ? null : (
          <Menu
            context
            label="요소"
            entries={entries}
            anchor={menu.anchor}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    ),
    canvas: (
      <ThemeCanvas
        model={surfaceModel}
        editorEvents={clipboard.events}
        onMenu={onMenu}
      />
    ),
  };
}

function ThemeCanvas({
  model,
  editorEvents,
  onMenu,
}: {
  readonly model: ThemeModel;
  readonly editorEvents: ThemeEditorEvents;
  readonly onMenu: (id: string | null, anchor: MenuAnchor) => void;
}): JSX.Element | null {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const request = model.focusRequest;
    if (request === null) return;
    const selector =
      request.id === null
        ? '[data-canvas]'
        : `[data-canvas-element="${request.id}"] > button`;
    host.current
      ?.querySelector<HTMLElement>(selector)
      ?.focus({preventScroll: true});
  }, [model.focusRequest]);
  const {theme, screen, layout, drawing, placement} = model;
  if (theme === undefined || screen === undefined || drawing === null) {
    return null;
  }
  const elements =
    layout === null
      ? []
      : layout.elements.map(element => ({
          id: element.id,
          name: elementName(element),
          frame: drawnFrame(layout, element, placement),
        }));
  const follows = new Set<string>(
    (layout?.elements ?? []).flatMap(element =>
      element.kind === 'shape' &&
      (element.around !== undefined || element.beside !== undefined)
        ? [element.id]
        : [],
    ),
  );
  const openContext = (event: ContextMenuEvent): void => {
    event.preventDefault();
    const id =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-canvas-element]')?.dataset[
            'canvasElement'
          ]
        : undefined;
    onMenu(id ?? null, contextMenuAnchor(event));
  };
  return (
    <div
      ref={host}
      className={styles.canvas}
      {...editorEvents}
      onContextMenu={openContext}
      onKeyDown={event => {
        if (isContextMenuKey(event)) openContext(event);
      }}
      onDragOver={event => {
        if (
          model.elementReason === undefined &&
          event.dataTransfer.types.includes(THEME_TILE_DRAG)
        ) {
          event.preventDefault();
        }
      }}
      onDrop={event => {
        const surface =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-canvas]')
            : null;
        if (surface === null || model.elementReason !== undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const kind = droppedThemeKind(event);
        const bounds = surface.getBoundingClientRect();
        if (kind !== undefined && bounds.width > 0 && bounds.height > 0) {
          model.requestAdd(kind, {
            point: {
              x:
                ((event.clientX - bounds.left) * themeCanvasBounds.width) /
                bounds.width,
              y:
                ((event.clientY - bounds.top) * themeCanvasBounds.height) /
                bounds.height,
            },
          });
        }
      }}
    >
      <ThemeSaveBar model={model} />
      <CanvasEditor
        key={`${theme.id}:${screen.id}`}
        value={{...themeCanvasBounds, contained: true, elements}}
        hitPriority={Object.fromEntries(
          elements.map((element, index) => [
            element.id,
            follows.has(element.id) ? 0 : index + 1,
          ]),
        )}
        label="테마"
        selected={
          model.selectedIds.length === 1 ? (model.selectedIds[0] ?? null) : null
        }
        selectedIds={model.selectedIds}
        onSelect={model.select}
        readOnlyReason={model.elementReason}
        footer="zoom"
        keepRatio={model.keepRatio}
        setKeepRatio={model.setKeepRatio}
        snapGrid={model.snapGrid}
        setSnapGrid={model.setSnapGrid}
        getElementLabel={element => element.name}
        renderContent={values => {
          const moved =
            layout === null
              ? undefined
              : framesMoved(
                  layout,
                  values.filter((value, index) => {
                    const before = elements[index]?.frame;
                    return (
                      before === undefined || !sameFrame(value.frame, before)
                    );
                  }),
                  placement,
                );
          return (
            <SlidePicture
              {...drawing}
              drawing={
                drawing.drawing === null || moved === undefined
                  ? drawing.drawing
                  : {...drawing.drawing, screen: moved}
              }
            />
          );
        }}
        actions={{
          frames: model.frames,
          frame: model.frame,
          frameValue: model.frameValue,
          nudge: model.nudge,
          remove: id => model.remove([id]),
        }}
      />
    </div>
  );
}

function sameFrame(a: ElementFrame, b: ElementFrame): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
