import {useEffect, useRef, useState, type JSX} from 'react';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {resolveThemeScreen} from '@core/themes/resolve';
import {moveThemeElement} from '@core/themes/elementEdits';
import {CanvasEditor} from '@renderer/ui/CanvasEditor';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {
  ThemeElements,
  droppedThemeKind,
  THEME_TILE_DRAG,
} from './ThemeElements';
import {ThemeList} from './ThemeList';
import {ThemeImageDialog} from './ThemeImageDialog';
import {themeElementNames} from './themeNames';
import {useThemeClipboard} from './useThemeClipboard';
import {themeCanvasBounds, type ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function useThemeSurfaces(
  model: ThemeModel,
  liveId: string | undefined,
) {
  const [menu, setMenu] = useState<{
    id: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const clipboard = useThemeClipboard(model);
  const onMenu = (id: string | null, anchor: MenuAnchor): void => {
    if (id !== null && !model.selectedIds.includes(id)) model.select(id);
    setMenu({id, anchor});
  };
  const selected = menu?.id ?? model.selectedIds[0];
  const index = model.visibleElements.findIndex(
    element => element.id === selected,
  );
  const reorder = (position: number): void => {
    if (selected !== undefined) {
      model.elements(values => moveThemeElement(values, selected, position));
    }
  };
  const length = model.visibleElements.length;
  const entries: readonly MenuEntry[] = [
    ...[
      {id: 'front', label: '맨 앞으로 가져오기', position: length - 1},
      {id: 'forward', label: '앞으로 가져오기', position: index + 1},
      {id: 'backward', label: '뒤로 보내기', position: index - 1},
      {id: 'back', label: '맨 뒤로 보내기', position: 0},
    ].map(
      action =>
        ({
          kind: 'item',
          id: action.id,
          label: action.label,
          ...menuAvailability(
            model.elementReason ?? (index < 0 ? '선택한 요소 없음' : undefined),
          ),
          onSelect: () => reorder(action.position),
        }) as const,
    ),
    {kind: 'separator', id: 'clipboard'},
    {
      kind: 'item',
      id: 'copy',
      label: '복사',
      meta: 'Ctrl C',
      ...menuAvailability(
        model.selectedIds.length === 0 ? '선택한 요소 없음' : undefined,
      ),
      onSelect: clipboard.copy,
    },
    {
      kind: 'item',
      id: 'paste',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(model.elementReason),
      onSelect: clipboard.paste,
    },
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      meta: 'Delete',
      ...menuAvailability(
        model.elementReason ??
          (model.selectedIds.length === 0 ? '선택한 요소 없음' : undefined),
      ),
      onSelect: () => model.remove(model.selectedIds),
    },
  ];
  return {
    left: (
      <div className={styles.left}>
        <ThemeList model={model} liveId={liveId} />
        <ThemeElements
          model={model}
          onMenu={onMenu}
          editorEvents={clipboard.events}
        />
        {model.imageRequest === null ? null : (
          <ThemeImageDialog model={model} />
        )}
        {menu === null ? null : (
          <Menu
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
        model={model}
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
  label: '1절',
  nextLabel: '후렴',
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
      <CanvasEditor
        key={`${model.theme.id}:${model.screen.id}`}
        value={{...themeCanvasBounds, contained: true, elements}}
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
        toolbar={
          <header className={styles.canvasHeader}>
            <span>테마</span>
            <strong>{model.theme.name}</strong>
            <span>/</span>
            <strong>{model.screen.name}</strong>
          </header>
        }
        renderContent={values => (
          <ThemePicture
            elements={values}
            background={background}
            samples={themeSamples}
            timers={model.renderTimers}
          />
        )}
        actions={{
          frame: model.frame,
          frameValue: model.frameValue,
          nudge: model.nudge,
          remove: id => model.remove([id]),
        }}
      />
    </div>
  );
}
