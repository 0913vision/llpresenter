import {useRef, type DragEvent, type JSX} from 'react';
import type {MacroActionKind} from '@shared/schema/macros';
import {MACRO_ACTION_MIME, readMacroActionDrag} from './macroPaletteCatalog';
import type {Macro, MacroCollection} from '@shared/schema/macros';
import {
  Button,
  MacroGrid,
  MacroList,
  MacroRow,
  MacroTile,
  SelectMenu,
  type SelectAction,
} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import styles from './MacroView.module.css';

const ALL = 'all';
export type MacroViewMode = 'grid' | 'list';

export function MacroView({
  macros,
  collections,
  collectionId,
  mode,
  selectedId,
  lastRunId,
  onCollection,
  onMode,
  onRun,
  onMenu,
  onNew,
  onDropAction,
  collectionActions,
}: {
  readonly macros: readonly Macro[];
  readonly collections: readonly MacroCollection[];
  readonly collectionId: MacroCollection['id'] | undefined;
  readonly mode: MacroViewMode;
  readonly selectedId?: Macro['id'] | undefined;
  readonly lastRunId?: Macro['id'] | undefined;
  readonly onCollection: (id: MacroCollection['id'] | undefined) => void;
  readonly onMode: (mode: MacroViewMode) => void;
  readonly onRun: (item: Macro) => void;
  readonly onMenu: (item: Macro, anchor: MenuAnchor) => void;
  readonly onNew?: (() => void) | undefined;
  readonly collectionActions?: readonly SelectAction[] | undefined;
  readonly onDropAction?:
    ((item: Macro, kind: MacroActionKind) => void) | undefined;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const dropTarget = (event: DragEvent): Macro | undefined => {
    if (!(event.target instanceof Element)) return undefined;
    const option = event.target.closest('[role="option"]');
    if (!option || !root.current?.contains(option)) return undefined;
    const options = Array.from(
      root.current.querySelectorAll('[role="option"]'),
    );
    return shown[options.indexOf(option)];
  };
  const collection = collections.find(item => item.id === collectionId);
  const members = collection ? new Set(collection.macroIds) : undefined;
  const shown = members ? macros.filter(item => members.has(item.id)) : macros;
  const selected = shown.findIndex(item => item.id === selectedId);
  const props = {
    label: '매크로',
    selected: selected < 0 ? undefined : selected,
    onRun: (index: number) => {
      const item = shown[index];
      if (item) onRun(item);
    },
    onMenu: (index: number, anchor: MenuAnchor) => {
      const item = shown[index];
      if (item) onMenu(item, anchor);
    },
  };
  return (
    <div
      ref={root}
      className={styles.root}
      onDragOver={event => {
        if (
          onDropAction &&
          Array.from(event.dataTransfer.types).includes(MACRO_ACTION_MIME) &&
          dropTarget(event)
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        if (
          !onDropAction ||
          !Array.from(event.dataTransfer.types).includes(MACRO_ACTION_MIME)
        ) {
          return;
        }
        const item = dropTarget(event);
        const kind = readMacroActionDrag(
          event.dataTransfer.getData(MACRO_ACTION_MIME),
        );
        if (item && kind) {
          event.preventDefault();
          onDropAction(item, kind);
        }
      }}
    >
      <div className={styles.header}>
        <SelectMenu
          aria-label="매크로 모음"
          value={collection?.id ?? ALL}
          actions={collectionActions}
          block
          options={[
            {value: ALL, label: '모든 매크로'},
            ...collections.map(item => ({value: item.id, label: item.name})),
          ]}
          onChange={id =>
            onCollection(collections.find(item => item.id === id)?.id)
          }
        />
        <span>{`${shown.length}개`}</span>
        <Button aria-pressed={mode === 'grid'} onClick={() => onMode('grid')}>
          격자 보기
        </Button>
        <Button aria-pressed={mode === 'list'} onClick={() => onMode('list')}>
          목록 보기
        </Button>
      </div>
      {mode === 'grid' ? (
        <MacroGrid {...props} onNew={onNew}>
          {shown.map(item => (
            <MacroTile
              key={item.id}
              name={item.name}
              icon={item.icon}
              color={item.color}
              selected={item.id === selectedId}
              lastRun={item.id === lastRunId}
              schedule={item.runOnStartup ? {kind: 'startup'} : undefined}
            />
          ))}
        </MacroGrid>
      ) : (
        <MacroList {...props}>
          {shown.map(item => (
            <MacroRow
              key={item.id}
              name={item.name}
              icon={item.icon}
              color={item.color}
              selected={item.id === selectedId}
              lastRun={item.id === lastRunId}
              schedule={item.runOnStartup ? {kind: 'startup'} : undefined}
              actionCount={item.actions.length}
            />
          ))}
        </MacroList>
      )}
    </div>
  );
}
