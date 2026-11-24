import {useLayoutEffect, useRef, type DragEvent, type JSX} from 'react';
import {useReflow} from '@renderer/ui/useReflow';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {
  MacroActionKind,
  Macro,
  MacroCollection,
} from '@core/schema/macros';
import {MACRO_ACTION_MIME, readMacroActionDrag} from './macroPaletteCatalog';
import {MacroGrid, MacroList, MacroRow, MacroTile} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {MacroCollectionPicker} from './MacroCollectionPicker';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {PanelFooter} from '@renderer/ui/Panel';
import {ViewModeSwitch} from '@renderer/ui/ViewModeSwitch';
import styles from './MacroView.module.css';

export type MacroViewMode = 'grid' | 'list';

/** Whether a drag carries a step from the 동작 palette. */
function carriesAction(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(MACRO_ACTION_MIME);
}

/** The tiles or rows of the view, in the order of `shown`. */
function optionsOf(root: HTMLElement | null): readonly HTMLElement[] {
  return Array.from(
    root?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
  );
}

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
  newDisabledReason,
  onDuplicate,
  onDelete,
  duplicateReason,
  onNewCollection,
  onDropAction,
  collectionLocked = false,
  onCollectionDelete = () => undefined,
  onProblem,
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
  readonly onMenu: (
    item: Macro,
    anchor: MenuAnchor,
    trigger: HTMLElement | undefined,
  ) => void;
  readonly onNew?: (() => void) | undefined;
  /** Duplicates a 매크로, the way its right-click 복제 row does. */
  readonly onDuplicate?: ((item: Macro) => void) | undefined;
  readonly onDelete?: ((item: Macro) => void) | undefined;
  readonly duplicateReason?: string | undefined;
  readonly newDisabledReason?: string | undefined;
  readonly onNewCollection?: (() => void) | undefined;
  readonly collectionLocked?: boolean | undefined;
  readonly onCollectionDelete?: ((item: MacroCollection) => void) | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onDropAction?:
    ((item: Macro, kind: MacroActionKind) => void) | undefined;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const collection = collections.find(item => item.id === collectionId);
  const members = collection ? new Set(collection.macroIds) : undefined;
  const shown = members ? macros.filter(item => members.has(item.id)) : macros;
  /** The 매크로 of the tile or row an event happened in. */
  const macroAt = (target: EventTarget | null): Macro | undefined => {
    const option =
      target instanceof Element
        ? target.closest<HTMLElement>('[role="option"]')
        : null;
    if (option === null || root.current?.contains(option) !== true) {
      return undefined;
    }
    return shown[optionsOf(root.current).indexOf(option)];
  };
  // NOTE(0913vision): The tiles carry their 매크로's id, so a reflow keeps
  // each in place.
  useLayoutEffect(() => {
    optionsOf(root.current).forEach((option, index) => {
      const id = shown[index]?.id;
      if (id === undefined) option.removeAttribute('data-reflow-id');
      else option.setAttribute('data-reflow-id', id);
    });
  });
  useReflow(root, {
    ids: shown.map(item => item.id),
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: collectionId ?? 'all',
  });
  const selected = shown.findIndex(item => item.id === selectedId);
  const focused = (event: KeyboardEvent): Macro | undefined =>
    macroAt(event.target);
  useWindowShortcuts([
    {
      id: 'edit.delete',
      when: event => onDelete !== undefined && focused(event) !== undefined,
      unavailable: () => (collectionLocked ? '매크로 편집 불가' : undefined),
      run: event => {
        const item = focused(event);
        if (item && !collectionLocked) onDelete?.(item);
      },
    },
    {
      id: 'edit.duplicate',
      when: event => onDuplicate !== undefined && focused(event) !== undefined,
      unavailable: () => duplicateReason,
      run: event => {
        const item = focused(event);
        if (item !== undefined && duplicateReason === undefined) {
          onDuplicate?.(item);
        }
      },
    },
  ]);
  const props = {
    label: '매크로',
    selected: selected < 0 ? undefined : selected,
    onRun: (index: number) => {
      const item = shown[index];
      if (item) onRun(item);
    },
    onMenu: (index: number, anchor: MenuAnchor) => {
      const item = shown[index];
      if (item) {
        onMenu(item, anchor, optionsOf(root.current)[index]);
      }
    },
  };
  return (
    <div
      ref={root}
      className={styles.root}
      onDragOver={event => {
        if (onDropAction && carriesAction(event) && macroAt(event.target)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        if (!onDropAction || !carriesAction(event)) return;
        const item = macroAt(event.target);
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
        <MacroCollectionPicker
          collections={collections}
          value={collection?.id}
          locked={collectionLocked}
          onChange={onCollection}
          onDelete={onCollectionDelete}
          onProblem={onProblem}
          onNew={onNewCollection}
        />
      </div>
      <div className={styles.content}>
        {mode === 'grid' ? (
          <MacroGrid
            {...props}
            onNew={onNew}
            newDisabledReason={newDisabledReason}
          >
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
      <PanelFooter
        count={shown.length}
        end={
          <ViewModeSwitch
            label="매크로 보기 방식"
            value={mode}
            onChange={onMode}
          />
        }
      />
    </div>
  );
}
