import {limitReason} from '@core/common/limitReason';
import {useEffect, useRef, type DragEvent, type JSX} from 'react';
import {THEME_FILE_LIMITS} from '@core/schema/theme';
import {
  addableKinds,
  canAddElement,
  moveElements,
  type AddableKind,
} from '@core/theme';
import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
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
import {addableNames, elementName} from './themeNames';
import styles from './Themes.module.css';
import {useReflow} from '@renderer/ui/useReflow';

const ALREADY_THERE = '이 화면에 이미 있습니다.';
export const THEME_TILE_DRAG = 'application/x-llp-theme-kind';
export const THEME_ELEMENT_DRAG = 'application/x-llp-theme-element';
export function droppedThemeKind(event: DragEvent) {
  const value = event.dataTransfer.getData(THEME_TILE_DRAG);
  return addableKinds.find(kind => kind === value);
}
const icons: Readonly<Record<AddableKind, string>> = {
  box: 'textaa',
  text: 'text',
  next: 'next',
  picture: 'image',
  shape: 'frame',
  background: 'film',
};

/**
 * The 요소 추가 panel: a tile per kind of element, clicked or dragged into
 * the list. A tile waits while the theme can't change, the screen is full,
 * or the screen already has its one element of that kind.
 */
function ThemeAddTiles({model}: {readonly model: ThemeModel}): JSX.Element {
  const {layout} = model;
  const elements = layout?.elements ?? [];
  return (
    <Panel label="요소 추가" className={styles.tilesPanel}>
      <PanelHeader>
        <PanelTitle title="요소 추가" />
      </PanelHeader>
      <PanelBody>
        <div className={styles.tiles}>
          {addableKinds.map(kind => {
            const reason =
              model.elementReason ??
              (layout === null || canAddElement(layout, kind)
                ? undefined
                : elements.length >= THEME_FILE_LIMITS.elements
                  ? limitReason('요소', THEME_FILE_LIMITS.elements)
                  : ALREADY_THERE);
            return (
              <Button
                key={kind}
                className={styles.tile}
                icon={icons[kind]}
                disabled={reason !== undefined}
                title={reason}
                draggable={reason === undefined}
                onDragStart={event => {
                  event.dataTransfer.setData(THEME_TILE_DRAG, kind);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => model.requestAdd(kind)}
              >
                {addableNames[kind]}
              </Button>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}

/**
 * The elements chosen after a click on row `index` of `rows` (top first):
 * Ctrl or Command adds or drops the row, Shift takes the rows from the first
 * chosen one to it. Undefined for a plain click, which the list handles.
 */
function clickedElements(
  {
    rows,
    selected,
    index,
  }: {
    readonly rows: readonly string[];
    readonly selected: readonly string[];
    readonly index: number;
  },
  {toggle, range}: {readonly toggle: boolean; readonly range: boolean},
): readonly string[] | undefined {
  const id = rows[index];
  if (id === undefined) return undefined;
  if (toggle) {
    return selected.includes(id)
      ? selected.filter(value => value !== id)
      : [...selected, id];
  }
  if (!range) return undefined;
  const anchor = rows.indexOf(selected[0] ?? '');
  return rows.slice(
    Math.min(anchor < 0 ? index : anchor, index),
    Math.max(anchor, index) + 1,
  );
}

export function ThemeElements({
  model,
  onMenu,
  editorEvents,
}: {
  readonly model: ThemeModel;
  readonly onMenu: (id: string | null, anchor: MenuAnchor) => void;
  readonly editorEvents: import('./useThemeClipboard').ThemeEditorEvents;
}): JSX.Element {
  const {layout} = model;
  const elements = layout?.elements ?? [];
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
  const list = useRef<HTMLDivElement>(null);
  useReflow(list, {
    ids: topFirst.map(element => element.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: `${model.theme?.id ?? ''}:${model.screen?.id ?? ''}`,
  });
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
    if (
      !isUnchangedSelectionMove(
        elements.map(element => element.id),
        ids,
        index,
      )
    ) {
      model.elements(screen => moveElements(screen, ids, index));
    }
    release.current?.();
    dragged.current = [];
  };
  return (
    <>
      <Panel label="요소" className={styles.elementList}>
        <PanelHeader>
          <PanelTitle title="요소" />
        </PanelHeader>
        <div
          ref={list}
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
                  const next = clickedElements(
                    {
                      rows: topFirst.map(row => row.id),
                      selected: model.selectedIds,
                      index,
                    },
                    {
                      toggle: event.ctrlKey || event.metaKey,
                      range: event.shiftKey,
                    },
                  );
                  if (next === undefined) return;
                  event.preventDefault();
                  event.stopPropagation();
                  model.selectMany(next);
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
                  title={elementName(element)}
                  icon="grip"
                  end={
                    <span className={styles.trash}>
                      <IconButton
                        icon="trash"
                        label={`${elementName(element)} 삭제`}
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
      <ThemeAddTiles model={model} />
    </>
  );
}
