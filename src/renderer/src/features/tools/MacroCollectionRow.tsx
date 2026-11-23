import type {DragEvent, JSX} from 'react';
import {contextMenuTarget, isContextMenuKey} from '@renderer/ui/contextMenu';
import {MenuCheck} from '@renderer/ui/MenuParts';
import {classNames} from '@renderer/ui/classNames';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {isComposing} from '@renderer/ui/ime';
import {rowMoveDirection} from '@renderer/ui/reorder';
import {RenameField} from '@renderer/ui/RenameField';
import type {RenameContract} from '@renderer/ui/useRenameDraft';
import menuStyles from '@renderer/ui/Menu.module.css';
import styles from './MacroCollectionPicker.module.css';

/** What a row does with the drag of another 모음 over it. */
export interface CollectionRowDrag {
  readonly draggable: boolean;
  readonly onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragEnd: () => void;
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

/**
 * One row of the 매크로 모음 list: 모든 매크로 or a 모음. Click, Enter or
 * Space chooses it; Ctrl+D copies it; Alt+arrows move it; the menu key and a
 * right click open its menu; while renamed it holds the name field.
 */
export function MacroCollectionRow({
  name,
  selected,
  drag,
  rename,
  locked,
  onChoose,
  onMenu,
  onDuplicate,
  onStep,
}: {
  readonly name: string;
  readonly selected: boolean;
  readonly drag: CollectionRowDrag;
  /** The name field, while the 모음 is being renamed. */
  readonly rename: RenameContract | undefined;
  readonly locked: boolean;
  readonly onChoose: () => void;
  readonly onMenu: (anchor: MenuAnchor) => void;
  /** Copies the 모음; none for 모든 매크로. */
  readonly onDuplicate: (() => void) | undefined;
  readonly onStep: (direction: 'up' | 'down') => void;
}): JSX.Element {
  return (
    <div
      role="option"
      data-choice=""
      tabIndex={selected ? 0 : -1}
      aria-selected={selected}
      className={classNames(menuStyles.item, styles.row)}
      {...drag}
      onClick={onChoose}
      onContextMenu={event => {
        event.preventDefault();
        event.currentTarget.focus();
        onMenu({
          kind: 'point',
          target: contextMenuTarget(event),
          point: {x: event.clientX, y: event.clientY},
        });
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || isComposing(event)) {
          return;
        }
        const direction = rowMoveDirection(event.nativeEvent);
        if (
          onDuplicate !== undefined &&
          event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.code === 'KeyD'
        ) {
          event.preventDefault();
          onDuplicate();
        } else if (direction !== undefined) {
          event.preventDefault();
          onStep(direction);
        } else if (isContextMenuKey(event)) {
          event.preventDefault();
          onMenu({
            kind: 'element',
            target: contextMenuTarget(event),
            element: event.currentTarget,
          });
        } else if (
          !hasModifier(event) &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onChoose();
        }
      }}
    >
      {rename === undefined ? (
        <span className={menuStyles.label}>{name}</span>
      ) : (
        <RenameField
          label="모음 이름"
          maxLength={256}
          name={name}
          locked={locked}
          rename={rename}
        />
      )}
      {selected ? <MenuCheck /> : null}
    </div>
  );
}
