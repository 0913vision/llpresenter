import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';
import {selectionLabel} from '@renderer/ui/selectionDrag';
import type {Notice} from '@renderer/ui/notices';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {ElementFrame} from '@core/canvas/frameEdit';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {resolveThemeScreen} from '@core/themes/resolve';
import {reorderThemeSelection} from '@core/themes/elementEdits';
import {CanvasEditor} from '@renderer/ui/CanvasEditor';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {SECTION_BAND_ID} from '@core/themes/sectionBroadcast';
import {
  ThemeElements,
  droppedThemeKind,
  THEME_TILE_DRAG,
} from './ThemeElements';
import {ThemeList} from './ThemeList';
import {ThemeImageDialog} from './ThemeImageDialog';
import {ThemeSaveBar} from './ThemeSaveBar';
import {ThemeSaveDialogs} from './ThemeSaveDialogs';
import {themeElementNames} from './themeNames';
import {useThemeClipboard} from './useThemeClipboard';
import {themeCanvasBounds, type ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function useThemeSurfaces(
  model: ThemeModel,
  liveId: string | undefined,
  report: ((notice: Notice) => void) | undefined,
) {
  const [menu, setMenu] = useState<{
    id: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const deletion = useSelectionDelete(notice => report?.(notice));
  const current = useRef(model);
  useLayoutEffect(() => {
    current.current = model;
  });
  const requestDelete = (ids: readonly string[]): void => {
    if (model.elementReason !== undefined) return;
    const file = model.file;
    const target = model.target;
    deletion.ask(
      ids.length,
      () =>
        current.current.file === file &&
        current.current.target?.theme === target?.theme &&
        current.current.target?.screen.id === target?.screen.id &&
        current.current.elementReason === undefined,
      () => model.remove(ids),
    );
  };
  const surfaceModel = {...model, remove: requestDelete};
  const clipboard = useThemeClipboard(surfaceModel);
  const onMenu = (id: string | null, anchor: MenuAnchor): void => {
    if (id !== null && !model.selectedIds.includes(id)) model.select(id);
    setMenu({id, anchor});
  };
  const ids = new Set(model.selectedIds);
  const reorder = (
    direction: 'front' | 'forward' | 'backward' | 'back',
  ): void => {
    model.elements(values => reorderThemeSelection(values, ids, direction));
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
      meta: 'Ctrl C',
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
      meta: 'Ctrl V',
      ...menuAvailability(model.elementReason),
      onSelect: clipboard.paste,
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: selectionLabel('삭제', ids.size),
      meta: 'Delete',
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
        {deletion.dialog}
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

export const themeSamples = {
  ...themeElementNames,
  currentText: '함께 노래합니다\n오늘도 빛을 비춥니다',
  nextText: '다음 이야기를 기다립니다',
  clock: '09:41',
  timer: '05:00',
  videoTimeLeft: '02:30',
  reference: '요한복음 1:1',
  slideNumber: '1',
  label: '1절',
  nextLabel: '후렴',
};
const sectionBandSamples = {
  ...themeSamples,
  itemName: '사도신경',
};

function ThemeCanvas({
  model,
  editorEvents,
  onMenu,
}: {
  readonly model: ThemeModel;
  readonly editorEvents: import('./useThemeClipboard').ThemeEditorEvents;
  readonly onMenu: (id: string | null, anchor: MenuAnchor) => void;
}): JSX.Element | null {
  const host = useRef<HTMLDivElement>(null);
  const context = `${model.theme?.id}:${model.screen?.id}`;
  const [measuredFrames, setMeasuredFrames] = useState<{
    context: string;
    frames: Readonly<Record<string, ElementFrame>>;
  } | null>(null);
  const receiveFrames = useCallback(
    (frames: Readonly<Record<string, ElementFrame>>) => {
      setMeasuredFrames(previous => {
        const keys = Object.keys(frames);
        if (
          previous?.context === context &&
          keys.length === Object.keys(previous.frames).length &&
          keys.every(id => {
            const before = previous.frames[id];
            const after = frames[id];
            return (
              before?.x === after?.x &&
              before?.y === after?.y &&
              before?.w === after?.w &&
              before?.h === after?.h
            );
          })
        ) {
          return previous;
        }
        return {context, frames};
      });
    },
    [context],
  );
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
  if (model.theme === undefined || model.screen === undefined) return null;
  const resolved = resolveThemeScreen(
    model.theme,
    model.screen.id,
    model.screens,
  );
  const source =
    model.screens.find(screen => screen.id === resolved.sourceScreenId) ??
    model.screen;
  const background =
    resolved.layout.mode.kind === 'own'
      ? (resolved.layout.background ?? emptyScreenColor(source))
      : emptyScreenColor(source);
  const elements = resolved.layout.elements.map(element => ({
    ...element,
    name: themeElementNames[element.kind],
  }));
  const openContext = (
    event: import('@renderer/ui/contextMenu').ContextMenuEvent,
  ): void => {
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
        key={`${model.theme.id}:${model.screen.id}`}
        value={{...themeCanvasBounds, contained: true, elements}}
        hitPriority={Object.fromEntries(
          elements.flatMap(element =>
            element.kind === 'box' && element.follow !== undefined
              ? [[element.id, 1]]
              : [],
          ),
        )}
        resolvedFrames={
          measuredFrames?.context === context
            ? measuredFrames.frames
            : undefined
        }
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
        renderContent={values => (
          <ThemePicture
            elements={values}
            background={background}
            samples={
              values.some(element => element.id === SECTION_BAND_ID)
                ? sectionBandSamples
                : themeSamples
            }
            timers={model.renderTimers}
            onResolvedFrames={receiveFrames}
          />
        )}
        actions={{
          frames: (frames, completed) =>
            model.elements(
              values =>
                values.map(element => {
                  const next = frames.find(row => row.id === element.id);
                  return next === undefined
                    ? element
                    : {...element, frame: next.frame};
                }),
              completed,
            ),
          frame: model.frame,
          frameValue: model.frameValue,
          nudge: model.nudge,
          remove: id => model.remove([id]),
        }}
      />
    </div>
  );
}
