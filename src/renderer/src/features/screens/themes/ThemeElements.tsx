import type {DragEvent, JSX} from 'react';
import {
  THEME_LIMITS,
  availableThemeElementKinds,
  themeElementKinds,
} from '@core/themes/elementRules';
import {dropThemeElement} from '@core/themes/elementEdits';
import {Button} from '@renderer/ui/Button';
import {IconButton} from '@renderer/ui/IconButton';
import {ListBox, ListRow} from '@renderer/ui/ListRow';
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelBody,
  PanelMeta,
  PanelActions,
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
    model.elements(values => dropThemeElement(values, id, index));
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
          <PanelActions>
            <PanelMeta>
              {elements.length} / {THEME_LIMITS.elements}
            </PanelMeta>
          </PanelActions>
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
                onDragStart={event => {
                  event.dataTransfer.setData(THEME_ELEMENT_DRAG, element.id);
                  event.dataTransfer.effectAllowed = 'move';
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
                  ? '요소는 10개까지 추가할 수 있음'
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
