import {limitReason} from '@core/common/limitReason';
import {useEffect, useRef, type DragEvent, type JSX} from 'react';
import {
  THEME_LIMITS,
  availableThemeElementKinds,
  themeElementKinds,
} from '@core/themes/elementRules';
import {moveSelection} from '@core/common/selectionOrder';
import {selectionDragImage} from '@renderer/ui/selectionDrag';
import {Button} from '@renderer/ui/Button';
import {IconButton} from '@renderer/ui/IconButton';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelBody,
  PanelFooter,
} from '@renderer/ui/Panel';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {ThemeModel} from './useThemeEditor';
import {themeElementNames} from './themeNames';
import styles from './Themes.module.css';

export const THEME_TILE_DRAG = 'application/x-llp-theme-kind';
export const THEME_ELEMENT_DRAG = 'application/x-llp-theme-element';
export function droppedThemeKind(event: DragEvent) {
  const value = event.dataTransfer.getData(THEME_TILE_DRAG);
  return themeElementKinds.find(kind => kind === value);
}
const icons: Partial<Record<(typeof themeElementKinds)[number], string>> = {
  media: 'film',
  background: 'image',
  overlay: 'layers',
  image: 'image',
  box: 'frame',
  clock: 'clock',
  timer: 'timer',
  stageMessage: 'msg',
  memo: 'filetext',
};

export function ThemeElements({
  model,
  onMenu,
  editorEvents,
}: {
  readonly model: ThemeModel;
  readonly onMenu: (id: string | null, anchor: MenuAnchor) => void;
  readonly editorEvents: import('./useThemeClipboard').ThemeEditorEvents;
}): JSX.Element {
  const elements = model.visibleElements;
  const dragged = useRef<readonly string[]>([]);
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      release.current?.();
      dragged.current = [];
    },
    [model.theme?.id, model.screen?.id],
  );
  const topFirst = [...elements].reverse();
  const drop = (event: DragEvent, index: number): void => {
    event.preventDefault();
    event.stopPropagation();
    if (model.elementReason !== undefined) return;
    const kind = droppedThemeKind(event);
    if (kind !== undefined) {
      model.requestAdd(kind, {index});
      return;
    }
    const id = event.dataTransfer.getData(THEME_ELEMENT_DRAG);
    if (!elements.some(element => element.id === id)) return;
    if (!dragged.current.includes(id)) return;
    const ids = new Set(dragged.current);
    model.elements(values => moveSelection(values, ids, index));
    release.current?.();
    dragged.current = [];
  };
  const allowed = availableThemeElementKinds(
    elements,
    model.screen?.kind ?? 'audience',
    model.theme?.id === model.file?.standby.id,
  );
  return (
    <>
      <Panel label="요소" className={styles.elementList}>
        <PanelHeader>
          <PanelTitle title="요소" />
        </PanelHeader>
        <div
          className={styles.elements}
          {...editorEvents}
          onDragOver={event => {
            if (
              model.elementReason === undefined &&
              (event.dataTransfer.types.includes(THEME_TILE_DRAG) ||
                event.dataTransfer.types.includes(THEME_ELEMENT_DRAG))
            ) {
              event.preventDefault();
            }
          }}
          onDrop={event => drop(event, 0)}
        >
          <ListBox
            multiple
            label="요소"
            selected={model.selectedIds[0]}
            onSelect={model.select}
          >
            {topFirst.map((element, index) => (
              <div
                key={element.id}
                className={styles.elementRow}
                draggable={model.elementReason === undefined}
                onClickCapture={event => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('button')
                  ) {
                    return;
                  }
                  if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    model.selectMany(
                      model.selectedIds.includes(element.id)
                        ? model.selectedIds.filter(id => id !== element.id)
                        : [...model.selectedIds, element.id],
                    );
                  } else if (event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    const anchor = topFirst.findIndex(
                      row => row.id === model.selectedIds[0],
                    );
                    model.selectMany(
                      topFirst
                        .slice(
                          Math.min(anchor < 0 ? index : anchor, index),
                          Math.max(anchor, index) + 1,
                        )
                        .map(row => row.id),
                    );
                  }
                }}
                onDragStart={event => {
                  const ids = model.selectedIds.includes(element.id)
                    ? model.selectedIds
                    : [element.id];
                  if (!model.selectedIds.includes(element.id)) {
                    model.select(element.id);
                  }
                  dragged.current = ids;
                  release.current?.();
                  release.current = selectionDragImage(
                    event.dataTransfer,
                    event.currentTarget,
                    ids.length,
                  );
                  event.dataTransfer.setData(THEME_ELEMENT_DRAG, element.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  release.current?.();
                  dragged.current = [];
                }}
                onDrop={event => {
                  const row = event.currentTarget.getBoundingClientRect();
                  drop(
                    event,
                    elements.length -
                      index -
                      (event.clientY >= row.top + row.height / 2 ? 1 : 0),
                  );
                }}
                onContextMenu={event => {
                  event.preventDefault();
                  onMenu(element.id, contextMenuAnchor(event));
                }}
                onKeyDown={event => {
                  if (isContextMenuKey(event)) {
                    event.preventDefault();
                    onMenu(element.id, contextMenuAnchor(event));
                  }
                }}
              >
                <ListRow
                  value={element.id}
                  selected={model.selectedIds.includes(element.id)}
                  title={themeElementNames[element.kind]}
                  icon="grip"
                  end={
                    <span className={styles.trash}>
                      <IconButton
                        icon="trash"
                        label={`${themeElementNames[element.kind]} 삭제`}
                        disabled={model.elementReason !== undefined}
                        title={model.elementReason}
                        onClick={() => model.remove([element.id])}
                      />
                    </span>
                  }
                />
              </div>
            ))}
          </ListBox>
        </div>
        <PanelFooter count={elements.length} />
      </Panel>
      <Panel label="요소 추가" className={styles.tilesPanel}>
        <PanelHeader>
          <PanelTitle title="요소 추가" />
        </PanelHeader>
        <PanelBody>
          <div className={styles.tiles}>
            {allowed.map(kind => {
              const reason =
                model.elementReason ??
                (elements.length >= THEME_LIMITS.elements
                  ? limitReason('요소', THEME_LIMITS.elements)
                  : undefined);
              return (
                <Button
                  key={kind}
                  className={styles.tile}
                  icon={icons[kind] ?? 'text'}
                  disabled={reason !== undefined}
                  title={reason}
                  draggable={reason === undefined}
                  onDragStart={event => {
                    event.dataTransfer.setData(THEME_TILE_DRAG, kind);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => model.requestAdd(kind)}
                >
                  {themeElementNames[kind]}
                </Button>
              );
            })}
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}
